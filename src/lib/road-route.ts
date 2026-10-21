// 코스 지도의 도로 경로(GET /api/route?from=<위도>,<경도>&to=<위도>,<경도>[&by=distance], 서버 전용).
// 코스 빌더 지도가 같은 날 두 장소를 직선 대신 실제 도로를 따라 잇고, 코스 탭 구간 · 요약 거리가 도로 거리를 쓰게 한다(2026-10-20 요청).
// 카카오모빌리티 자동차 길찾기(apis-navi.kakaomobility.com/v1/directions)를 서버 키(KAKAO_REST_KEY)로 부른다(AGENTS.md 3):
//   - 입력은 한국 안 좌표 두 개와 우선순위(by 없음 RECOMMEND · by=distance DISTANCE)뿐이다. 호스트 · 경로는 고정(아무 주소나 대신 불러 주지 않는다)
//   - 도보 길찾기는 카카오모빌리티 제휴 전용이라 대중교통 · 도보 구간은 자동차 도로 최단 경로(by=distance)로 그린다
//   - 카카오 정책상 길찾기 결과를 우리 쪽에 저장 · 재사용하지 않는다: 서버 fetch 캐시를 쓰지 않고(cache: "no-store"),
//     응답은 private라 브라우저 · 앱만 들고 있는다(받은 답은 브라우저 1시간 · 앱 실행 동안 메모리, 잠깐의 실패(5xx · 429 등)는 5분 뒤 다시 묻는다:
//     features/planner/use-road-legs.ts · 앱 road_route.dart)
//   - 꼭짓점(vertexes, [경도, 위도, 경도, 위도, …])을 이어 [위도, 경도] 목록으로 바꾸고, 양 끝을 핀에 붙인 뒤 Douglas–Peucker로 줄인다
//   - 저장하지 못해 같은 요청도 매번 카카오를 부르므로, 카카오 앞에서 다른 사이트 페이지의 브라우저 요청(403)과 IP마다 토큰 버킷(429)으로 막는다
// 키 · 카카오 오류 문구는 응답 · 로그에 넣지 않는다. 일정 시각(분)은 바꾸지 않는다: 화면은 선 · 구간 거리 · 요약 거리에만 쓴다.
// 테스트(vitest)가 "@/" 경로를 풀지 못해 처리를 이 파일에 두고 Route Handler(app/api/route)는 부르기만 한다.
import { kakaoRestKey } from "./kakao-rest";

type LatLng = { lat: number; lng: number };

/** 카카오모빌리티 자동차 길찾기 주소 */
export const KAKAO_DIRECTIONS_URL =
  "https://apis-navi.kakaomobility.com/v1/directions";
/** 호출 시간 제한(ms) */
export const ROUTE_TIMEOUT_MS = 8000;
/** 200 응답 Cache-Control max-age(초). 브라우저 TanStack Query도 같은 시간 들고 있는다. 서버는 저장하지 않는다 */
export const ROUTE_CLIENT_SECONDS = 3600;
/** 받는 좌표 범위(한국, 마라도 · 독도 · 백령도를 넉넉히 품는다). 밖이면 400, 경로 꼭짓점은 버린다 */
export const ROUTE_BOUNDS = {
  minLat: 32.5,
  maxLat: 39.5,
  minLng: 124,
  maxLng: 132.5,
} as const;
/** 이보다 가까운 두 점(m)은 카카오를 부르지 않고 경로 없음 */
export const ROUTE_MIN_M = 20;
/** 이보다 먼 두 점(직선 km)은 400 */
export const ROUTE_MAX_KM = 700;

/**
 * IP마다 카카오까지 가는 요청 상한(토큰 버킷, 서버 인스턴스 메모리): 한꺼번에 ROUTE_IP_BURST개(80구간 코스 둘), 그 뒤 시간당 ROUTE_IP_PER_HOUR개.
 * 시간당 300이면 IP 하나가 하루 무료 쿼터(약 1만 건)를 다 쓰지 못한다(160 + 300 × 24 = 7,360)
 */
