import type { Place } from "@/features/course/places";
import addedPlaces from "./data/added-places.json";
import placesData from "./data/places.json";
import { REGION_KEYS, type RegionKey } from "./regions";

// 투어 플래너의 장소와 장소로 계산하는 값(도시별 장소 수 · 도시 묶음 · 권역 가운데). 권역 · 도시 이름 · 관문 · 출발지는 regions.ts.
// data/places.json: Tour-Navigator-App/체류시간 산정/체류시간_장소별.csv(체류 · 운영시간 · 플래그 · 배지)와
//                   Tour Planner.dc.html DATA · 파생 데이터/장소.csv를 id로 합친 장소 3,109곳의 가벼운 필드(맥도날드 9곳은 빌드에서 뺀다, EXCLUDED).
//                   분류(cat) · 영어 이름 · 지정구역(vz) · 데이터랩 인기 순위(popRank)는 data-server places.json 값이다(scripts/data-server.mjs)
// 설명 · 사진 · 중일 이름 · 좌표 근거 · 카카오 장소 URL 같은 무거운 필드는 data/place-details.json에 따로 두고,
// 장소 시트를 열 때 Route Handler(/api/planner/places/[id])로 받는다(use-place-detail.ts). 이 파일은 그 JSON을 import하지 않는다.
// scripts/build-planner.mjs로 만든다. 손으로 고치지 않는다.
// data/added-places.json: 인기 관광지(한국관광공사 집중률)에서 모아 누적한 추가 장소(id pop<contentid>, scripts/add-popular-places.mjs ·
//                   lib/tour-collect.ts). places.json 뒤에 이어 붙어 지도 · 목록 · 코스 · 장소 시트가 앱 장소와 똑같이 쓴다.
//                   시군구 코드는 signgu.json, 무거운 필드는 place-details.json, 도시별 장소 수는 regions.json에 같이 넣는다
// 장소 필드는 course/places.ts의 Place와 같아서 일정 모듈(course/schedule.ts)이 그대로 쓴다.

export type PlannerPlace = Place & {
  /** 권역 key (PoC MACRO_OF) */
  macro: RegionKey;
  /**
   * 도시 고르기에서 속한 도시. 전용 화면 장소는 그 화면 도시, 전국 목록 장소는 locKo(값이 있으면 늘 locKo와 같다).
   * PoC cityRows와 달리 전용 화면이 있는 도시(서울 · 부산 · 제주 · 영월 · 경주 · 거제)의 전국 목록 장소도 그 도시에 넣는다
   * (대표 결정 2026-09-28). 전용 화면 묶음과 전국 목록에 함께 있는 같은 장소는 한쪽만 이 값을 갖는다(14곳이 없다, 전국 보기에만 들어간다).
   * 지도 · 목록의 도시 필터는 이 값을 쓴다.
   * 일정 계산 · 코스의 도시는 실제 도시(locKo)를 쓴다
   */
  pickCity?: string;
  /** 관광특구 · 관광단지 · 지정관광지 문구 (예: 「경주시 관광단지 (2008 지정)」, data-server zone). 관광특구 · 관광단지 배지가 쓴다 */
  vz?: string;
  /** 한국관광 데이터랩 인기관광지 순위(1~100, data-server popRank). 6개 지역 173곳만 있다 */
  popRank?: number;
};

export const PLANNER_PLACES: readonly PlannerPlace[] = [
  ...(placesData as PlannerPlace[]),
  ...(addedPlaces as PlannerPlace[]),
];
// 도시별 장소 수 · 도시 묶음 · 도시 검사는 regions.ts로 옮겼다(regions.json의 placeCounts로 센다).
// 도시 고르기 · 여행 정보 탭이 이 파일(places.json)을 import하지 않게 하려고서다. 예전 import 경로를 위해 다시 내보낸다
export {
  CITY_GROUPS,
  type CityGroup,
  isPlannerCity,
  PLACE_COUNT_BY_CITY,
} from "./regions";

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

const PLACE_IDS: ReadonlySet<string> = new Set(PLANNER_PLACES.map((p) => p.id));

/** 장소 데이터에 있는 id인지. 담은 코스에서 데이터에서 빠진 장소를 거를 때 쓴다(course-store usePlannerCourse) */
export function isPlannerPlace(id: string): boolean {
  return PLACE_IDS.has(id);
}
