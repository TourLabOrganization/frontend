import type { Place } from "../course/places";
import { straightKm } from "../course/schedule";
import staysData from "./data/stays.json";

// 코스 빌더의 숙소. 규칙은 PoC Tour Planner.dc.html(courseStays · courseList · dayPlan의 bed · anchor · picked · far ·
// genericName · staySuggest · autoCourse의 _keepStay)을 옮겼다. 순수 함수만 둔다.
//
//  - 숙박 장소(cat === "stay")는 코스에 담겨 있어도 관광 시간 배분(일정 계산)에서 빠지고 그날 밤 숙소로만 쓴다
//  - 그날 밤 숙소(마지막 날 빼고): 기준점(anchor) = 그날 마지막 경유지, 그날이 비면 다음 날 첫 경유지, 없으면 이전 날 마지막 경유지
//      1. 코스에 담은 숙박 장소 중 기준점에서 가장 가까운 곳이 25km 안이면 그곳(직접 지정)
//      2. 아니면 숙소 표본 중 가장 가까운 곳이 25km 안이면 그곳
//      3. 아니면 이름 없이 「숙소 A · B …」(날짜 순번) + 「{기준점} 근처 · 숙소 미지정」
//  - 숙소 표본(data/stays.json)은 PoC STAYS(「임의 구성 — 실제 예약 정보 아님」). 가격대는 옮기지 않았다(scripts/build-stays.mjs)
//  - 거리는 일정 모듈의 직선거리(straightKm, PoC km()와 같은 식)

/** 그날 밤 숙소를 찾는 반경(km). PoC dayPlan · staySuggest의 25 */
export const STAY_RADIUS_KM = 25;
/** 「주변 숙소」에 보이는 우리 숙박 장소 수. PoC slice(0, 4) */
const OWN_LIMIT = 4;
/** 「주변 숙소」에 보이는 표본 수. 우리 장소가 있으면 2, 없으면 4 (PoC slice(0, own.length ? 2 : 4)) */
const SAMPLE_LIMIT_WITH_OWN = 2;
const SAMPLE_LIMIT = 4;

export type StaySample = {
  /** PoC STAYS의 지역 key */
  region: string;
  id: string;
  lat: number;
  lng: number;
  ko: string;
  en: string;
  /** 지도 · 예약 검색어(PoC stayQuery) */
  qKo?: string;
  qEn?: string;
  areaKo: string;
  areaEn: string;
  typeKo: string;
  typeEn: string;
};

export const STAY_SAMPLES = staysData as readonly StaySample[];

type LatLng = { lat: number; lng: number };

/** 숙박 장소인지 (PoC cat === 'stay') */
export const isStay = (p: { cat: string }) => p.cat === "stay";

/** 담은 장소를 일정에 넣을 장소와 숙박 장소로 나눈다(PoC courseList · courseStays). 담은 순서는 그대로 */
export function splitStays<T extends { cat: string }>(
  places: readonly T[],
): { sights: T[]; stays: T[] } {
  const sights: T[] = [];
  const stays: T[] = [];
  for (const p of places) (isStay(p) ? stays : sights).push(p);
  return { sights, stays };
}

/** 가장 가까운 것과 거리. 목록이 비면 null */
function nearest<T extends LatLng>(
  from: LatLng,
  list: readonly T[],
): { item: T; km: number } | null {
  let best: { item: T; km: number } | null = null;
  for (const item of list) {
    const km = straightKm(from, item);
    if (!best || km < best.km) best = { item, km };
  }
  return best;
}

/**
 * i번째 날(0부터) 밤 숙소의 기준점. 그날 마지막 경유지, 그날이 비면 다음 날(이후) 첫 경유지, 없으면 이전 날 마지막 경유지.
 * 경유지가 하나도 없으면 null (PoC dayPlan ctxLast)
 */
export function nightAnchor<P>(
  days: readonly { stops: readonly { place: P }[] }[],
  i: number,
): P | null {
  const own = days[i]?.stops;
  if (own && own.length > 0) return own[own.length - 1].place;
  for (let k = i + 1; k < days.length; k++) {
    const first = days[k].stops[0];
    if (first) return first.place;
  }
  for (let k = i - 1; k >= 0; k--) {
    const last = days[k].stops.at(-1);
    if (last) return last.place;
  }
  return null;
}

export type NightStay<P> =
  /** 코스에 담은 숙박 장소(직접 지정) */
  | { kind: "picked"; place: P }
  /** 숙소 표본(예시) */
  | { kind: "sample"; sample: StaySample }
  /** 25km 안에 없음. letter = 「숙소 A」의 A(날짜 순번) */
  | { kind: "generic"; letter: string; anchor: P };

/**
 * i번째 날(0부터) 밤 숙소를 고른다(PoC dayPlan bed · picked · far).
 * stays: 코스에 담은 숙박 장소. 기준점이 없으면 담은 숙박 장소를 날짜 순서로 돌려 쓰고(PoC _pk[i % length]),
 * 담은 것도 없으면 null(카드 없음)
 */
