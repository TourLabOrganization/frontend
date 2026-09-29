// 한국관광공사 공공데이터포털 API 공통 (서버 전용). Route Handler(app/api/tour/*)와 tour-audio · tour-related · tour-crowd만 import한다.
// 키는 서버 환경변수 DATA_GO_KR_KEY(공공데이터포털 디코딩 키)로만 읽는다. 응답 · 오류 문구 · 로그에 키(와 키가 든 주소)를 넣지 않는다.
// 입력은 장소 id뿐이다. 한국어 이름 · 좌표 · 시군구 코드는 서버가 장소 데이터에서 찾는다(아무 검색어나 대신 불러 주는 중계가 되지 않게).
// 시군구 코드(data/signgu.json)는 여기서만 읽는다(클라이언트 번들에 넣지 않는다, tour-api.test.ts).
// 테스트(vitest)가 "@/" 경로를 풀지 못해 상대 경로로 import한다.
import {
  findPlace,
  PLANNER_PLACES,
  type PlannerPlace,
} from "../features/planner/data";
import { isKtoId, type KtoPlace, ktoId } from "../features/planner/kto-place";
import signguData from "../features/planner/data/signgu.json";
import { type AppLocale, locales } from "../i18n/locales";
import { TOUR_TIMEOUT_MS } from "./tour";

/** 한국관광공사(B551011) 공공데이터포털 API 주소 */
export const DATA_GO_KR_BASE = "https://apis.data.go.kr/B551011";

/** 장소 id → 시군구 코드(법정동 앞 5자리, scripts/build-signgu.mjs). 못 구한 곳은 "" */
const SIGNGU = signguData as Readonly<Record<string, string>>;

/** 서버 환경변수의 공공데이터포털 키. 없으면 null(각 칸이 숨는다) */
export function tourApiKey(): string | null {
  const key = process.env.DATA_GO_KR_KEY?.trim();
  return key ? key : null;
}

/** 공공데이터포털 호출 주소. 호스트 · 경로는 코드에 고정하고 값은 쿼리로만 넘긴다(PoC와 같은 공통 인자) */
export function tourApiUrl(
  path: string,
  key: string,
  params: Readonly<Record<string, string>>,
): string {
  const url = new URL(`${DATA_GO_KR_BASE}/${path}`);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("MobileOS", "ETC");
  url.searchParams.set("MobileApp", "TourNavigator");
  url.searchParams.set("_type", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** 응답 item 하나(필드는 문자열 또는 숫자로 온다) */
export type TourItem = Readonly<Record<string, unknown>>;

/** 공공데이터포털 호출 실패. 문구에 주소 · 키를 넣지 않는다 */
export class TourApiError extends Error {}

/**
 * 공공데이터포털 JSON 응답 → item 배열.
 * response.header.resultCode가 0000 · 00이 아니면(없어도) null.
 * items.item은 배열 · 객체 하나 · 없음(결과가 없으면 items가 빈 문자열로 온다) 모두 배열로 바꾼다
 */
export function parseTourItems(body: unknown): TourItem[] | null {
  const response = (body as { response?: unknown } | null)?.response;
  if (typeof response !== "object" || response === null) return null;
  const { header, body: inner } = response as {
    header?: { resultCode?: unknown };
    body?: { items?: unknown };
  };
  const code = String(header?.resultCode ?? "");
  if (code !== "0000" && code !== "00") return null;
  const items = inner?.items;
  const item =
    typeof items === "object" && items !== null
      ? (items as { item?: unknown }).item
      : undefined;
  const list = Array.isArray(item) ? item : item ? [item] : [];
  return list.filter((x): x is TourItem => typeof x === "object" && x !== null);
}

/** 공공데이터포털 JSON 응답의 전체 건수(body.totalCount). 없으면 0 */
export function parseTourTotal(body: unknown): number {
  const total = Number(
    (body as { response?: { body?: { totalCount?: unknown } } } | null)
      ?.response?.body?.totalCount,
  );
  return Number.isFinite(total) ? total : 0;
}

/** 캐시 방법. 초 = 서버 fetch 캐시(revalidate), no-store = 캐시하지 않음 */
export type TourCache = number | "no-store";

/** 공공데이터포털을 불러 item 배열을 돌려준다. 시간 초과 · HTTP 오류 · 모양 · resultCode 오류면 TourApiError */
export async function fetchTourItems(
  url: string,
  cache: TourCache,
): Promise<TourItem[]> {
  return (await fetchTourPage(url, cache)).items;
}

/** fetchTourItems와 같고, 여러 쪽으로 나눠 받을 때 쓰는 전체 건수(totalCount)를 함께 돌려준다 */
export async function fetchTourPage(
  url: string,
  cache: TourCache,
): Promise<{ items: TourItem[]; total: number }> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(TOUR_TIMEOUT_MS),
      ...(cache === "no-store"
        ? { cache: "no-store" as const }
        : { next: { revalidate: cache } }),
    });
  } catch {
    // 네트워크 · 시간 초과. 원래 오류에는 주소가 섞일 수 있어 버린다
    throw new TourApiError("tour api fetch failed");
  }
  if (!res.ok) throw new TourApiError(`tour api ${res.status}`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // 키가 틀리면 _type=json이어도 XML 오류가 온다
    throw new TourApiError("tour api shape");
  }
  const items = parseTourItems(body);
  if (!items) throw new TourApiError("tour api result code");
  return { items, total: parseTourTotal(body) };
}