export const ROUTE_IP_BURST = 160;
export const ROUTE_IP_PER_HOUR = 300;
/** 기억하는 IP 수 상한. 넘으면 다 찬 버킷(한동안 안 온 IP)부터 지운다 */
export const ROUTE_IP_KEEP = 10000;

/** 카카오 priority. by 없음 → 추천, by=distance → 최단 거리 */
export type RoutePriority = "RECOMMEND" | "DISTANCE";
export type RouteQuery = { from: LatLng; to: LatLng; priority: RoutePriority };

/** GET /api/route 응답(길을 찾았을 때). path는 [위도, 경도] */
export type RoadRoute = { km: number; min: number; path: [number, number][] };
/** GET /api/route 200 응답. 길이 없으면(섬 건너기 · 도로 없음 · 20m 안) { empty: true } */
export type RoadRouteBody = RoadRoute | { empty: true };

const EARTH_M = 6371000;
const RAD = Math.PI / 180;

/** 소수 5자리(약 1m). 같은 구간을 같은 캐시로 묶는다 */
export function round5(v: number): number {
  return Math.round(v * 1e5) / 1e5;
}

/** 두 점 사이 거리(m). 위도 보정 등거리 근사(course/schedule.ts straightKm과 같은 식) */
export function distM(a: LatLng, b: LatLng): number {
  const la = ((a.lat + b.lat) / 2) * RAD;
  return (
    EARTH_M *
    Math.hypot((b.lat - a.lat) * RAD, (b.lng - a.lng) * RAD * Math.cos(la))
  );
}

function inBounds(lat: number, lng: number): boolean {
  const b = ROUTE_BOUNDS;
  return (
    lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng
  );
}

const DECIMAL = /^-?\d+(?:\.\d+)?$/;

/** "위도,경도" → 좌표(소수 5자리). 숫자가 아니거나 한국 범위 밖이면 null */
export function parseLatLng(value: string | null): LatLng | null {
  if (value === null) return null;
  const parts = value.split(",").map((x) => x.trim());
  if (parts.length !== 2 || !parts.every((x) => DECIMAL.test(x))) return null;
  const [lat, lng] = parts.map(Number);
  if (!inBounds(lat, lng)) return null;
  return { lat: round5(lat), lng: round5(lng) };
}

/** 쿼리 검사. 틀리면 400 문구 */
export function parseRouteQuery(
  params: URLSearchParams,
): RouteQuery | { error: "invalid from/to" | "invalid by" } {
  const from = parseLatLng(params.get("from"));
  const to = parseLatLng(params.get("to"));
  if (!from || !to) return { error: "invalid from/to" };
  const by = params.get("by");
  if (by !== null && by !== "distance") return { error: "invalid by" };
  return { from, to, priority: by === "distance" ? "DISTANCE" : "RECOMMEND" };
}

/** 카카오 길찾기 주소. 카카오는 x(경도),y(위도) 순이다. 좌표는 숫자뿐이라 쉼표를 그대로 둔다(카카오 문서 예시와 같게) */
export function kakaoDirectionsUrl(q: RouteQuery): string {
  return (
    `${KAKAO_DIRECTIONS_URL}?origin=${q.from.lng},${q.from.lat}` +
    `&destination=${q.to.lng},${q.to.lat}&priority=${q.priority}` +
    "&alternatives=false&road_details=false&summary=false"
  );
}

/** 경로를 줄이는 허용 오차(m) = 경로 km × 0.5, 3 ~ 40m */
export function simplifyTolerance(km: number): number {
  return Math.min(40, Math.max(3, km * 0.5));
}

/** 점 p와 선분 ab 사이 거리(평면 m) */
function segmentDist(
  p: readonly [number, number],
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2),
        );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Douglas–Peucker(허용 오차 m). 평균 위도로 보정한 등거리 평면(m)에서 잰다.
 * 긴 경로(수만 점)에서 재귀가 깊어지지 않게 스택으로 돈다. 양 끝은 늘 남는다
 */
