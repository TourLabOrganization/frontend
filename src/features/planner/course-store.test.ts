import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEP_TIMES,
  parseSettings,
  planContentKey,
  planSaveSettings,
  moveAt,
  parseCourse,
  RET_TIMES,
  withKnownPlaces,
} from "./course-store";
import { findPlace } from "./data";
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

describe("플랜 저장값 (PoC planSave)", () => {
  const course = {
    ...DEFAULT_SETTINGS,
    name: " 경주 당일 ",
    origin: "yongsan",
  };

  it("날짜를 고르지 않았으면 날짜 없이(null) 저장한다", () => {
    const s = planSaveSettings(course);
    expect(s.startDate).toBeNull();
    expect(s.endDate).toBeNull();
    expect(s.name).toBe("경주 당일");
  });

  it("고른 날짜는 고른 그대로 저장한다(귀가일을 고르는 중이면 귀가일 null)", () => {
    expect(
      planSaveSettings({ ...course, startDate: "2026-10-03", endDate: null }),
    ).toMatchObject({ startDate: "2026-10-03", endDate: null });
    expect(
      planSaveSettings({
        ...course,
        startDate: "2026-10-03",
        endDate: "2026-10-05",
      }),
    ).toMatchObject({ startDate: "2026-10-03", endDate: "2026-10-05" });
  });

  it("날짜 없이 저장한 플랜은 다른 날 불러와도 날짜 없이 읽히고 「저장됨」으로 비교된다", () => {
    const saved = JSON.parse(
      JSON.stringify({ ...planSaveSettings(course), stayOv: { gj2: 90 } }),
    ) as Record<string, unknown>;
    const loaded = parseSettings(saved);
    expect(loaded.startDate).toBeNull();
    expect(loaded.endDate).toBeNull();
    expect(planContentKey(["gj2"], planSaveSettings(loaded), { gj2: 90 })).toBe(
      planContentKey(["gj2"], planSaveSettings(course), { gj2: 90 }),
    );
  });

  it("날짜가 있는 옛 플랜은 그 날짜로 불러오고 같은 값이면 「저장됨」", () => {
    const old = {
      ...DEFAULT_SETTINGS,
      name: "옛 플랜",
      startDate: "2026-09-01",
      endDate: "2026-09-02",
    };
    const loaded = parseSettings(JSON.parse(JSON.stringify(old)));
    expect(loaded).toMatchObject({
      startDate: "2026-09-01",
      endDate: "2026-09-02",
    });
    expect(planContentKey(["a"], planSaveSettings(loaded), {})).toBe(
      planContentKey(["a"], planSaveSettings(old), {}),
    );
    // 날짜가 다르면 다른 플랜
    expect(planContentKey(["a"], planSaveSettings(loaded), {})).not.toBe(
      planContentKey(["a"], planSaveSettings(course), {}),
    );
  });

  it("체류 시간은 키 순서와 무관하게 비교한다", () => {
    const s = planSaveSettings(course);
    expect(planContentKey(["a"], s, { b: 30, a: 60 })).toBe(
      planContentKey(["a"], s, { a: 60, b: 30 }),
    );
  });
});

describe("데이터에 없는 id가 섞인 저장값", () => {
  const isKnown = (id: string) => findPlace(id) !== undefined;
  const raw = JSON.stringify({
    city: "경주",
    placeIds: ["gj2", "gone-1", "gj3", "gone-2", "gj4"],
  });

  it("읽을 때 데이터에 없는 id를 걸러 화면 목록과 같은 순번 · 개수가 된다", () => {
    const course = withKnownPlaces(parseCourse(raw), isKnown);
    expect(course.placeIds).toEqual(["gj2", "gj3", "gj4"]);
    expect(course.city).toBe("경주");
  });

  it("다 없어졌으면 도시도 비운다", () => {
    const course = withKnownPlaces(
      parseCourse(JSON.stringify({ city: "경주", placeIds: ["gone"] })),
      isKnown,
    );
    expect(course.placeIds).toEqual([]);
    expect(course.city).toBeNull();
  });

  it("화면 순번으로 옮기면 화면에 보이는 장소끼리 자리가 바뀐다", () => {
    const { placeIds } = withKnownPlaces(parseCourse(raw), isKnown);
    // 화면 2번째(gj3)를 위로 — 걸러내지 않은 저장 순번이면 gone-1이 움직였다
    expect(moveAt(placeIds, 1, 0)).toEqual(["gj3", "gj2", "gj4"]);
    expect(moveAt(placeIds, 1, 2)).toEqual(["gj2", "gj4", "gj3"]);
    // 범위 밖은 그대로
    expect(moveAt(placeIds, 0, -1)).toEqual(placeIds);
    expect(moveAt(placeIds, 2, 3)).toEqual(placeIds);
  });
});
