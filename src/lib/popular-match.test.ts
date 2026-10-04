import { describe, expect, it } from "vitest";
import { PLANNER_PLACES } from "../features/planner/data";
import { POPULAR_MATCH, pinnedPlaceId, popularMatchKey } from "./popular-match";
import { matchPlace, nameScore } from "./tour-popular";

describe("인기 관광지 수기 대조표(popular-match.ts)", () => {
  const byId = new Map(PLANNER_PLACES.map((p) => [p.id, p]));

  it("적힌 장소는 모두 플래너 장소(숙박 아님)이고 도시가 맞다. 키가 겹치지 않는다", () => {
    const keys = new Set<string>();
    for (const pin of POPULAR_MATCH) {
      const p = byId.get(pin.id);
      expect(p, `${pin.city} ${pin.name} → ${pin.id}`).toBeDefined();
      expect(p?.cat, pin.id).not.toBe("stay");
      expect(p?.locKo, pin.id).toBe(pin.city);
      const key = popularMatchKey(pin.city, pin.name);
      expect(keys.has(key), key).toBe(false);
      keys.add(key);
    }
  });

  it("이름 규칙으로 이어지는 이름은 적지 않는다(표는 규칙이 놓친 곳만)", () => {
    for (const pin of POPULAR_MATCH) {
      const p = byId.get(pin.id)!;
      expect(
        nameScore(pin.name, p.ko, pin.city),
        `${pin.name} ~ ${p.ko}`,
      ).toBeLessThan(2);
    }
  });

  it("pinnedPlaceId: 괄호 · 공백 · 가운뎃점 차이는 같은 키, 다른 도시는 없음", () => {
    expect(pinnedPlaceId("서울", "헌릉과 인릉")).toBe("ctm3debe815");
    expect(pinnedPlaceId("서울", "헌릉과인릉")).toBe("ctm3debe815");
    expect(pinnedPlaceId("부산", "헌릉과 인릉")).toBeNull();
    expect(pinnedPlaceId("서울", "경복궁")).toBeNull();
  });

  it("matchPlace는 대조표를 규칙보다 먼저 보고, 시군구가 달라도 적힌 장소를 돌려준다", () => {
    const places = [
      { id: "a", ko: "북악스카이웨이 팔각정", locKo: "서울", cat: "heal" },
      { id: "kdx35", ko: "북악스카이웨이 팔각정", locKo: "서울", cat: "heal" },
    ] as never[];
    expect(
      matchPlace(
        { name: "팔각정북악스카이", signgu: "11110" },
        "서울",
        places,
        () => "11290",
      )?.id,
    ).toBe("kdx35");
    // 대조표 장소가 풀에 없으면 규칙으로
    expect(
      matchPlace(
        { name: "팔각정북악스카이", signgu: "" },
        "서울",
        places.slice(0, 1),
        () => "",
      ),
    ).toBeNull();
  });
});
