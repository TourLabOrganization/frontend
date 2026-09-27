import { describe, expect, it } from "vitest";
import gyeongjuNation from "./fixtures/gyeongju-nation.json";
import { DETOUR, EARTH_RADIUS_KM } from "./params";
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
  legInfo,
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

describe("시내 이동 legInfo (설명서 4장)", () => {
  // 같은 시군의 두 점. 도로 거리(직선 × DETOUR)가 roadKm이 되게 북쪽으로 옮긴다
  const pair = (roadKm: number) => {
    const p = { id: "p", lat: 37.5, lng: 127, locKo: "서울" };
    const dLat = (roadKm / DETOUR / EARTH_RADIUS_KM) * (180 / Math.PI);
    return [p, { ...p, id: "q", lat: p.lat + dLat }] as const;
  };

  it("대중교통: 3km 이하 max(10, 11 × d), 넘으면 15 + 3.6 × d", () => {
    for (const [d, min] of [
      [0.5, 10],
      [2.9, 32],
      [3.1, 26],
    ] as const) {
      const leg = legInfo(...pair(d), "transit");
      expect(leg.km).toBeCloseTo(d, 6);
      expect(leg.min).toBe(min);
    }
  });

  it("구간 최소 8분: 100m를 차로 가도 8분", () => {
    expect(legInfo(...pair(0.1), "driving").min).toBe(8);
    expect(legInfo(...pair(0.1), "own").min).toBe(8);
  });
});

describe("autoCourse 개장 대기 반영 (waitAware)", () => {
  // 같은 시군 세 곳. A에서 B는 가깝지만 16:00에 열고, C는 조금 멀지만 지금 열려 있다
  const base = { locKo: "영월", cat: "herit", min: 60, off: false, yt: false };
  const A = {
    ...base,
    id: "A",
    ko: "A",
    n: 1,
    lat: 37.2,
    lng: 128.46,
    hrs: "09:00–18:00",
  };
  const B = {
    ...base,
    id: "B",
    ko: "B",
    n: 2,
    lat: 37.203,
    lng: 128.46,
    hrs: "16:00–24:00",
  };
  const C = {
    ...base,
    id: "C",
    ko: "C",
    n: 3,
    lat: 37.215,
    lng: 128.46,
    hrs: "09:00–18:00",
  };
  const opts = {
    days: 1,
    windows: [600],
    legFn: makeLegFn("transit"),
    accIn: 60,
  };

  it("원본은 이동만 보고 개장 전인 가까운 곳을 먼저 골라 기다린다", () => {
    expect(autoCourse([A, B, C], opts).map((p) => p.id)).toEqual(["A", "B"]);
  });

  it("waitAware면 대기도 비용으로 쳐서 열린 곳을 먼저 들르고, 여는 시각에 맞춰 간다", () => {
    const ids = autoCourse([A, B, C], { ...opts, waitAware: true }).map(
      (p) => p.id,
    );
    expect(ids).toEqual(["A", "C", "B"]);
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
  [2, 2, "gjx34", 10, 0, 70, "11:20", "12:30"],
  [2, 3, "gjx1", 27, 0, 90, "12:57", "14:27"],
  [2, 4, "gjx5", 24, 0, 60, "14:51", "15:51"],
  [2, 5, "nax771", 40, 0, 70, "16:31", "17:41"],
  [2, 6, "ro244", 54, 0, 40, "18:35", "19:15"],
  [2, 7, "gjx29", 34, 0, 40, "19:49", "20:29"],
  [3, 1, "ro166", 0, 0, 60, "09:00", "10:00"],
  [3, 2, "gjx9", 16, 0, 40, "10:16", "10:56"],
  [3, 3, "gjx8", 42, 0, 50, "11:38", "12:28"],
  [3, 4, "nax773", 10, 0, 60, "12:38", "13:38"],
  [3, 5, "gjx14", 78, 0, 60, "14:56", "15:56"],
  [3, 6, "ro242", 10, 0, 90, "16:06", "17:36"],
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
