import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEP_TIMES,
  parseSettings,
  RET_TIMES,
} from "./course-store";
import { isBusanLine } from "./metro";

describe("parseSettings", () => {
  it("옛 저장값(정상 값)은 그대로 읽는다", () => {
    const saved = {
      name: "경주 1박",
      startDate: "2026-10-03",
      endDate: "2026-10-04",
      origin: "yongsan",
      originEnd: "seoul",
      depTime: "07:30",
      retTime: "18:00",
      wideMode: "ktx",
      localMode: "driving",
      routePick: { 경주: "bus" },
      gwPick: { ktx: "yongsan" },
      metroLine: "1",
      metroOrigin: "서울역",
      metroEndLine: "B1",
      metroEnd: "서면",
      jejuResident: false,
    };
    expect(parseSettings(saved)).toEqual(saved);
  });

  it("출발 · 귀가 시각 목록의 처음과 끝 값을 읽는다", () => {
    expect(parseSettings({ depTime: "05:00", retTime: "23:30" })).toMatchObject(
      { depTime: "05:00", retTime: "23:30" },
    );
    expect(parseSettings({ depTime: "20:30", retTime: "10:00" })).toMatchObject(
      { depTime: "20:30", retTime: "10:00" },
    );
  });

  it("Object 원형의 키(constructor 등)는 출발지 · 관문으로 받지 않는다", () => {
    for (const key of [
      "constructor",
      "toString",
      "__proto__",
      "hasOwnProperty",
    ]) {
      const s = parseSettings({
        origin: key,
        originEnd: key,
        gwPick: { ktx: key, air: "gimpoAir" },
      });
      expect(s.origin).toBe(DEFAULT_SETTINGS.origin);
      expect(s.originEnd).toBe(DEFAULT_SETTINGS.originEnd);
      expect(s.gwPick).toEqual({ air: "gimpoAir" });
    }
  });

  it("화면에서 고를 수 없는 시각은 기본값", () => {
    for (const bad of ["99:99", "24:00", "08:15", "04:30", "8:00", ""]) {
      const s = parseSettings({ depTime: bad, retTime: bad });
      expect(s.depTime).toBe(DEFAULT_SETTINGS.depTime);
      expect(s.retTime).toBe(DEFAULT_SETTINGS.retTime);
    }
    // 출발 시각 목록에는 있지만 여행지 출발 시각 목록에는 없는 값
    expect(parseSettings({ retTime: "09:00" }).retTime).toBe(
      DEFAULT_SETTINGS.retTime,
    );
  });

  it("시각 목록은 PoC와 같다(출발 05:00–20:30 · 여행지 출발 10:00–23:30, 30분 간격)", () => {
    expect(DEP_TIMES[0]).toBe("05:00");
    expect(DEP_TIMES.at(-1)).toBe("20:30");
    expect(DEP_TIMES).toHaveLength(32);
    expect(RET_TIMES[0]).toBe("10:00");
    expect(RET_TIMES.at(-1)).toBe("23:30");
    expect(RET_TIMES).toHaveLength(28);
    expect(DEP_TIMES).toContain(DEFAULT_SETTINGS.depTime);
    expect(RET_TIMES).toContain(DEFAULT_SETTINGS.retTime);
  });
});

describe("isBusanLine", () => {
  it("부산 호선만 참이고 Object 원형의 키는 아니다", () => {
    expect(isBusanLine("B1")).toBe(true);
    expect(isBusanLine("1")).toBe(false);
    expect(isBusanLine("constructor")).toBe(false);
    expect(isBusanLine("toString")).toBe(false);
  });
});
