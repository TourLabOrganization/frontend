import type { Origin, RegionHub } from "@/features/course/places";
import { EMPTY_NAMES, type NameTable } from "../names/names";
import regionsData from "./data/regions.json";

// 투어 플래너의 권역 · 도시(이름 · 가운데 좌표) · 관문 · 출발지. data/regions.json만 불러와서 가볍다.
// 장소 목록(data/places.json, 3,118곳 · 약 850KB)이 필요 없는 곳(ME · 테마 화면 · 코스 저장소 · 일정 계산 · 도시 고르기 · 여행 정보 탭)은
// data.ts 대신 이 파일을 쓴다. 도시별 장소 수도 regions.json(placeCounts)에 있다.
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
/** 관문 이름(버스 · 항공 · 배 관문이 따로 있을 때). REGION_HUB의 busKo · busEn · airKo · airEn · shipKo · shipEn */
export type PlannerHub = RegionHub & {
  busKo?: string;
  busEn?: string;
  airKo?: string;
  airEn?: string;
  shipKo?: string;
  shipEn?: string;
};

/** 도시 → 광역 관문. Tour Planner.dc.html REGION_HUB 중 장소가 있는 도시. 수단은 지역거점.csv(전철권 metro 포함). 관문이 없는 도시도 있다 */
export const CITY_HUBS = regionsData.hubs as Readonly<
  Record<string, PlannerHub>
>;

/**
 * 출발지 한 곳. route: 섬 항로 전용 항구(jeju · ulleung), sailMin: 울릉 항로 고정 항해 시간(분),
 * arrKo · arrEn: 울릉 도착 항구(PoC ORIGINS)
 */
export type PlannerOrigin = Origin & {
  route?: string;
  sailMin?: number;
  arrKo?: string;
  arrEn?: string;
};

/** 출발지(역 · 터미널 · 공항 · 항구). Tour Planner.dc.html ORIGINS 순서 그대로. 수단은 출발지.csv(전철 metro 포함) */
export const PLANNER_ORIGINS = regionsData.origins as Readonly<
  Record<string, PlannerOrigin>
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

/** 권역 대표 도시. 도시 고르기의 권역 묶음에서 맨 앞에 둔다 (cityGroups PIN) */
const REGION_PIN: Readonly<Record<RegionKey, string>> = {
  capital: "서울",
  gangwon: "강릉",
  chungcheong: "대전",
  daegyeong: "대구",
  dongnam: "부산",
  honam: "전주",
  jeju: "제주",
};

/**
 * 도시 고르기의 도시별 장소 수 (pickCity 기준. 전국에만 속한 장소는 세지 않는다).
 * scripts/build-planner.mjs가 regions.json placeCounts에 적는다(places.json 순서). 도시 고르기 · 여행 정보 탭이
 * 장소 수 때문에 places.json을 import하지 않게 하려고서다. places.json과 맞는지는 data.test.ts가 확인한다
 */
export const PLACE_COUNT_BY_CITY: ReadonlyMap<string, number> = new Map(
  Object.entries(regionsData.placeCounts as Readonly<Record<string, number>>),
);

export type CityGroup = {
  /** 권역 key. 권역에 없는 도시 묶음은 "etc" */
  key: RegionKey | "etc";
  region: Region | null;
  /** 장소가 있는 도시. 권역 대표 도시 먼저, 나머지는 장소 수 많은 순(같으면 REG 순서) */
  cities: readonly string[];
};

/**
 * 도시들을 권역별로 묶는다 (Tour Planner.dc.html cityGroups). 권역 순서는 REGIONS, 권역 안은 대표 도시 먼저 · 나머지는 count 많은 순
 * (같으면 REG 순서). 여러 권역에 든 도시는 앞 권역에만 넣고, 어느 권역에도 없는 도시는 마지막 "etc" 묶음. 도시가 없는 권역은 빠진다.
 * 투어 플래너 도시 고르기(장소 수)와 홈 시티투어 지역별 검색(노선 수)이 쓴다
 */
export function groupCities(
  cities: Iterable<string>,
  count: (city: string) => number,
): CityGroup[] {
  const pool = new Set(cities);
  const placed = new Set<string>();
  const out: CityGroup[] = [];
  for (const r of REGIONS) {
    const inRegion = r.cities.filter((c) => pool.has(c) && !placed.has(c));
    inRegion.forEach((c) => placed.add(c));
    const pin = REGION_PIN[r.key];
    const sorted = [...inRegion].sort((a, b) =>
      a === pin ? -1 : b === pin ? 1 : count(b) - count(a),
    );
    if (sorted.length > 0) out.push({ key: r.key, region: r, cities: sorted });
  }
  const rest = [...pool].filter((c) => !placed.has(c));
  if (rest.length > 0) out.push({ key: "etc", region: null, cities: rest });
  return out;
}

/** 도시 고르기 묶음 (Tour Planner.dc.html cityGroups). 장소가 있는 도시만 */
export const CITY_GROUPS: readonly CityGroup[] = groupCities(
  PLACE_COUNT_BY_CITY.keys(),
  (c) => PLACE_COUNT_BY_CITY.get(c) ?? 0,
);

/** 장소가 하나 이상 있는 도시인지 (?city= 검사) */
export function isPlannerCity(value: unknown): value is string {
  return typeof value === "string" && PLACE_COUNT_BY_CITY.has(value);
}
