// 외국어 화면 오디오 가이드의 대체 해설: 한국관광공사 다국어 관광정보 서비스(영 EngService2 · 일 JpnService2 · 중 ChsService2 · 스페인어 SpnService2)의
// 관광지 소개문(detailCommon2 overview, 2026-10-06 요청). 키는 DATA_GO_KR_KEY(언어마다 공공데이터포털 활용신청이 따로 있다). 음성 파일은 없다.
// 같은 곳 찾기: 그 언어 서비스의 위치 기반 목록(locationBasedList2, 장소 좌표 반경 300m, 가까운 순)에서
//   제목이 그 언어 장소 이름과 서로를 품는 가장 가까운 곳 → 없으면 50m 안(FOREIGN_SAME_M, 같은 원천이라 좌표가 거의 같다)의 가장 가까운 곳.
import type { AppLocale } from "../i18n/locales";
import type { TourAudio } from "./tour";
import {
  fetchTourItems,
  FOREIGN_SAME_M,
  KTO_LANG_SERVICES,
  tourApiUrl,
  type TourItem,
  type TourPlace,
} from "./tour-api";
import { km } from "./tour-photo";

/** 소개문을 찾는 반경(m) */
export const OVERVIEW_RADIUS_M = 300;

/** 외국어 화면 언어 → 다국어 서비스. 한국어 화면은 없다 */
export function overviewService(locale: AppLocale): string | null {
  return locale === "ko" ? null : KTO_LANG_SERVICES[locale];
}

/** 제목 비교용(대소문자 · 공백 · 문장부호 무시) */
function key(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

/**
 * 위치 기반 목록에서 같은 곳: 반경 안이고 한글이 없는 제목 중, 제목이 그 언어 장소 이름과 서로를 품는 가장 가까운 곳 →
 * 없으면 50m 안의 가장 가까운 곳. 없으면 null
 */
export function pickOverviewItem(
  items: readonly TourItem[],
  place: { name: string; lat: number; lng: number },
): TourItem | null {
  const name = key(place.name);
  let named: { x: TourItem; d: number } | null = null;
  let near: { x: TourItem; d: number } | null = null;
  for (const x of items) {
    const title = String(x.title ?? "").trim();
    if (!title || /[ㄱ-ㆎ가-힣]/.test(title) || !x.contentid) continue;
    const lat = Number(x.mapy);
    const lng = Number(x.mapx);
    if (!lat || !lng) continue;
    const d = km(place.lat, place.lng, lat, lng) * 1000;
    if (d > OVERVIEW_RADIUS_M) continue;
    const t = key(title);
    if (
      name.length >= 2 &&
      t.length >= 2 &&
      (t.includes(name) || name.includes(t))
    )
      if (!named || d < named.d) named = { x, d };
    if (d <= FOREIGN_SAME_M && (!near || d < near.d)) near = { x, d };
  }
  return named?.x ?? near?.x ?? null;
}

/** 소개문(HTML 조각) → 글자. 줄바꿈 태그는 줄바꿈 하나로 */
export function overviewText(value: unknown): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>|<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n\s*/g, "\n")
    .trim();
}

/**
 * 그 언어 관광정보의 소개문(외국어 화면). name은 그 언어 장소 이름(영어는 영어 이름, 중 · 일 · 스페인어는 이름표의 이름 → 없으면 영어 이름).
 * 못 찾거나 소개문이 비었거나 한글이 섞이면 null. 외부 실패는 TourApiError를 그대로 던진다
 */
export async function ktoOverview(
  key: string,
  place: TourPlace,
  locale: AppLocale,
  name: string,
  cache: number,
): Promise<TourAudio | null> {
  const service = overviewService(locale);
  if (!service) return null;
  const list = await fetchTourItems(
    tourApiUrl(`${service}/locationBasedList2`, key, {
      numOfRows: "30",
      pageNo: "1",
      arrange: "E",
      mapX: String(place.lng),
      mapY: String(place.lat),
      radius: String(OVERVIEW_RADIUS_M),
    }),
    cache,
  );
  const item = pickOverviewItem(list, {
    name,
    lat: place.lat,
    lng: place.lng,
  });
  if (!item) return null;
  const detail = await fetchTourItems(
    tourApiUrl(`${service}/detailCommon2`, key, {
      contentId: String(item.contentid),
    }),
    cache,
  );
  const script = overviewText(detail[0]?.overview);
  const title = String(detail[0]?.title ?? item.title ?? "").trim();
  if (!script || /[ㄱ-ㆎ가-힣]/.test(script + title)) return null;
  return { title, script, source: "kto" };
}
