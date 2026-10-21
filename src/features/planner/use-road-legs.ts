import {
  queryOptions,
  replaceEqualDeep,
  useQueries,
} from "@tanstack/react-query";
import type { LatLng } from "@/features/course/schedule";
import { type RoadLegQuery, roadLegKey, roadRoutePath } from "./course-map";

// 코스 구간의 도로 경로(GET /api/route, lib/road-route.ts). 지도 탭 · 코스 탭 · 테마 코스 지도가 같은 queryKey로 부르므로
// 한 구간은 한 번만 받는다. 서버는 결과를 저장하지 않고(카카오 정책) 브라우저가 들고 있는다(앱 road_route.dart roadRouteProvider와 같은 규칙):
//   - 받은 경로 · 경로 없음({ empty: true }) · 400 · 403(429 말고 다른 4xx도)은 1시간(ROAD_CACHE_MS) 그대로 쓴다.
//     1시간 뒤 다시 물어 잠깐의 실패면 받은 경로를 그대로 두고 1시간 더 쓴다(앱은 실행 동안 다시 묻지 않는다)
//   - 잠깐의 실패(시간 초과 · 연결 없음 · JSON이 아니거나 모양이 다른 2xx · not configured가 아닌 5xx · 429)는 ROAD_RETRY로 두고
//     ROAD_RETRY_MS(5분) 뒤 다시 부른다: 그 구간을 보고 있으면 그때, 아니면 다음에 볼 때
//   - 503 not configured(키 없음 · 카카오내비 권한 없음)를 받으면 페이지를 새로 고칠 때까지 더 부르지 않는다(roadLegFetcher)
// 경로가 없는 동안(받는 중 · 없음 · 실패 · 다시 부르기 전) 쓰는 쪽은 직선 점선과 일정의 어림 거리를 그대로 쓴다

/** 받은 도로 경로. points는 지도 선 */
export type RoadLeg = { km: number; min: number; points: LatLng[] };

/** 잠깐의 실패. 지금은 경로 없음처럼 그리고 ROAD_RETRY_MS 뒤 다시 부른다 */
export const ROAD_RETRY = "retry";
/** 구간 하나의 답: 경로 · null(없음, 다시 부르지 않는다) · ROAD_RETRY(잠깐의 실패) */
export type RoadLegResult = RoadLeg | null | typeof ROAD_RETRY;

/** 그대로 두는 답(경로 · null)을 들고 있는 시간(ms). 서버 Cache-Control(1시간)과 같다 */
const ROAD_CACHE_MS = 3600 * 1000;
/** 잠깐의 실패를 다시 부르기까지(ms). 앱 road_route.dart roadRouteRetryAfter와 같다 */
export const ROAD_RETRY_MS = 5 * 60 * 1000;
/** 시간 제한(ms). 서버의 카카오 시간 제한(8초)보다 길게. 자리를 받은 뒤부터 잰다 */
const ROAD_TIMEOUT_MS = 10000;
/** 동시에 보내는 요청 수(첫 답을 받은 뒤). 앱 road_route.dart roadRouteParallel과 같다 */
export const ROAD_PARALLEL = 6;

/** 성공 응답 { km, min, path: [[위도, 경도], …] }(lib/road-route.ts RoadRoute) → 경로. 모양이 다르거나 점이 2개 미만이면 null */
function toRoadLeg(body: unknown): RoadLeg | null {
  const b = body as { km?: unknown; min?: unknown; path?: unknown } | null;
  if (
    typeof b?.km !== "number" ||
    typeof b.min !== "number" ||
    !Array.isArray(b.path) ||
    b.path.length < 2
  )
    return null;
  const points: LatLng[] = [];
  for (const p of b.path as unknown[]) {
    if (
      !Array.isArray(p) ||
      typeof p[0] !== "number" ||
      typeof p[1] !== "number"
    )
      return null;
    points.push({ lat: p[0], lng: p[1] });
  }
  return { km: b.km, min: b.min, points };
}

