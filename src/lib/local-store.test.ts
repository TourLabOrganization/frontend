import { describe, expect, it } from "vitest";
import {
  isPlaceSaved,
  parseSavedPlaces,
  type SavedPlace,
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
