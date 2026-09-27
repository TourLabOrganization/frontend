import { describe, expect, it } from "vitest";
import {
  dayInsertIndex,
  insertAfter,
  parseStayOverrides,
  setStayOverride,
  withStayOverrides,
} from "./course-edit";

describe("setStayOverride (PoC setStay)", () => {
  it("추천값과 다르면 둔다", () => {
    expect(setStayOverride({}, "a", 60, 75)).toEqual({ a: 75 });
  });
  it("추천값과 같거나 null이면 지운다", () => {
    expect(setStayOverride({ a: 75 }, "a", 60, 60)).toEqual({});
    expect(setStayOverride({ a: 75, b: 30 }, "a", 60, null)).toEqual({
      b: 30,
    });
  });
  it("15~600분으로 자른다", () => {
    expect(setStayOverride({}, "a", 30, 0)).toEqual({ a: 15 });
    expect(setStayOverride({}, "a", 30, 615)).toEqual({ a: 600 });
  });
});

describe("withStayOverrides", () => {
  it("덮어쓴 장소만 min을 바꾼다", () => {
    const places = [
      { id: "a", min: 60 },
      { id: "b", min: 30 },
    ];
    expect(withStayOverrides(places, { b: 90 })).toEqual([
      { id: "a", min: 60 },
      { id: "b", min: 90 },
    ]);
    expect(places[1].min).toBe(30);
  });
});

describe("parseStayOverrides", () => {
  it("범위 밖 · 숫자 아님은 버린다", () => {
    expect(
      parseStayOverrides({ a: 30, b: "45", c: 5, d: 700, e: 22.5 }),
    ).toEqual({ a: 30 });
    expect(parseStayOverrides(null)).toEqual({});
    expect(parseStayOverrides([1])).toEqual({});
  });
});

describe("insertAfter (PoC addCourseAt)", () => {
  const ids = ["a", "b", "c", "d"];
  it("그 자리 뒤에 넣는다", () => {
    expect(insertAfter(ids, "x", 1)).toEqual(["a", "b", "x", "c", "d"]);
  });
  it("null · 음수면 맨 뒤", () => {
    expect(insertAfter(ids, "x", null)).toEqual(["a", "b", "c", "d", "x"]);
    expect(insertAfter(ids, "x", -1)).toEqual(["a", "b", "c", "d", "x"]);
  });
  it("이미 있으면 빼고 넣는다(자리는 뺀 뒤 목록 기준)", () => {
    expect(insertAfter(ids, "a", 2)).toEqual(["b", "c", "d", "a"]);
    expect(insertAfter(ids, "d", 0)).toEqual(["a", "d", "b", "c"]);
  });
});

describe("dayInsertIndex", () => {
  it("그 날 마지막 경유지 자리", () => {
    expect(dayInsertIndex(["a", "b", "c"], ["a", "b"])).toBe(1);
  });
  it("빈 날은 null(맨 뒤)", () => {
    expect(dayInsertIndex(["a", "b", "c"], [])).toBe(null);
  });
});
