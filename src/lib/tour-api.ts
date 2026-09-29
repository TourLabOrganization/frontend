// 한국관광공사 공공데이터포털 API 공통 (서버 전용). Route Handler(app/api/tour/*)와 tour-audio · tour-related · tour-crowd만 import한다.
// 키는 서버 환경변수 DATA_GO_KR_KEY(공공데이터포털 디코딩 키)로만 읽는다. 응답 · 오류 문구 · 로그에 키(와 키가 든 주소)를 넣지 않는다.
// 입력은 장소 id뿐이다. 한국어 이름 · 좌표 · 시군구 코드는 서버가 장소 데이터에서 찾는다(아무 검색어나 대신 불러 주는 중계가 되지 않게).
// 시군구 코드(data/signgu.json)는 여기서만 읽는다(클라이언트 번들에 넣지 않는다, tour-api.test.ts).
// 테스트(vitest)가 "@/" 경로를 풀지 못해 상대 경로로 import한다.
import { findPlace, type PlannerPlace } from "../features/planner/data";
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

/** 캐시 방법. 초 = 서버 fetch 캐시(revalidate), no-store = 캐시하지 않음 */
export type TourCache = number | "no-store";

/** 공공데이터포털을 불러 item 배열을 돌려준다. 시간 초과 · HTTP 오류 · 모양 · resultCode 오류면 TourApiError */
export async function fetchTourItems(
  url: string,
  cache: TourCache,
): Promise<TourItem[]> {
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
  return items;
}

/** 장소의 시군구 코드. 못 구한 곳 · 모르는 id는 "" */
export function tourPlaceSigngu(id: string): string {
  return Object.hasOwn(SIGNGU, id) ? SIGNGU[id] : "";
}

/** 칸을 불러올 장소(플래너 장소 + 시군구 코드) */
export type TourPlace = PlannerPlace & { signgu: string };

export function tourPlace(id: string): TourPlace | null {
  const place = findPlace(id);
  if (!place) return null;
  return { ...place, signgu: tourPlaceSigngu(place.id) };
}

/** 쿼리 검사 결과. 틀리면 돌려줄 응답(400 · 404) */
export type TourQuery =
  { place: TourPlace; locale: AppLocale } | { error: Response };

/**
 * 쿼리 검사: id(필수, 플래너 장소)와 locale(needLocale이면 필수, 5개 언어).
 * 빠졌거나 틀린 값은 400, 모르는 장소 id는 404
 */
export function parseTourQuery(
  request: Request,
  needLocale: boolean,
): TourQuery {
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
  const place = tourPlace(id);
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
