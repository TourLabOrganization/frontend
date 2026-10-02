import { straightKm } from "../course/schedule";
import { isStay, STAY_RADIUS_KM, type StaySample } from "./stays";

// 여행 정보 탭 「{도시} 숙소」의 순수 계산. 코스 빌더의 「그날 밤 숙소」(stays.ts, 날짜 · 기준점 기준)와 달리
// 고른 도시 전체의 숙소를 도심(regions.json 도시 좌표)에서 가까운 순으로 늘어놓는다:
//  - 앱 장소 목록의 숙박 장소(cat === "stay") 중 그 도시 것(pickCity, 없으면 locKo) 모두
//  - 숙소 표본(data/stays.json, 「예시 — 실제 예약 정보 아님」): 그 도시 region key(regions.json 영어 이름을 소문자로)의 표본이 있으면 그것,
//    없으면(영어 이름이 없는 도시 등) 도심 25km 안의 표본. 가까운 순 최대 4곳

/** 「{도시} 숙소」에 보이는 표본 수 */
export const INFO_SAMPLE_LIMIT = 4;

type LatLng = { lat: number; lng: number };

export type CityStays<P> = {
  /** 앱 장소 목록의 숙박 장소. 도심에서 가까운 순 */
  own: { place: P; km: number }[];
  /** 숙소 표본. 그 도시 region의 것(없으면 도심 25km 안) 가까운 순 최대 4곳 */
  samples: { sample: StaySample; km: number }[];
};

export function cityStays<
  P extends LatLng & { cat: string; locKo: string; pickCity?: string },
>(
  city: string,
  center: LatLng | null,
  places: readonly P[],
  samples: readonly StaySample[],
  /** 도시 영어 이름(regions.json). 표본 region key와 맞춘다 */
  cityEn = "",
): CityStays<P> {
  const km = (p: LatLng) => (center ? straightKm(center, p) : 0);
  const own = places
    .filter((p) => isStay(p) && (p.pickCity ?? p.locKo) === city)
    .map((place) => ({ place, km: km(place) }))
    .sort((a, b) => a.km - b.km);
  const key = cityEn.toLowerCase().replace(/\s+/g, "");
  const withKm = (list: readonly StaySample[]) =>
    list
      .map((sample) => ({ sample, km: km(sample) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, INFO_SAMPLE_LIMIT);
  const ofRegion = key ? samples.filter((x) => x.region === key) : [];
  const near =
    ofRegion.length > 0
      ? withKm(ofRegion)
      : center
        ? withKm(samples.filter((x) => km(x) <= STAY_RADIUS_KM))
        : [];
  return { own, samples: near };
}