/**
 * 장소 이름 앞의 도시 이름(locKo)을 뗀 이름. 떼고 2글자 이상일 때만, 아니면 null.
 * 「전주한옥마을」 → 「한옥마을」, 「경주 양남 주상절리」 → 「양남 주상절리」. 오디 · 연관 관광지 · 집중률 검색어 후보에서 공백을 뺀 이름(withoutSpaces) 앞에 넣는다
 * (전주한옥마을은 연관 관광지 「전주한옥마을」 0건 · 「한옥마을」 50건, 2026-09-29 확인)
 */
export function withoutCity(name: string, city: string): string | null {
  const c = city.replace(/\(.*?\)/g, "").trim();
  if (!c || !name.startsWith(c)) return null;
  const rest = name.slice(c.length).trim();
  return rest.length >= 2 ? rest : null;
}

/**
 * 공백을 뺀 검색어 후보: 이름에 공백이 있으면 공백을 뺀 이름, 앞의 도시 이름을 뗀 이름(withoutCity)에도 공백이 있으면 그것도 공백을 뺀 이름.
 * 「정동심곡 바다부채길」 → 「정동심곡바다부채길」, 「경주 양남 주상절리」 → 「경주양남주상절리」 · 「양남주상절리」. 세 칸 모두 검색어 후보의 마지막에 넣는다
 * (정동심곡 바다부채길의 오디 ko 해설은 제목이 「정동심곡바다부채길」이라 공백 있는 이름으로는 0건, 2026-09-29 확인)
 */
export function withoutSpaces(name: string, city: string): string[] {
  return [name, withoutCity(name, city) ?? ""]
    .filter((n) => /\s/.test(n))
    .map((n) => n.replace(/\s+/g, ""));
}

/** 장소의 시군구 코드. 못 구한 곳 · 모르는 id는 "" */
export function tourPlaceSigngu(id: string): string {
  return Object.hasOwn(SIGNGU, id) ? SIGNGU[id] : "";
}

/** 칸을 불러올 장소(플래너 장소 + 시군구 코드). 신규 관광지(kto:)는 대표 사진 · 주소 · 개요도 있다 */
export type TourPlace = KtoPlace & { signgu: string; overview?: string };

/** 앱 장소(places.json)만 찾는다 */
export function tourPlace(id: string): TourPlace | null {
  const place = findPlace(id);
  if (!place) return null;
  return { ...place, signgu: tourPlaceSigngu(place.id) };
}

/** 신규 관광지 공통정보를 다시 부르는 간격(초). 이름 · 좌표 · 사진은 자주 바뀌지 않는다 */
export const KTO_PLACE_SECONDS = 7 * 24 * 3600;

/** 신규 관광지의 기본 체류(분). 앱 장소의 분류별 흔한 값 */
const KTO_MINUTES: Readonly<Record<string, number>> = {
  activity: 90,
  food: 60,
  stay: 720,
};

