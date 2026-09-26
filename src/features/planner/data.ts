import type { Origin, Place, RegionHub } from "@/features/course/places";
import placesData from "./data/places.json";
import regionsData from "./data/regions.json";

// 투어 플래너의 장소 · 권역 · 도시 데이터.
// data/places.json:  Tour-Navigator-App/체류시간 산정/체류시간_장소별.csv(체류 · 운영시간 · 플래그)와
//                    Tour Planner.dc.html DATA(설명 · 사진)를 id로 합친 장소 1,171곳
// data/regions.json: Tour Planner.dc.html의 REG(권역 7개) · CITY_NAME(도시 영어 이름) · REGION_HUB(관문) · ORIGINS(출발지 61곳),
//                    도시 가운데 좌표(장소 좌표 평균)
// 둘 다 scripts/build-planner.mjs로 만든다. 손으로 고치지 않는다.
// 장소 필드는 course/places.ts의 Place와 같아서 일정 모듈(course/schedule.ts)이 그대로 쓴다.

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

export type PlannerPlace = Place & {
  /** 권역 key */
  macro: RegionKey;
  /**
   * 도시 고르기에서 속한 도시(Tour Planner.dc.html cityRows 규칙). 전국에만 속한 장소는 없다.
   * 전용 화면이 있는 도시(서울 · 부산 · 제주 · 영월 · 경주 · 거제)는 그 화면 장소만 이 값을 갖고,
   * 같은 도시의 전국 목록 장소는 전국 보기에만 들어간다. 지도 · 목록의 도시 필터는 이 값을 쓴다.
   * 일정 계산 · 코스의 도시는 실제 도시(locKo)를 쓴다
   */
  pickCity?: string;
  desc?: { ko?: string; en?: string };
  /** 사진 주소 (Wikimedia, 폭 960) */
  img?: string;
  imgCredit?: string;
};

export type Region = {
  key: RegionKey;
  ko: string;
  en: string;
  /** 권역의 도시(한국어 이름). REG 순서 그대로. 장소가 없는 도시도 들어 있다 */
  cities: readonly string[];
};

export type CityInfo = {
  /** 영어 이름. CITY_NAME에 없으면 빈 문자열 */
  en: string;
  /** 장소 좌표 평균. 장소가 없는 도시는 없다 */
  lat?: number;
  lng?: number;
};

export const PLANNER_PLACES = placesData as readonly PlannerPlace[];
export const REGIONS = regionsData.regions as readonly Region[];
export const CITY_INFO = regionsData.cities as Readonly<
  Record<string, CityInfo>
>;
/** 도시 → 광역 관문. Tour Planner.dc.html REGION_HUB 중 장소가 있는 도시 */
export const CITY_HUBS = regionsData.hubs as Readonly<
  Record<string, RegionHub>
>;

/** 출발지(역 · 터미널 · 공항 · 항구). Tour Planner.dc.html ORIGINS 순서 그대로 */
export const PLANNER_ORIGINS = regionsData.origins as Readonly<
  Record<string, Origin & { route?: string }>
>;

/** 지역 탭에 따로 칸이 있는 도시 (목업: 전국 · 서울 · 부산 · 제주 · 도시 ▾) */
export const FEATURED_CITIES = ["서울", "부산", "제주"] as const;

/** 도시 고르기에서 칩을 강조하는 주요 도시 (Tour Planner.dc.html cityGroups GOLD) */
export const MAJOR_CITIES: ReadonlySet<string> = new Set([
  "서울",
  "강릉",
  "경주",
  "부산",
  "전주",
  "제주",
]);

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

/** 도시 고르기의 도시별 장소 수 (pickCity 기준. 전국에만 속한 장소는 세지 않는다) */
export const PLACE_COUNT_BY_CITY: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (const p of PLANNER_PLACES)
    if (p.pickCity) m.set(p.pickCity, (m.get(p.pickCity) ?? 0) + 1);
  return m;
})();

export type CityGroup = {
  /** 권역 key. 권역에 없는 도시 묶음은 "etc" */
  key: RegionKey | "etc";
  region: Region | null;
  /** 장소가 있는 도시. 권역 대표 도시 먼저, 나머지는 장소 수 많은 순(같으면 REG 순서) */
  cities: readonly string[];
};

/** 도시 고르기 묶음 (Tour Planner.dc.html cityGroups). 장소가 없는 권역은 빠진다 */
export const CITY_GROUPS: readonly CityGroup[] = (() => {
  const placed = new Set<string>();
  const out: CityGroup[] = [];
  for (const r of REGIONS) {
    const cities = r.cities.filter(
      (c) => PLACE_COUNT_BY_CITY.has(c) && !placed.has(c),
    );
    cities.forEach((c) => placed.add(c));
    const pin = REGION_PIN[r.key];
    const count = (c: string) => PLACE_COUNT_BY_CITY.get(c) ?? 0;
    const sorted = [...cities].sort((a, b) =>
      a === pin ? -1 : b === pin ? 1 : count(b) - count(a),
    );
    if (sorted.length > 0) out.push({ key: r.key, region: r, cities: sorted });
  }
  const rest = [...PLACE_COUNT_BY_CITY.keys()].filter((c) => !placed.has(c));
  if (rest.length > 0) out.push({ key: "etc", region: null, cities: rest });
  return out;
})();

/** 장소가 하나 이상 있는 도시인지 (?city= 검사) */
export function isPlannerCity(value: unknown): value is string {
  return typeof value === "string" && PLACE_COUNT_BY_CITY.has(value);
}

export function findRegion(key: RegionKey): Region {
  return REGIONS.find((r) => r.key === key)!;
}

/** 화면 언어의 도시 이름. 영어 이름이 없으면 한국어 */
export function cityName(city: string, locale: string): string {
  return locale === "ko" ? city : CITY_INFO[city]?.en || city;
}

export function regionName(region: Pick<Region, "ko" | "en">, locale: string) {
  return locale === "ko" ? region.ko : region.en;
}

/** 권역 묶음 표시 자리: 권역 장소 좌표 평균 */
export const REGION_CENTER: Readonly<
  Record<RegionKey, { lat: number; lng: number }>
> = Object.fromEntries(
  REGION_KEYS.map((key) => {
    const ps = PLANNER_PLACES.filter((p) => p.macro === key);
    return [
      key,
      {
        lat: ps.reduce((s, p) => s + p.lat, 0) / ps.length,
        lng: ps.reduce((s, p) => s + p.lng, 0) / ps.length,
      },
    ];
  }),
) as Record<RegionKey, { lat: number; lng: number }>;

/** 지도 · 목록의 범위. 도시 하나, 전국의 권역 하나, 또는 전국 */
export type Scope =
  { kind: "city"; city: string } | { kind: "nation"; region: RegionKey | null };

export function placesInScope(scope: Scope): readonly PlannerPlace[] {
  if (scope.kind === "city")
    return PLANNER_PLACES.filter((p) => p.pickCity === scope.city);
  const { region } = scope;
  return region
    ? PLANNER_PLACES.filter((p) => p.macro === region)
    : PLANNER_PLACES;
}

export function findPlace(id: string): PlannerPlace | undefined {
  return PLANNER_PLACES.find((p) => p.id === id);
}