export function pickNightStay<P extends LatLng>(
  anchor: P | null,
  stays: readonly P[],
  samples: readonly StaySample[],
  i: number,
): NightStay<P> | null {
  if (!anchor) {
    return stays.length > 0
      ? { kind: "picked", place: stays[i % stays.length] }
      : null;
  }
  const own = nearest(anchor, stays);
  if (own && own.km <= STAY_RADIUS_KM)
    return { kind: "picked", place: own.item };
  const sample = nearest(anchor, samples);
  if (sample && sample.km <= STAY_RADIUS_KM)
    return { kind: "sample", sample: sample.item };
  return { kind: "generic", letter: String.fromCharCode(65 + i), anchor };
}

export type NearbyStays<P> = {
  /** 우리 장소 DB의 숙박 장소. 가까운 순 최대 4곳 */
  own: { place: P; km: number }[];
  /** 숙소 표본. 가까운 순, 우리 장소가 있으면 최대 2곳 · 없으면 4곳 */
  samples: { sample: StaySample; km: number }[];
};

/** 「주변 숙소」 목록(PoC staySuggest). 기준점에서 25km 안만 */
export function nearbyStays<P extends LatLng & { cat: string }>(
  anchor: LatLng,
  places: readonly P[],
  samples: readonly StaySample[],
): NearbyStays<P> {
  const within = <T extends LatLng>(list: readonly T[]) =>
    list
      .map((item) => ({ item, km: straightKm(anchor, item) }))
      .filter((x) => x.km <= STAY_RADIUS_KM)
      .sort((a, b) => a.km - b.km);
  const own = within(places.filter(isStay))
    .slice(0, OWN_LIMIT)
    .map(({ item, km }) => ({ place: item, km }));
  const near = within(samples)
    .slice(0, own.length > 0 ? SAMPLE_LIMIT_WITH_OWN : SAMPLE_LIMIT)
    .map(({ item, km }) => ({ sample: item, km }));
  return { own, samples: near };
}

/**
 * 「주변 숙소」에서 우리 숙박 장소를 눌렀을 때의 담은 장소(PoC staySuggest open).
 * 같은 기준점 25km 안의 다른 숙박 장소는 빼고, 누른 곳은 담겨 있으면 빼고 없으면 맨 뒤에 담는다
 */
export function toggleNightStay(
  placeIds: readonly string[],
  stayId: string,
  anchor: LatLng,
  lookup: (id: string) => (LatLng & { cat: string }) | undefined,
): string[] {
  const next = placeIds.filter((id) => {
    if (id === stayId) return true;
    const p = lookup(id);
    return !(p && isStay(p) && straightKm(anchor, p) <= STAY_RADIUS_KM);
  });
  const k = next.indexOf(stayId);
  if (k > -1) next.splice(k, 1);
  else next.push(stayId);
  return next;
}

/**
 * 추천 코스를 불러온 뒤의 담은 장소(PoC autoCourse _keepStay). 지정해 둔 숙박 장소는 추천 코스 뒤에 남긴다.
 * 한 코스는 한 도시라 추천 코스와 다른 도시(locKo)의 숙박 장소는 남기지 않는다
 */
export function keepStays(
  recommended: readonly string[],
  current: readonly string[],
  lookup: (id: string) => { cat: string; locKo: string } | undefined,
  city: string,
): string[] {
  const kept = current.filter((id) => {
    const p = lookup(id);
    return p !== undefined && isStay(p) && p.locKo === city;
  });
  return recommended.filter((id) => !kept.includes(id)).concat(kept);
}

/** 숙소 검색어(PoC stayQuery). 한국어는 qKo(없으면 이름 + 지역), 그 밖의 언어는 qEn(없으면 영어 이름 + 지역) */
export function stayQuery(
  s: Pick<StaySample, "ko" | "en" | "qKo" | "qEn" | "areaKo" | "areaEn">,
  locale: string,
): string {
  if (locale === "ko") return s.qKo || `${s.ko} ${s.areaKo}`.trim();
  return s.qEn || `${s.en || s.ko} ${s.areaEn}`.trim();
}

/** 담은 숙박 장소의 검색어(PoC picked bed의 qKo · qEn = 지역 + 이름). cityEn: 도시 영어 이름 */
export function placeStayQuery(
  p: Pick<Place, "ko" | "en" | "locKo">,
  cityEn: string,
  locale: string,
): string {
  return locale === "ko"
    ? `${p.locKo} ${p.ko}`.trim()
    : `${cityEn} ${p.en || p.ko}`.trim();
}

/** 표본 지도 검색 주소(PoC staySuggest open). 한국어는 네이버 지도, 그 밖의 언어는 Google 지도(PoC GMAP_LANG) */
export function sampleMapUrl(s: StaySample, locale: string): string {
  const q = encodeURIComponent(stayQuery(s, locale));
  if (locale === "ko") return `https://map.naver.com/p/search/${q}`;
  const hl = locale === "zh" ? "zh-CN" : locale;
  return `https://www.google.com/maps/search/${q}?hl=${["en", "zh-CN", "ja", "es"].includes(hl) ? hl : "en"}`;
}