/**
 * 한국관광공사 분류 → 앱 분류(herit · heal · activity · food · sea · stay).
 * 콘텐츠 타입(contenttypeid) · 옛 대분류(cat1) · 새 분류체계(lclsSystm1) 중 아는 값을 쓴다. 자연 · 관광지는 이름에 바다 말이 있으면 sea, 아니면 heal
 */
export function ktoCategory(item: TourItem): string {
  const type = String(item.contenttypeid ?? "");
  const cat1 = String(item.cat1 ?? "");
  const lcls = String(item.lclsSystm1 ?? "");
  if (type === "32" || cat1 === "B02" || lcls === "AC") return "stay";
  if (type === "39" || cat1 === "A05" || lcls === "FD") return "food";
  if (
    ["15", "28", "38"].includes(type) ||
    ["A03", "A04"].includes(cat1) ||
    ["LS", "SH", "EV", "EX"].includes(lcls)
  )
    return "activity";
  if (type === "14" || cat1 === "A02" || ["HS", "VE"].includes(lcls))
    return "herit";
  const name = String(item.title ?? "");
  return /해수욕장|해변|해안|바다|포구|등대|섬|항$/.test(name) ? "sea" : "heal";
}

/**
 * 신규 관광지의 도시(locKo) · 권역(macro): 같은 시군구 코드의 앱 장소(숙박 제외)가 가장 많이 속한 도시.
 * 시군구 코드가 없거나 그 시군구에 앱 장소가 없으면 좌표가 가장 가까운 앱 장소의 도시. 앱 장소가 없으면 null
 */
