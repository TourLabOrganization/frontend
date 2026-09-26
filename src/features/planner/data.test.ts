import { describe, expect, it } from "vitest";
import {
  CITY_GROUPS,
  CITY_HUBS,
  CITY_INFO,
  PLACE_COUNT_BY_CITY,
  PLANNER_ORIGINS,
  PLANNER_PLACES,
  placesInScope,
  REGION_KEYS,
  REGIONS,
} from "./data";

// Tour Planner.dc.html cityGroups의 REG: 권역별 도시 수
const REG_CITY_COUNT = {
  capital: 15,
  gangwon: 16,
  chungcheong: 19,
  daegyeong: 15,
  dongnam: 19,
  honam: 27,
  jeju: 2,
};

describe("플래너 데이터", () => {
  it("장소는 1,171곳이고 id가 겹치지 않는다", () => {
    expect(PLANNER_PLACES).toHaveLength(1171);
    expect(new Set(PLANNER_PLACES.map((p) => p.id)).size).toBe(1171);
  });

  it("도시 고르기 장소 수가 목업(PoC cityRows)과 같다", () => {
    expect(
      Object.fromEntries(
        ["서울", "부산", "제주", "영월", "경주", "거제"].map((c) => [
          c,
          PLACE_COUNT_BY_CITY.get(c),
        ]),
      ),
    ).toEqual({
      서울: 87,
      부산: 72,
      제주: 86,
      영월: 18,
      경주: 40,
      거제: 22,
    });
  });

  it("도시 고르기 장소 수 + 전국에만 속한 장소 = 전체, 도시 보기는 그 도시 장소만", () => {
    const sum = [...PLACE_COUNT_BY_CITY.values()].reduce((a, b) => a + b, 0);
    const nationOnly = PLANNER_PLACES.filter((p) => !p.pickCity).length;
    expect(sum + nationOnly).toBe(1171);
    for (const [city, n] of PLACE_COUNT_BY_CITY) {
      const list = placesInScope({ kind: "city", city });
      expect(list, city).toHaveLength(n);
      expect(list.every((p) => p.locKo === city)).toBe(true);
    }
    expect(placesInScope({ kind: "nation", region: null })).toHaveLength(1171);
  });

  it("권역 묶음 장소 수는 그대로다", () => {
    const byRegion = Object.fromEntries(
      REGION_KEYS.map((k) => [
        k,
        placesInScope({ kind: "nation", region: k }).length,
      ]),
    );
    expect(byRegion).toEqual({
      capital: 218,
      gangwon: 133,
      chungcheong: 136,
      daegyeong: 152,
      dongnam: 281,
      honam: 150,
      jeju: 101,
    });
  });

  it("도시 고르기 묶음: 권역 대표 도시가 먼저, 나머지는 장소 수 많은 순, 모든 도시가 한 번씩", () => {
    const pins = ["서울", "강릉", "대전", "대구", "부산", "전주", "제주"];
    for (const g of CITY_GROUPS) {
      if (g.key === "etc") continue;
      const pin = pins.find((c) => g.cities.includes(c));
      if (pin) expect(g.cities[0], g.key).toBe(pin);
      const rest = g.cities.filter((c) => c !== pin);
      const counts = rest.map((c) => PLACE_COUNT_BY_CITY.get(c)!);
      expect(counts, g.key).toEqual([...counts].sort((a, b) => b - a));
    }
    const all = CITY_GROUPS.flatMap((g) => g.cities);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(PLACE_COUNT_BY_CITY.size);
  });

  it("출발지는 PoC ORIGINS 61곳이다", () => {
    expect(Object.keys(PLANNER_ORIGINS)).toHaveLength(61);
    expect(PLANNER_ORIGINS.seoul.modes).toEqual(["ktx"]);
  });

  it("모든 장소에 도시와 권역이 있고, 도시는 그 권역의 목록에 있다", () => {
    const regionOf = new Map(
      REGIONS.flatMap((r) => r.cities.map((c) => [c, r.key] as const)),
    );
    const missing = PLANNER_PLACES.filter(
      (p) => !p.locKo || !p.macro || regionOf.get(p.locKo) !== p.macro,
    );
    expect(missing).toEqual([]);
  });

  it("좌표는 한국 안(위도 33~39 · 경도 124~132)이다", () => {
    const outside = PLANNER_PLACES.filter(
      (p) => p.lat < 33 || p.lat > 39 || p.lng < 124 || p.lng > 132,
    );
    expect(outside).toEqual([]);
  });

  it("권역은 7개이고 권역별 도시 수가 REG와 같다", () => {
    expect(REGIONS.map((r) => r.key)).toEqual([...REGION_KEYS]);
    expect(
      Object.fromEntries(REGIONS.map((r) => [r.key, r.cities.length])),
    ).toEqual(REG_CITY_COUNT);
  });

  it("장소가 있는 도시는 가운데 좌표와 관문이 있다", () => {
    for (const city of PLACE_COUNT_BY_CITY.keys()) {
      expect(CITY_INFO[city]?.lat, city).toBeTypeOf("number");
      expect(CITY_INFO[city]?.lng, city).toBeTypeOf("number");
      expect(CITY_HUBS[city], city).toBeDefined();
    }
  });

  it("체류 · 운영시간 필드가 일정 모듈이 읽는 꼴이다", () => {
    for (const p of PLANNER_PLACES) {
      expect(Number.isFinite(p.min), p.id).toBe(true);
      if (p.open !== null && p.close !== null)
        expect(p.close, p.id).toBeGreaterThan(p.open);
    }
  });
});
