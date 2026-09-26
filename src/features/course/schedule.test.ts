import { describe, expect, it } from "vitest";
import gyeongjuNation from "./fixtures/gyeongju-nation.json";
import { DETOUR } from "./params";
import {
  makeLegFn,
  ORIGINS,
  PLACES_BY_THEME,
  type Place,
  REGION_HUB,
} from "./places";
import {
  accessMin,
  assignDays,
  autoCourse,
  dayWindows,
  fmtStay,
  openHours,
  straightKm,
  timeline,
} from "./schedule";

describe("체류 · 운영시간 (설명서 2 · 3장)", () => {
  it("체류 표기: 40 → 40m, 90 → 1h 30m, 0 → 0m", () => {
    expect(fmtStay(40)).toBe("40m");
    expect(fmtStay(90)).toBe("1h 30m");
    expect(fmtStay(120)).toBe("2h");
    expect(fmtStay(0)).toBe("0m");
  });

  it('openHours "09:00–18:00" → 540 · 1080', () => {
    expect(openHours({ hrs: "09:00–18:00" })).toEqual({
      open: 540,
      close: 1080,
    });
  });

  it("구분자 ~ · - 도 받는다", () => {
    expect(openHours({ hrs: "10:00~19:00" })).toEqual({
      open: 600,
      close: 1140,
    });
    expect(openHours({ hrs: "10:00-19:00" })).toEqual({
      open: 600,
      close: 1140,
    });
  });

  it("폐장 ≤ 개장이면 자정을 넘긴 것으로 보고 1440을 더한다", () => {
    expect(openHours({ hrs: "18:00–02:00" })).toEqual({
      open: 1080,
      close: 1560,
    });
  });

  it("패턴이 없으면 상시 개방(null)", () => {
    expect(openHours({ hrs: "상시 개방 · 무료" })).toBeNull();
    expect(openHours({ hrs: "15:00 IN / 11:00 OUT" })).toBeNull();
    expect(openHours({})).toBeNull();
  });
});

describe("일자 창 · 광역 접근 (설명서 4 · 5장)", () => {
  it("3일 · 08:00 출발 · 19:00 귀가 · 광역 150분 → [630, 720, 600]", () => {
    expect(
      dayWindows({ days: 3, depTime: "08:00", retTime: "19:00", accIn: 150 }),
    ).toEqual([630, 720, 600]);
  });

  it("서울역 → 신경주역 KTX: 보정 거리 약 366km, 접근 128분", () => {
    const origin = ORIGINS.seoul;
    const hub = REGION_HUB["경주"];
    expect(Math.round(straightKm(origin, hub) * DETOUR)).toBe(366);
    expect(accessMin(origin, hub, "ktx")).toBe(128);
  });
});

// 출처: Tour-Navigator-App/체류시간 산정/예시_일정_경주_2박3일.csv
// (export_stay_csv.js가 stay_schedule.js의 autoCourse + assignDays + timeline을 돌린 결과)
// 열: 일차, 순번, id, 이동(분), 개장대기(분), 체류(분), 도착, 출발
const GYEONGJU_EXPECTED: readonly [
  number,
  number,
  string,
  number,
  number,
  number,
  string,
  string,
][] = [
  [1, 1, "gj2", 0, 0, 40, "10:08", "10:48"],
  [1, 2, "gj4", 10, 2, 120, "11:00", "13:00"],
  [1, 3, "gj3", 23, 0, 70, "13:23", "14:33"],
  [1, 4, "gj6", 32, 0, 60, "15:05", "16:05"],
  [1, 5, "gj5", 32, 0, 240, "16:37", "20:37"],
  [2, 1, "gj7", 0, 60, 70, "10:00", "11:10"],
  [2, 2, "gjx1", 26, 0, 90, "11:36", "13:06"],
  [2, 3, "gjx5", 24, 0, 60, "13:30", "14:30"],
  [2, 4, "nax771", 40, 0, 70, "15:10", "16:20"],
  [2, 5, "gjx14", 58, 0, 60, "17:18", "18:18"],
  [2, 6, "gjx29", 48, 0, 40, "19:06", "19:46"],
  [2, 7, "gjx9", 16, 0, 40, "20:02", "20:42"],
  [3, 1, "gjx8", 0, 0, 50, "09:00", "09:50"],
  [3, 2, "nax773", 10, 0, 60, "10:00", "11:00"],
  [3, 3, "nax772", 101, 0, 70, "12:41", "13:51"],
  [3, 4, "nax825", 46, 0, 60, "14:37", "15:37"],
  [3, 5, "gjx18", 54, 0, 60, "16:31", "17:31"],
];

describe("통합: 경주 2박3일 예시 재현", () => {
  it("서울역 08:00 KTX 출발 · 19:00 귀가로 예시 CSV와 같은 일정이 나온다", () => {
    // export_stay_csv.js 3번 블록과 같은 조건
    const pool = gyeongjuNation as Place[];
    const legFn = makeLegFn("transit");
    const accIn = accessMin(ORIGINS.seoul, REGION_HUB["경주"], "ktx");
    const days = 3,
      depTime = "08:00",
      retTime = "19:00";
    const windows = dayWindows({ days, depTime, retTime, accIn });
    expect(accIn).toBe(128);
    expect(windows).toEqual([652, 720, 600]);

    const course = autoCourse(pool, {
      days,
      windows,
      regions: ["경주"],
      legFn,
      depTime,
      accIn,
      cityKo: "전국",
    });
    const { buckets } = assignDays(course, windows, legFn);
    const rows = timeline(course, buckets, legFn, { depTime, accIn }).map(
      (t) =>
        [
          t.day,
          t.order,
          t.id,
          t.move,
          t.wait,
          t.stay,
          t.arrive,
          t.leave,
        ] as const,
    );
    expect(rows).toEqual(GYEONGJU_EXPECTED);
  });
});

describe("장소 데이터", () => {
  const all = Object.values(PLACES_BY_THEME).flat();

  it("테마별 장소 수 (build-places.mjs 결과)", () => {
    expect(
      Object.fromEntries(
        Object.entries(PLACES_BY_THEME).map(([k, v]) => [k, v.length]),
      ),
    ).toEqual({
      "kings-warden": 18,
      "kpop-demon-hunters": 87,
      "jeju-k-drama": 86,
      "busan-film-trip": 72,
      "rescene-route": 92,
    });
  });

  it("저장된 개장 · 폐장은 openHours(원문)과 같다", () => {
    for (const p of [...all, ...(gyeongjuNation as Place[])]) {
      const oh = openHours(p);
      expect([p.id, p.open, p.close]).toEqual([
        p.id,
        oh?.open ?? null,
        oh?.close ?? null,
      ]);
    }
  });

  it("테마 안에서 id가 겹치지 않고, 자동코스후보는 체류 > 0 이고 숙박이 아니다", () => {
    for (const list of Object.values(PLACES_BY_THEME)) {
      expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
      for (const p of list) expect(p.auto).toBe(p.min > 0 && p.cat !== "stay");
    }
  });

  it("장소의 시군마다 관문이 있다", () => {
    for (const p of all) expect(REGION_HUB[p.locKo]).toBeDefined();
  });
});
