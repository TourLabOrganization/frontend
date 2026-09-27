import { describe, expect, it } from "vitest";
import {
  dayMark,
  isPickable,
  monthCells,
  moveMonth,
  pickDate,
  shiftMonth,
} from "./calendar";

describe("pickDate (PoC calendarDays pick)", () => {
  it("첫 누름은 출발일, 귀가일은 비운다", () => {
    expect(pickDate({ start: null, end: null }, "2026-10-02")).toEqual({
      start: "2026-10-02",
      end: null,
    });
  });
  it("두 번째 누름이 늦은 날이면 귀가일", () => {
    expect(pickDate({ start: "2026-10-02", end: null }, "2026-10-04")).toEqual({
      start: "2026-10-02",
      end: "2026-10-04",
    });
  });
  it("두 번째 누름이 이른 날이면 둘을 바꾼다", () => {
    expect(pickDate({ start: "2026-10-04", end: null }, "2026-10-02")).toEqual({
      start: "2026-10-02",
      end: "2026-10-04",
    });
  });
  it("같은 날을 두 번 누르면 당일", () => {
    expect(pickDate({ start: "2026-10-02", end: null }, "2026-10-02")).toEqual({
      start: "2026-10-02",
      end: "2026-10-02",
    });
  });
  it("범위가 다 골라진 뒤 누르면 새 출발일부터 다시", () => {
    expect(
      pickDate({ start: "2026-10-02", end: "2026-10-04" }, "2026-10-10"),
    ).toEqual({ start: "2026-10-10", end: null });
  });
});

describe("isPickable", () => {
  it("귀가일을 고르는 중에는 상한을 넘는 날을 막는다", () => {
    const r = { start: "2026-10-01", end: null };
    expect(isPickable(r, "2026-10-14", 14)).toBe(true);
    expect(isPickable(r, "2026-10-15", 14)).toBe(false);
    expect(isPickable(r, "2026-09-18", 14)).toBe(true);
    expect(isPickable(r, "2026-09-17", 14)).toBe(false);
  });
  it("출발일을 고를 때는 막지 않는다", () => {
    expect(
      isPickable({ start: "2026-10-01", end: "2026-10-02" }, "2027-01-01", 14),
    ).toBe(true);
  });
});

describe("dayMark", () => {
  const r = { start: "2026-10-02", end: "2026-10-04" };
  it("범위의 양 끝과 안쪽", () => {
    expect(dayMark(r, "2026-10-02")).toBe("start");
    expect(dayMark(r, "2026-10-03")).toBe("inside");
    expect(dayMark(r, "2026-10-04")).toBe("end");
    expect(dayMark(r, "2026-10-05")).toBe(null);
  });
  it("출발일만 있거나 당일이면 single", () => {
    expect(dayMark({ start: "2026-10-02", end: null }, "2026-10-02")).toBe(
      "single",
    );
    expect(
      dayMark({ start: "2026-10-02", end: "2026-10-02" }, "2026-10-02"),
    ).toBe("single");
  });
});

describe("monthCells", () => {
  it("일요일부터 채우고 7의 배수로 끝낸다", () => {
    // 2026-10-01은 목요일
    const cells = monthCells(2026, 9);
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, "2026-10-01"]);
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(Boolean)).toHaveLength(31);
    expect(cells.filter(Boolean).at(-1)).toBe("2026-10-31");
  });
  it("윤년 2월", () => {
    expect(monthCells(2028, 1).filter(Boolean)).toHaveLength(29);
  });
});

describe("shiftMonth · moveMonth", () => {
  it("해를 넘긴다", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
  it("없는 날은 그 달 마지막 날", () => {
    expect(moveMonth("2026-01-31", 1)).toBe("2026-02-28");
    expect(moveMonth("2026-03-15", -1)).toBe("2026-02-15");
  });
});