/** 본문 JSON. JSON이 아니거나(가로챈 페이지 등) 읽다 시간 초과면 undefined */
async function jsonOf(res: Response): Promise<unknown> {
  try {
    return (await res.json()) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * 구간 도로 경로를 받는 함수. 앱 road_route.dart RoadRouteGate와 같은 문지기를 둔다:
 * 첫 답을 받기 전에는 하나만, 그 뒤로는 ROAD_PARALLEL개까지 보낸다(코스 하나에 80구간까지라 한꺼번에 보내지 않는다).
 * 시간 제한은 자리를 받은 뒤부터 잰다(기다린 시간은 넣지 않는다).
 * 503 not configured(키 없음 · 카카오내비 권한 없음)를 받으면 이 함수는 더 부르지 않고 null — 키가 없는 서버에는 한 번만 묻는다
 */
export function roadLegFetcher(): (q: RoadLegQuery) => Promise<RoadLegResult> {
  let off = false;
  let answered = false;
  let running = 0;
  const waiting: (() => void)[] = [];
  const limit = () => (answered ? ROAD_PARALLEL : 1);

  async function fetchOne(q: RoadLegQuery): Promise<RoadLegResult> {
    let res: Response;
    try {
      res = await fetch(roadRoutePath(q), {
        signal: AbortSignal.timeout(ROAD_TIMEOUT_MS),
      });
    } catch {
      return ROAD_RETRY; // 시간 초과 · 연결 없음
    }
    if (res.status === 503) {
      const body = (await jsonOf(res)) as { message?: unknown } | undefined;
      if (body?.message === "not configured") {
        off = true;
        return null;
      }
      return ROAD_RETRY;
    }
    if (res.status === 429 || res.status >= 500) return ROAD_RETRY;
    // 400(좌표가 틀림 · 너무 멂) · 403(다른 사이트) 등: 다시 물어도 같은 답이다
    if (!res.ok) return null;
    const body = await jsonOf(res);
    if ((body as { empty?: unknown } | undefined)?.empty === true) return null;
    return toRoadLeg(body) ?? ROAD_RETRY;
  }

  return async (q) => {
    if (running < limit()) running++;
    // 자리를 받고 깨어난다(running은 깨운 쪽이 셌다)
    else await new Promise<void>((wake) => waiting.push(wake));
    try {
      return off ? null : await fetchOne(q);
    } finally {
      answered = true;
      running--;
      while (waiting.length > 0 && running < limit()) {
        running++;
        waiting.shift()!();
      }
    }
  };
}

// 페이지를 새로 고칠 때까지 문지기 하나를 쓴다(App Router 화면 이동은 모듈을 그대로 두므로 503 뒤에는 새로 고칠 때까지 부르지 않는다)
const fetchRoadLeg = roadLegFetcher();

const retrying = (query: { state: { data?: RoadLegResult } }) =>
  query.state.data === ROAD_RETRY;

/** 답이 경로인지(없음 · 잠깐의 실패 · 받는 중이 아님) */
function isRoadLeg(r: unknown): r is RoadLeg {
  return typeof r === "object" && r !== null;
}

/**
 * 구간 하나의 조회 옵션. 잠깐의 실패만 ROAD_RETRY_MS 뒤 낡은 값이 되고(그 뒤 화면에 다시 나오거나 창에 돌아오면 부른다),
 * 보고 있는 동안은 그 간격으로 다시 부른다. 경로 · 없음을 받으면 멈춘다. 받은 경로는 다시 물어 잠깐의 실패여도 그대로 둔다.
 * get은 테스트가 문지기를 바꿔 끼운다
 */
export function roadLegOptions(q: RoadLegQuery, get = fetchRoadLeg) {
  return queryOptions({
    queryKey: [
      "route",
      `${q.from.lat},${q.from.lng}`,
      `${q.to.lat},${q.to.lng}`,
      q.by ?? "",
    ],
    queryFn: () => get(q),
    staleTime: (query) => (retrying(query) ? ROAD_RETRY_MS : ROAD_CACHE_MS),
    refetchInterval: (query) => (retrying(query) ? ROAD_RETRY_MS : false),
    gcTime: ROAD_CACHE_MS,
    retry: false,
    structuralSharing: (old, next) =>
      next === ROAD_RETRY && isRoadLeg(old) ? old : replaceEqualDeep(old, next),
  });
}

/**
 * 구간 조회들의 도로 경로. 받은 구간만 roadLegKey → 경로로 담는다(받는 중 · 없음 · 실패는 빠진다).
 * null(부르지 않는 구간)과 같은 조회는 한 번만 부른다
 */
export function useRoadLegs(
  queries: readonly (RoadLegQuery | null)[],
): ReadonlyMap<string, RoadLeg> {
  const unique = new Map<string, RoadLegQuery>();
  for (const q of queries) if (q) unique.set(roadLegKey(q), q);
  const list = [...unique.values()];
  return useQueries({
    queries: list.map((q) => roadLegOptions(q)),
    combine: (results) => {
      const out = new Map<string, RoadLeg>();
      results.forEach((r, i) => {
        if (isRoadLeg(r.data)) out.set(roadLegKey(list[i]), r.data);
      });
      return out;
    },
  });
}