export function simplifyPath(
  points: readonly LatLng[],
  tolM: number,
): LatLng[] {
  const n = points.length;
  if (n <= 2) return points.slice();
  const lat0 = (points.reduce((a, p) => a + p.lat, 0) / n) * RAD;
  const kx = EARTH_M * RAD * Math.cos(lat0);
  const ky = EARTH_M * RAD;
  const xy = points.map((p) => [p.lng * kx, p.lat * ky] as const);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    let max = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segmentDist(xy[i], xy[a], xy[b]);
      if (d > max) {
        max = d;
        at = i;
      }
    }
    if (at !== -1 && max > tolM) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** sections[].roads[].vertexes를 차례로 이은 점. 숫자가 아닌 값 · 한국 범위 밖 점 · 바로 앞과 같은 점은 버린다 */
export function routeVertices(route: unknown): LatLng[] {
  const out: LatLng[] = [];
  const sections = (route as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(sections)) return out;
  for (const s of sections) {
    const roads = (s as { roads?: unknown } | null)?.roads;
    if (!Array.isArray(roads)) continue;
    for (const r of roads) {
      const v = (r as { vertexes?: unknown } | null)?.vertexes;
      if (!Array.isArray(v)) continue;
      for (let i = 0; i + 1 < v.length; i += 2) {
        const lng = v[i];
        const lat = v[i + 1];
        if (typeof lng !== "number" || typeof lat !== "number") continue;
        if (!inBounds(lat, lng)) continue;
        const last = out.at(-1);
        if (last && last.lat === lat && last.lng === lng) continue;
        out.push({ lat, lng });
      }
    }
  }
  return out;
}

/** 끝점이 핀과 1m 넘게 떨어져 있으면 핀을 붙인다(선이 핀에 닿게) */
const PIN_SNAP_M = 1;

/**
 * 카카오 응답 → 응답 본문. 길이 없으면(routes 없음 · result_code ≠ 0 · 도로 꼭짓점 2개 미만 · 줄인 뒤 2점 미만) { empty: true }.
 * 모양이 다르면(본문이 객체가 아님 · summary 거리 · 시간이 숫자가 아님) null(502)
 */
export function toRoadRoute(
  body: unknown,
  q: RouteQuery,
): RoadRouteBody | null {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return null;
  const routes = (body as { routes?: unknown }).routes;
  if (!Array.isArray(routes) || routes.length === 0) return { empty: true };
  const route = routes[0] as {
    result_code?: unknown;
    summary?: { distance?: unknown; duration?: unknown };
  } | null;
  if (route?.result_code !== 0) return { empty: true };
  const distance = route.summary?.distance;
  const duration = route.summary?.duration;
  if (
    typeof distance !== "number" ||
    typeof duration !== "number" ||
    !Number.isFinite(distance) ||
    !Number.isFinite(duration)
  )
    return null;
  const km = Math.round(distance / 100) / 10;
  const road = routeVertices(route);
  if (road.length < 2) return { empty: true };
  if (distM(q.from, road[0]) > PIN_SNAP_M) road.unshift(q.from);
  if (distM(road.at(-1)!, q.to) > PIN_SNAP_M) road.push(q.to);
  const path: [number, number][] = [];
  for (const p of simplifyPath(road, simplifyTolerance(km))) {
    const lat = round5(p.lat);
    const lng = round5(p.lng);
    // 반올림하면 같아지는 이웃 점은 하나만(줄이기 허용 오차가 3m 이상이라 거의 같은 양 끝뿐)
    const last = path.at(-1);
    if (last && last[0] === lat && last[1] === lng) continue;
    path.push([lat, lng]);
  }
  if (path.length < 2) return { empty: true };
  return { km, min: Math.round(duration / 60), path };
}

