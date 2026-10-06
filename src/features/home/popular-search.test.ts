import { describe, expect, it } from "vitest";
import { POPULAR_CITIES, POPULAR_SEARCH_CITIES } from "../../lib/tour";
import { searchCities } from "./popular-search";

const names = {
  cities: { 여수: "Yeosu", 창원: "Changwon" },
  places: {},
  regions: {},
} as never;

describe("인기 관광지 검색칸", () => {
  it("빈 검색어면 칩에 없는 도시(관광지 50곳 이상)", () => {
    const rest = searchCities("", "ko", names);
    expect(rest).toEqual(
      POPULAR_SEARCH_CITIES.filter(
        (c) => !(POPULAR_CITIES as readonly string[]).includes(c),
      ),
    );
    expect(rest).toContain("여수");
    expect(rest).not.toContain("서울");
  });

  it("한국어 이름 · 화면 언어 이름(대소문자 · 공백 무시)으로 찾는다. 50곳 미만 도시는 없다", () => {
    expect(searchCities("여", "ko", names)).toEqual(["여수"]);
    expect(searchCities("yeo su", "en", names)).toEqual(["여수"]);
    expect(searchCities("여수", "en", names)).toEqual(["여수"]);
    expect(searchCities("춘천", "ko", names)).toEqual([]);
    expect(searchCities("없는도시", "ko", names)).toEqual([]);
  });
});
