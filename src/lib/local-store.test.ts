import { describe, expect, it } from "vitest";
import {
  isPlaceSaved,
  overwritePlannerPlan,
  overwriteThemePlan,
  type PlannerSavedPlan,
  parsePlannerPlans,
  parseSavedPlaces,
  parseSavedPlans,
  removePlannerPlan,
  type SavedPlace,
  type SavedPlan,
  toggleSavedPlace,
} from "./local-store";

const name = { ko: "청령포", en: "Cheongnyeongpo" };

describe("parseSavedPlaces", () => {
  it("비었거나 JSON이 아니면 빈 목록", () => {
    expect(parseSavedPlaces(null)).toEqual([]);
    expect(parseSavedPlaces("")).toEqual([]);
    expect(parseSavedPlaces("{")).toEqual([]);
    expect(parseSavedPlaces('{"id":"yw1"}')).toEqual([]);
  });

  it("모양이 틀린 항목만 버린다", () => {
    const ok: SavedPlace = {
      id: "yw1",
      source: "kings-warden",
      savedAt: 10,
      name,
    };
    const raw = JSON.stringify([
      ok,
      { id: "yw2", source: "kings-warden", savedAt: "10", name },
      { id: "yw3", source: "kings-warden", savedAt: 10 },
      { id: "yw4", savedAt: 10, name },
      "yw5",
    ]);
    expect(parseSavedPlaces(raw)).toEqual([ok]);
  });
});

describe("toggleSavedPlace", () => {
  it("없으면 저장 시각을 붙여 끝에 더하고, 있으면 뺀다", () => {
    const once = toggleSavedPlace(
      [],
      { id: "yw1", source: "kings-warden", name },
      100,
    );
    expect(once).toEqual([
      { id: "yw1", source: "kings-warden", savedAt: 100, name },
    ]);
    expect(isPlaceSaved(once, "yw1", "kings-warden")).toBe(true);
    const twice = toggleSavedPlace(
      once,
      { id: "yw1", source: "kings-warden", name },
      200,
    );
    expect(twice).toEqual([]);
  });

  it("같은 장소도 출처가 다르면 따로 저장한다", () => {
    const list = toggleSavedPlace(
      [{ id: "yw1", source: "kings-warden", savedAt: 1, name }],
      { id: "yw1", source: "planner", name },
      2,
    );
    expect(list.map((p) => p.source)).toEqual(["kings-warden", "planner"]);
    expect(isPlaceSaved(list, "yw1", "planner")).toBe(true);
    const removed = toggleSavedPlace(
      list,
      { id: "yw1", source: "planner", name },
      3,
    );
    expect(removed).toEqual([
      { id: "yw1", source: "kings-warden", savedAt: 1, name },
    ]);
  });
});

const plannerPlan = (id: string, savedAt: number): PlannerSavedPlan => ({
  kind: "planner",
  id,
  name: `플랜 ${id}`,
  city: "경주",
  placeIds: ["gj1"],
  settings: { name: `플랜 ${id}`, startDate: "2026-10-01" },
  savedAt,
});

describe("저장된 플랜 (tn.savedPlans)", () => {
  it("테마 · 플래너 두 종류가 한 배열에서 따로 읽힌다. 테마 이름은 있을 때만", () => {
    const raw = JSON.stringify([
      { slug: "kings-warden", a: "", plan: "classic", savedAt: 1 },
      { slug: "rescene", a: "x", plan: "trend", savedAt: 2, name: "가을" },
      { slug: "rescene", a: "x", plan: "quiet", savedAt: 3, name: 7 },
      plannerPlan("pl1", 4),
    ]);
    expect(parseSavedPlans(raw)).toEqual([
      { slug: "kings-warden", a: "", plan: "classic", savedAt: 1 },
      { slug: "rescene", a: "x", plan: "trend", savedAt: 2, name: "가을" },
      { slug: "rescene", a: "x", plan: "quiet", savedAt: 3 },
    ]);
    expect(parsePlannerPlans(raw).map((p) => p.id)).toEqual(["pl1"]);
  });

  it("플래너 플랜 덮어쓰기: 이름 · id는 그대로, 장소 · 설정 · 시각만 바꾼다", () => {
    const list = [plannerPlan("pl1", 1), plannerPlan("pl2", 2)];
    const next = overwritePlannerPlan(
      list,
      "pl2",
      {
        city: "거제",
        placeIds: ["gd1", "gd2"],
        settings: { name: "다른 이름", endDate: "2026-10-03" },
      },
      99,
    );
    expect(next[0]).toBe(list[0]);
    expect(next[1]).toEqual({
      kind: "planner",
      id: "pl2",
      name: "플랜 pl2",
      city: "거제",
      placeIds: ["gd1", "gd2"],
      settings: { name: "플랜 pl2", endDate: "2026-10-03" },
      savedAt: 99,
    });
  });

  it("플래너 플랜 삭제", () => {
    const list = [plannerPlan("pl1", 1), plannerPlan("pl2", 2)];
    expect(removePlannerPlan(list, "pl1").map((p) => p.id)).toEqual(["pl2"]);
  });

  it("테마 플랜 덮어쓰기: 이름은 남기고 조건 · 안을 바꾼다. 같은 코스가 둘이 되지 않는다", () => {
    const list: SavedPlan[] = [
      { slug: "rescene", a: "", plan: "classic", savedAt: 1, name: "첫 플랜" },
      { slug: "rescene", a: "", plan: "trend", savedAt: 2 },
    ];
    expect(
      overwriteThemePlan(
        list,
        { slug: "rescene", a: "", plan: "classic" },
        { slug: "rescene", a: "", plan: "trend" },
        9,
      ),
    ).toEqual([
      { slug: "rescene", a: "", plan: "trend", savedAt: 9, name: "첫 플랜" },
    ]);
  });
});
