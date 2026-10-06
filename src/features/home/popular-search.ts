// 홈 「지금 인기 관광지」 검색칸(춘천 칩 자리, 2026-10-06): 관광지 50곳 이상인 도시(POPULAR_SEARCH_CITIES)를 이름으로 찾는다.
// 테스트(vitest)가 "@/" 경로를 풀지 못해 상대 경로로 import한다.
import { cityName } from "../planner/regions";
import {
  POPULAR_CITIES,
  POPULAR_SEARCH_CITIES,
  type PopularCity,
} from "../../lib/tour";

/** 검색칸: 화면 언어 이름 · 한국어 이름에 검색어가 든 도시(대소문자 · 공백 무시). 빈 검색어면 칩에 없는 도시 */
export function searchCities(
  q: string,
  locale: string,
  names: Parameters<typeof cityName>[2],
): PopularCity[] {
  const key = q.toLowerCase().replace(/\s+/g, "");
  if (!key)
    return POPULAR_SEARCH_CITIES.filter(
      (c) => !(POPULAR_CITIES as readonly string[]).includes(c),
    );
  return POPULAR_SEARCH_CITIES.filter((c) =>
    [c, cityName(c, locale, names)].some((n) =>
      n.toLowerCase().replace(/\s+/g, "").includes(key),
    ),
  );
}
