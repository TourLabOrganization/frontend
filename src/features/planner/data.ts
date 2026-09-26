import type { Place, RegionHub } from "@/features/course/places";
import placesData from "./data/places.json";
import regionsData from "./data/regions.json";

// 투어 플래너의 장소 · 권역 · 도시 데이터.
// data/places.json:  Tour-Navigator-App/체류시간 산정/체류시간_장소별.csv(체류 · 운영시간 · 플래그)와
//                    Tour Planner.dc.html DATA(설명 · 사진)를 id로 합친 장소 1,171곳
// data/regions.json: Tour Planner.dc.html의 REG(권역 7개) · CITY_NAME(도시 영어 이름) · REGION_HUB(관문),
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

/** 지역 탭에 따로 칸이 있는 도시 (목업: 전국 · 서울 · 부산 · 제주 · 도시 ▾) */
export const FEATURED_CITIES = ["서울", "부산", "제주"] as const;

/** 도시별 장소 수 */
export const PLACE_COUNT_BY_CITY: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (const p of PLANNER_PLACES) m.set(p.locKo, (m.get(p.locKo) ?? 0) + 1);
  return m;
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
    return PLANNER_PLACES.filter((p) => p.locKo === scope.city);
  const { region } = scope;
  return region
    ? PLANNER_PLACES.filter((p) => p.macro === region)
    : PLANNER_PLACES;
}

export function findPlace(id: string): PlannerPlace | undefined {
  return PLANNER_PLACES.find((p) => p.id === id);
}
