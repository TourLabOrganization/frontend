import type { Origin, RegionHub } from "@/features/course/places";
import { EMPTY_NAMES, type NameTable } from "../names/names";
import regionsData from "./data/regions.json";

// 투어 플래너의 권역 · 도시(이름 · 가운데 좌표) · 관문 · 출발지. data/regions.json만 불러와서 가볍다.
// 장소 목록(data/places.json, 3,118곳 · 약 850KB)이 필요 없는 곳(ME · 테마 화면 · 코스 저장소 · 일정 계산)은 data.ts 대신 이 파일을 쓴다.
// data/regions.json은 scripts/build-planner.mjs가 Tour Planner.dc.html의 REG · MACRO_REGION · MACRO_OF · CITY_NAME · REGION_HUB · ORIGINS와
// 파생 데이터/지역거점.csv · 출발지.csv(수단)로 만든다.

/** 권역 key. Tour Planner.dc.html REG 순서 */
export const REGION_KEYS = [
  "capital",
  "gangwon",
  "chungcheong",
  "daegyeong",
  "dongnam",
  "honam",
  "jeju",
] as const;
export type RegionKey = (typeof REGION_KEYS)[number];

export function isRegionKey(value: unknown): value is RegionKey {
  return (REGION_KEYS as readonly unknown[]).includes(value);
}

export type Region = {
  key: RegionKey;
  /** 권역 이름. 목업 지도가 그리는 MACRO_REGION 이름(경북권 · 경남권 · 전라권 …) */
  ko: string;
  en: string;
  /** 권역의 도시(한국어 이름). REG 순서 뒤에 MACRO_OF에만 있는 도시(목업 _mcExtra). 장소가 없는 도시도 들어 있다 */
  cities: readonly string[];
};

export type CityInfo = {
  /** 영어 이름. CITY_NAME에 없으면 빈 문자열 */
  en: string;
  /** 장소 좌표 평균. 장소가 없는 도시는 없다 */
  lat?: number;
  lng?: number;
};

export const REGIONS = regionsData.regions as readonly Region[];
export const CITY_INFO = regionsData.cities as Readonly<
  Record<string, CityInfo>
>;
/** 도시 → 광역 관문. Tour Planner.dc.html REGION_HUB 중 장소가 있는 도시. 수단은 지역거점.csv(전철권 metro 포함). 관문이 없는 도시도 있다 */
export const CITY_HUBS = regionsData.hubs as Readonly<
  Record<string, RegionHub>
>;

/** 출발지(역 · 터미널 · 공항 · 항구). Tour Planner.dc.html ORIGINS 순서 그대로. 수단은 출발지.csv(전철 metro 포함) */
export const PLANNER_ORIGINS = regionsData.origins as Readonly<
  Record<string, Origin & { route?: string }>
>;

/** 지역 탭에 따로 칸이 있는 도시 (목업: 전국 · 서울 · 부산 · 제주 · 도시 ▾) */
export const FEATURED_CITIES = ["서울", "부산", "제주"] as const;

/** 도시 고르기에서 칩을 강조하는 주요 도시 (Tour Planner.dc.html cityGroups GOLD) */
export const MAJOR_CITIES: ReadonlySet<string> = new Set([
  "서울",
  "인천",
  "강릉",
  "경주",
  "부산",
  "전주",
  "제주",
]);

export function findRegion(key: RegionKey): Region {
  return REGIONS.find((r) => r.key === key)!;
}

/** 화면 언어의 도시 이름. 이름표(names)에 그 언어 표기가 없으면 영어, 영어도 없으면 한국어 */
export function cityName(
  city: string,
  locale: string,
  names: NameTable = EMPTY_NAMES,
): string {
  if (locale === "ko") return city;
  return names.cities[city] || CITY_INFO[city]?.en || city;
}

/** 화면 언어의 권역 이름. 이름표(names)에 없으면 영어 */
export function regionName(
  region: Pick<Region, "key" | "ko" | "en">,
  locale: string,
  names: NameTable = EMPTY_NAMES,
) {
  if (locale === "ko") return region.ko;
  return names.regions[region.key] || region.en;
}
