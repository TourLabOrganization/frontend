// 홈 「지금 인기 관광지」 ↔ 플래너 장소 연결의 수기 대조표.
// 집중률 관광지 이름(tAtsNm, 한국관광 데이터랩 인기 관광지와 같은 명단)이 이름 규칙(tour-popular.ts nameScore: 같음 · 한쪽이 다른 쪽을 품음,
// 표기 차이 맞춤)으로도 앱 장소와 이어지지 않을 때 여기에 적는다. matchPlace(홈) · matchInPool(모으기 tour-collect)이 규칙보다 먼저 본다.
// 규칙으로 이어지는 이름은 적지 않는다(popular-match.test가 확인한다). 데이터랩 교차표(Data-Analytics age_upgrade/data/datalab_place_crosswalk.csv)와 같은 짝이다.
import { crowdName } from "./tour-crowd";

export type PopularPin = {
  /** 홈 칩 도시 또는 플래너 도시(장소의 locKo) */
  city: string;
  /** 집중률 · 데이터랩에 적힌 관광지 이름 */
  name: string;
  /** 플래너 장소 id */
  id: string;
  /** 앱 장소 이름(사람이 읽는 메모) */
  note: string;
};

export const POPULAR_MATCH: readonly PopularPin[] = [
  {
    city: "서울",
    name: "팔각정북악스카이",
    id: "kdx35",
    note: "북악스카이웨이 팔각정",
  },
  { city: "서울", name: "헌릉과 인릉", id: "ctm3debe815", note: "헌인릉" },
  {
    city: "서울",
    name: "롯데월드잠실점",
    id: "kdx11",
    note: "잠실 롯데월드 어드벤처",
  },
];

/** 대조표 키: 도시 | 괄호 · 공백 · 가운뎃점을 뺀 이름 */
export function popularMatchKey(city: string, name: string): string {
  return `${city}|${crowdName(name)}`;
}

const PINNED: ReadonlyMap<string, string> = new Map(
  POPULAR_MATCH.map((p) => [popularMatchKey(p.city, p.name), p.id]),
);

/** 대조표에 적힌 장소 id. 없으면 null */
export function pinnedPlaceId(city: string, name: string): string | null {
  return PINNED.get(popularMatchKey(city, name)) ?? null;
}
