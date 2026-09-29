// 신규 관광지(kto:<contentid>, features/planner/kto-place.ts) 서버 처리(서버 전용).
//   - GET /api/tour/spot?id=: 지도 · 코스에 넣을 장소 한 곳(앱 장소와 같은 필드). 브라우저가 기억해 두지 않은 신규 관광지를 링크로 열었을 때 부른다
//   - GET /api/planner/places/<kto:id>: 장소 시트의 설명(국문 관광정보 개요) · 사진 · 주소. 앱 장소의 무거운 필드와 같은 모양
// 공공데이터포털 키(DATA_GO_KR_KEY)가 없으면 503(화면이 칸을 숨긴다). 테스트(vitest)가 "@/" 경로를 풀지 못해 상대 경로로 import한다.
import type {
  PlannerPlaceDetail,
  PlannerPlaceView,
} from "../features/planner/place-detail";
import { isKtoId } from "../features/planner/kto-place";
import { locales } from "../i18n/locales";
import {
  fetchKtoPlace,
  KTO_PLACE_SECONDS,
  publicKtoPlace,
  tourApiKey,
  tourJson,
  tourNotConfigured,
  type TourPlace,
  tourUnavailable,
} from "./tour-api";

async function load(
  id: string,
): Promise<{ place: TourPlace } | { error: Response }> {
  if (!isKtoId(id))
    return {
      error: Response.json({ message: "invalid id" }, { status: 400 }),
    };
  const key = tourApiKey();
  if (!key) return { error: tourNotConfigured() };
  try {
    const place = await fetchKtoPlace(id, key);
    return place
      ? { place }
      : {
          error: Response.json({ message: "not found" }, { status: 404 }),
        };
  } catch {
    return { error: tourUnavailable() };
  }
}

/** GET /api/tour/spot 처리. 응답은 KtoPlace */
export async function tourSpotResponse(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  const r = await load(id);
  if ("error" in r) return r.error;
  return tourJson(publicKtoPlace(r.place), KTO_PLACE_SECONDS);
}

/**
 * 신규 관광지의 장소 시트 필드(PlannerPlaceDetail). 설명 · 주소는 한국어뿐이라 외국어 화면(view)에는 보내지 않는다
 * (앱 장소처럼 한국어 원문을 외국어 화면에 보이지 않는다). 좌표 기준 줄은 「한국관광공사」 출처로 적는다
 */
export function ktoDetail(
  place: TourPlace,
  locale: string | null,
): PlannerPlaceDetail {
  const detail: PlannerPlaceDetail = {
    ...(place.overview ? { desc: { ko: place.overview } } : {}),
    ...(place.photo ? { img: place.photo, imgCredit: "한국관광공사" } : {}),
    ...(place.addr ? { src: { ko: `${place.addr} (한국관광공사)` } } : {}),
  };
  if (!locale || !(locales as readonly string[]).includes(locale))
    return detail;
  const view: PlannerPlaceView =
    locale === "ko"
      ? {
          desc: place.overview,
          source: detail.src?.ko,
          appTranslated: false,
        }
      : { appTranslated: false };
  return { ...detail, view };
}

/** GET /api/planner/places/<kto:id> 처리 */
export async function ktoDetailResponse(
  id: string,
  locale: string | null,
): Promise<Response> {
  const r = await load(id);
  if ("error" in r) return r.error;
  return tourJson(ktoDetail(r.place, locale), KTO_PLACE_SECONDS);
}