const buckets = new Map<string, { tokens: number; at: number }>();
const TOKENS_PER_MS = ROUTE_IP_PER_HOUR / (3600 * 1000);

/** 요청한 곳의 IP. Vercel은 x-forwarded-for · x-real-ip를 자기가 본 IP로 덮어쓴다. 없으면 ""(모두 한 버킷) */
export function clientIp(request: Request): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "";
}

function refilled(b: { tokens: number; at: number }, now: number): number {
  return Math.min(ROUTE_IP_BURST, b.tokens + (now - b.at) * TOKENS_PER_MS);
}

/** IP 하나의 토큰을 하나 쓴다. 남은 게 없으면 false(429) */
export function takeRouteToken(ip: string, now = Date.now()): boolean {
  const b = buckets.get(ip);
  if (!b && buckets.size >= ROUTE_IP_KEEP) {
    for (const [k, v] of buckets)
      if (refilled(v, now) >= ROUTE_IP_BURST) buckets.delete(k);
    // 모두 쓰는 중이면 먼저 들어온 IP부터
    for (const k of buckets.keys()) {
      if (buckets.size < ROUTE_IP_KEEP) break;
      buckets.delete(k);
    }
  }
  const tokens = b ? refilled(b, now) : ROUTE_IP_BURST;
  const ok = tokens >= 1;
  buckets.set(ip, { tokens: ok ? tokens - 1 : tokens, at: now });
  return ok;
}

/** 버킷을 비운다(테스트) */
export function resetRouteLimit(): void {
  buckets.clear();
}

/** 기억하고 있는 IP 수(테스트) */
export function routeLimitSize(): number {
  return buckets.size;
}

/** 응답. 200(경로 · 경로 없음)은 private, max-age=3600(브라우저 1시간 · 앱은 실행 동안 메모리), 오류는 no-store */
function routeJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control":
        status === 200
          ? `private, max-age=${ROUTE_CLIENT_SECONDS}`
          : "no-store",
    },
  });
}

/**
 * GET /api/route 처리.
 * 400 좌표 · by가 틀림 · 700km 넘음, 503 키 없음 · 카카오 401/403(카카오내비 API 권한 없음),
 * 502 카카오 실패(그 밖의 HTTP 오류 · 시간 초과 · JSON 아님 · 모양 다름),
 * 403 다른 사이트 페이지의 브라우저 요청(Sec-Fetch-Site: cross-site), 429 그 IP의 상한을 넘음
 */
export async function roadRouteResponse(request: Request): Promise<Response> {
  // 우리 화면은 same-origin, 앱 · curl은 이 헤더가 없다. 다른 사이트가 방문자 브라우저로 쿼터를 쓰지 못하게 한다
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return routeJson({ message: "forbidden" }, 403);
  const q = parseRouteQuery(new URL(request.url).searchParams);
  if ("error" in q) return routeJson({ message: q.error }, 400);
  const d = distM(q.from, q.to);
  if (d < ROUTE_MIN_M) return routeJson({ empty: true });
  if (d > ROUTE_MAX_KM * 1000) return routeJson({ message: "too far" }, 400);
  const key = kakaoRestKey();
  if (!key) return routeJson({ message: "not configured" }, 503);
  if (!takeRouteToken(clientIp(request)))
    return routeJson({ message: "too many requests" }, 429);
  try {
    const res = await fetch(kakaoDirectionsUrl(q), {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS),
      // 카카오 정책: 길찾기 결과를 서버에 저장 · 재사용하지 않는다
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403)
      return routeJson({ message: "not configured" }, 503);
    if (!res.ok) return routeJson({ message: "upstream" }, 502);
    const body = toRoadRoute(await res.json(), q);
    if (!body) return routeJson({ message: "upstream" }, 502);
    return routeJson(body);
  } catch {
    // 시간 초과 · JSON 아님. 원래 오류 문구는 버린다
    return routeJson({ message: "upstream" }, 502);
  }
}
