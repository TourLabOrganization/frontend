import { describe, expect, it } from "vitest";
import { PLANNER_PLACES } from "../planner/data";
import { POPULAR_CITIES } from "../../lib/tour";
import { POPULAR_FALLBACK, popularFallback } from "./popular-fallback";

describe("인기 관광지 수기 목록 (scripts/build-popular-fallback.mjs)", () => {
  it("홈 칩 도시 10곳마다 10곳, 모두 그 도시의 플래너 장소(숙박 제외)이고 겹치지 않는다", () => {
    const byId = new Map(PLANNER_PLACES.map((p) => [p.id, p]));
    expect(Object.keys(POPULAR_FALLBACK.cities).sort()).toEqual(
      [...POPULAR_CITIES].sort(),
    );
    expect(POPULAR_FALLBACK.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const city of POPULAR_CITIES) {
      const list = popularFallback(city);
      expect(list, city).toHaveLength(10);
      expect(new Set(list.map((x) => x.id)).size, city).toBe(10);
      for (const item of list) {
        const p = byId.get(item.id);
        expect(p, `${city} ${item.id}`).toBeDefined();
        expect(p?.locKo, item.id).toBe(city);
        expect(p?.cat, item.id).not.toBe("stay");
        expect(item.ko, item.id).toBe(p?.ko);
        expect(item.en, item.id).toBe(p?.en);
        expect(item.evidence.length, item.id).toBeGreaterThan(0);
      }
    }
  });

  it("데이터랩 전체 상위 관광지가 그 도시 목록에 든다", () => {
    const ids = (c: string) => popularFallback(c).map((x) => x.id);
    expect(ids("서울")).toContain("ro17"); // 코엑스
    expect(ids("경주")[0]).toBe("gjx1"); // 불국사
    expect(ids("인천")[0]).toBe("nax172"); // 을왕리해수욕장
    expect(popularFallback("없는도시")).toEqual([]);
  });
});
