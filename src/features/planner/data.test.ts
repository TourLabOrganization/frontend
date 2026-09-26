import { describe, expect, it } from "vitest";
import {
  CITY_HUBS,
  CITY_INFO,
  PLACE_COUNT_BY_CITY,
  PLANNER_PLACES,
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

  it("도시별 장소 수를 더하면 전체와 같다", () => {
    const sum = [...PLACE_COUNT_BY_CITY.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(PLANNER_PLACES.length);
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
