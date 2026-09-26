import hubsData from "./data/hubs.json";
import placesData from "./data/places.json";
import type { AccessMode, Hub, LegFn, SchedulePlace } from "./schedule";
import { legInfo, type TravelMode } from "./schedule";

// 테마별 장소 · 광역 관문 데이터.
// data/places.json: Tour-Navigator-App/체류시간 산정/체류시간_장소별.csv 에서 테마 5개 장소만 뽑은 것
// data/hubs.json:   Tour-Navigator-App/Tour Planner.dc.html 의 REGION_HUB(쓰는 시군만) · ORIGINS · METRO_NET
// 둘 다 scripts/build-places.mjs 로 만든다. 손으로 고치지 않는다.

export type Place = SchedulePlace & {
  n: number | null;
  en: string;
  locKo: string;
  /** 분류코드: herit · heal · activity · food · sea · stay */
  cat: string;
  min: number;
  hrs: string;
  /** 파싱한 개장 · 폐장(분). 운영시간 패턴이 없으면 null(상시 개방). 폐장은 자정을 넘기면 1440 이상 */
  open: number | null;
  close: number | null;
  /** 영상 장소 */
  yt: boolean;
  /** 확장(목록 외) 장소 */
  off: boolean;
  /** 한국관광 100선 */
  k100: boolean;
  /** 유네스코 */
  un: boolean;
  /** 무장애 */
  bf: boolean;
  /** 자동 코스 후보 (체류 > 0 이고 숙박이 아님) */
  auto: boolean;
};

export type CourseThemeSlug = keyof typeof placesData;

export const PLACES_BY_THEME: Readonly<
  Record<CourseThemeSlug, readonly Place[]>
> = placesData;

export function getThemePlaces(slug: string): readonly Place[] {
  return slug in PLACES_BY_THEME
    ? PLACES_BY_THEME[slug as CourseThemeSlug]
    : [];
}

export type RegionHub = Hub & {
  lat: number;
  lng: number;
  ko: string;
  en: string;
  busLat?: number;
  busLng?: number;
  airLat?: number;
  airLng?: number;
  shipLat?: number;
  shipLng?: number;
  modes: AccessMode[];
};

export type Origin = {
  ko: string;
  en: string;
  lat: number;
  lng: number;
  modes: AccessMode[];
};

/** 시군 → 지역 관문. Tour Planner.dc.html REGION_HUB */
export const REGION_HUB = hubsData.regionHubs as Readonly<
  Record<string, RegionHub>
>;

/** 출발지(역 · 터미널 · 공항). Tour Planner.dc.html ORIGINS */
export const ORIGINS = hubsData.origins as Readonly<Record<string, Origin>>;

/** 전철권 시군. Tour Planner.dc.html METRO_NET → METRO_CITY */
const METRO_CITY: Readonly<Record<string, 1>> = Object.fromEntries(
  hubsData.metroCities.map((c) => [c, 1 as const]),
);

/** 앱이 쓰는 구간 함수: legInfo(p, q, mode, REGION_HUB, METRO_CITY) */
export function makeLegFn(mode: TravelMode = "transit"): LegFn {
  return (p, q) => legInfo(p, q, mode, REGION_HUB, METRO_CITY);
}

/** 테마의 장소 수와 영상 장소 수. places.json에서 센다 */
export function themePlaceStats(slug: string): {
  places: number;
  videos: number;
} {
  const list = getThemePlaces(slug);
  return { places: list.length, videos: list.filter((p) => p.yt).length };
}