export function ktoCity(
  signgu: string,
  lat: number,
  lng: number,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
  signguOf: (id: string) => string = tourPlaceSigngu,
): Pick<PlannerPlace, "locKo" | "macro"> | null {
  const pool = places.filter((p) => p.cat !== "stay");
  const same = signgu ? pool.filter((p) => signguOf(p.id) === signgu) : [];
  if (same.length > 0) {
    const counts = new Map<string, { n: number; p: PlannerPlace }>();
    for (const p of same) {
      const c = counts.get(p.locKo);
      if (c) c.n++;
      else counts.set(p.locKo, { n: 1, p });
    }
    const best = [...counts.values()].sort((a, b) => b.n - a.n)[0].p;
    return { locKo: best.locKo, macro: best.macro };
  }
  let near: PlannerPlace | null = null;
  let min = Infinity;
  for (const p of pool) {
    const d =
      (p.lat - lat) ** 2 +
      ((p.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < min) {
      min = d;
      near = p;
    }
  }
  return near ? { locKo: near.locKo, macro: near.macro } : null;
}

/** http 사진 주소를 https로. 모양이 다르면 "" */
function httpsUrl(src: unknown): string {
  const s = String(src ?? "")
    .trim()
    .replace(/^http:\/\//i, "https://");
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : "";
}

/**
 * 국문 관광정보 항목(searchKeyword2 · detailCommon2) → 신규 관광지. 콘텐츠 id · 이름 · 한국 안 좌표가 없으면 null.
 * 시군구 코드는 법정동 코드(lDongRegnCd 2자리 + lDongSignguCd 3자리)로 만든다(앱 장소의 signgu.json과 같은 체계)
 */
export function toKtoPlace(
  item: TourItem,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
  signguOf: (id: string) => string = tourPlaceSigngu,
): TourPlace | null {
  const id = ktoId(item.contentid);
  const ko = String(item.title ?? "").trim();
  const lat = Number(item.mapy);
  const lng = Number(item.mapx);
  if (!id || !ko || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 32 || lat > 39 || lng < 124 || lng > 132) return null;
  const regn = String(item.lDongRegnCd ?? "").trim();
  const sgg = String(item.lDongSignguCd ?? "").trim();
  const signgu = /^\d{2}$/.test(regn) && /^\d{3}$/.test(sgg) ? regn + sgg : "";
  const city = ktoCity(signgu, lat, lng, places, signguOf);
  if (!city) return null;
  const cat = ktoCategory(item);
  const overview = String(item.overview ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
  return {
    id,
    n: null,
    ko,
    en: "",
    locKo: city.locKo,
    pickCity: city.locKo,
    macro: city.macro,
    cat,
    lat,
    lng,
    min: KTO_MINUTES[cat] ?? 60,
    hrs: "",
    open: null,
    close: null,
    yt: false,
    off: true,
    k100: false,
    un: false,
    bf: false,
    auto: false,
    photo: httpsUrl(item.firstimage) || httpsUrl(item.firstimage2),
    addr: String(item.addr1 ?? "").trim(),
    signgu,
    ...(overview ? { overview } : {}),
  };
}

/** 신규 관광지 한 곳(국문 관광정보 공통정보 detailCommon2). 키가 없거나 결과가 없으면 null, 외부 실패는 TourApiError */
export async function fetchKtoPlace(
  id: string,
  key: string | null,
): Promise<TourPlace | null> {
  if (!key || !isKtoId(id)) return null;
  const items = await fetchTourItems(
    tourApiUrl("KorService2/detailCommon2", key, {
      contentId: id.slice("kto:".length),
    }),
    KTO_PLACE_SECONDS,
  );
  return items.length > 0 ? toKtoPlace(items[0]) : null;
}

/** 앱 장소 또는 신규 관광지(kto:). 모르는 id · 키 없음 · 외부 실패면 null */
export async function resolveTourPlace(id: string): Promise<TourPlace | null> {
  const place = tourPlace(id);
  if (place || !isKtoId(id)) return place;
  try {
    return await fetchKtoPlace(id, tourApiKey());
  } catch {
    return null;
  }
}

/** 브라우저에 보내는 신규 관광지(서버에서만 쓰는 시군구 코드 · 개요를 뺀다) */
export function publicKtoPlace(place: TourPlace): KtoPlace {
  const rest: KtoPlace & { signgu?: string; overview?: string } = { ...place };
  delete rest.signgu;
  delete rest.overview;
  return rest;
}

/** 쿼리 검사 결과. 틀리면 돌려줄 응답(400 · 404) */
export type TourQuery =
  { place: TourPlace; locale: AppLocale } | { error: Response };

/**
 * 쿼리 검사: id(필수, 플래너 장소 또는 신규 관광지 kto:)와 locale(needLocale이면 필수, 5개 언어).
 * 빠졌거나 틀린 값은 400, 모르는 장소 id는 404(신규 관광지를 풀지 못해도 404)
 */
export async function parseTourQuery(
  request: Request,
  needLocale: boolean,
): Promise<TourQuery> {
  const params = new URL(request.url).searchParams;
  const id = params.get("id")?.trim() ?? "";
  if (!id)
    return { error: Response.json({ message: "invalid id" }, { status: 400 }) };
  const raw = params.get("locale");
  const locale = (locales as readonly string[]).includes(raw ?? "")
    ? (raw as AppLocale)
    : null;
  if (needLocale && !locale)
    return {
      error: Response.json({ message: "invalid locale" }, { status: 400 }),
    };
  const place = await resolveTourPlace(id);
  if (!place)
    return { error: Response.json({ message: "not found" }, { status: 404 }) };
  return { place, locale: locale ?? "ko" };
}

/** 키 없음(503). 화면은 칸을 숨긴다 */
export function tourNotConfigured(): Response {
  return Response.json({ message: "not configured" }, { status: 503 });
}

/** 외부 실패(502). 화면은 칸을 숨긴다 */
export function tourUnavailable(): Response {
  return Response.json({ message: "tour api unavailable" }, { status: 502 });
}

/**
 * 결과(결과 없음 { empty: true } 포함). 같은 장소는 maxAge초 동안 다시 부르지 않는다.
 * maxAge가 0이면 캐시하지 않는다(키 없음 · 외부 실패 때 대신 보내는 스토리텔링 — 키가 생기거나 외부가 돌아오면 바로 바뀌게)
 */
export function tourJson(body: unknown, maxAge: number): Response {
  return Response.json(body, {
    headers: {
      "Cache-Control": maxAge > 0 ? `public, max-age=${maxAge}` : "no-store",
    },
  });
}
