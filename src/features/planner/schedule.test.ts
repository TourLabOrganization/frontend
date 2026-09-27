import { describe, expect, it } from "vitest";
import { DAY_END, DAY_START } from "../course/params";
import { toMin } from "../course/schedule";
import {
  DEFAULT_SETTINGS,
  type LocalMode,
  type PlannerSettings,
} from "./course-store";
import { placesInScope } from "./data";
import { addDays, dateError, tripDays } from "./dates";
import { PLANNER_ORIGINS } from "./regions";
import { buildPlannerSchedule, recommendCourse } from "./schedule";

const START = "2026-09-27";

function settingsFor(days: number, localMode: LocalMode): PlannerSettings {
  return {
    ...DEFAULT_SETTINGS,
    startDate: START,
    endDate: addDays(START, days - 1),
    localMode,
  };
}

const CITIES = ["경주", "서울", "제주"];
const DAYS = [1, 2, 3];
const LOCALS: LocalMode[] = ["transit", "driving"];

describe("투어 플래너 일정 (buildPlannerSchedule)", () => {
  for (const city of CITIES)
    for (const days of DAYS)
      for (const local of LOCALS) {
        const label = `${city} · ${days}일 · ${local}`;
        const settings = settingsFor(days, local);
        const pool = placesInScope({ kind: "city", city });
        const course = recommendCourse(pool, settings, city);
        const plan = buildPlannerSchedule(course, settings, city);

        // 제주 당일 대중교통은 첫날 창이 비어 추천이 빈다: 김포 경유 체인(11:18 제주공항 도착) + 공항 → 성산 권역
        // 대중교통 약 220분(PoC legInfo 15 + km × 3.6)이 첫날 시작을 늦추고, 귀가 관문까지 같은 구간을 빼면 남는 시간이 없다
        const mayBeEmpty = city === "제주" && days === 1 && local === "transit";
        it(`${label}: 추천 코스는 그 도시 장소만, 한 곳 이상`, () => {
          if (!mayBeEmpty) expect(course.length).toBeGreaterThan(0);
          expect(course.every((p) => p.pickCity === city)).toBe(true);
          expect(new Set(course.map((p) => p.id)).size).toBe(course.length);
        });

        it(`${label}: 일수만큼 날이 있고 시각이 창 안이며 겹치지 않는다`, () => {
          expect(plan.days).toHaveLength(days);
          const ret = toMin(settings.retTime);
          plan.days.forEach((d, i) => {
            let prevLeave = -Infinity;
            for (const s of d.stops) {
              expect(s.arriveMin, s.id).toBeGreaterThanOrEqual(DAY_START);
              expect(s.leaveMin, s.id).toBeLessThanOrEqual(DAY_END);
              if (i === days - 1)
                expect(s.leaveMin, s.id).toBeLessThanOrEqual(ret);
              expect(s.arriveMin).toBeGreaterThanOrEqual(prevLeave + s.move);
              expect(s.leaveMin).toBe(s.arriveMin + s.stay);
              prevLeave = s.leaveMin;
            }
          });
        });

        it(`${label}: 추천 코스는 불러오자마자 잘리지 않는다(dropped 0)`, () => {
          expect(plan.dropped.map((p) => p.id)).toEqual([]);
        });

        it(`${label}: 요약 합 = 일정 합, 잘린 장소 + 담긴 장소 = 코스`, () => {
          const stops = plan.days.flatMap((d) => d.stops);
          expect(plan.stops).toBe(stops.length);
          expect(plan.minutes).toBe(
            stops.reduce((a, s) => a + s.move + s.wait + s.stay, 0),
          );
          expect(plan.stops + plan.dropped.length).toBe(course.length);
          expect(plan.km).toBeGreaterThanOrEqual(0);
          expect(Math.round(plan.km * 10)).toBe(plan.km * 10);
          if (stops.length > 1) expect(plan.km).toBeGreaterThan(0);
        });
      }

  it("현지 이동을 바꾸면 구간 시간이 바뀐다", () => {
    const pool = placesInScope({ kind: "city", city: "경주" });
    const course = recommendCourse(pool, settingsFor(2, "transit"), "경주");
    const a = buildPlannerSchedule(course, settingsFor(2, "transit"), "경주");
    const b = buildPlannerSchedule(course, settingsFor(2, "driving"), "경주");
    expect(a.local).toBe("transit");
    expect(b.local).toBe("driving");
    expect(a.minutes).not.toBe(b.minutes);
  });

  it("창을 넘치는 장소는 dropped로 남는다", () => {
    const pool = placesInScope({ kind: "city", city: "서울" }).filter(
      (p) => p.min > 0,
    );
    const plan = buildPlannerSchedule(pool, settingsFor(1, "transit"), "서울");
    expect(plan.dropped.length).toBeGreaterThan(0);
    expect(plan.stops + plan.dropped.length).toBe(pool.length);
  });

  // 마지막 날은 여행지 출발 시각에서 끝나서, 창 길이만 보고 채운 추천이 넘치기 쉬운 곳은 당일이다
  it("당일 추천 코스는 출발지 · 출발 시각이 달라도 잘리지 않는다", () => {
    for (const city of CITIES)
      for (const origin of Object.keys(PLANNER_ORIGINS))
        for (const depTime of ["06:00", "08:00", "12:00"]) {
          const settings = { ...settingsFor(1, "transit"), origin, depTime };
          const pool = placesInScope({ kind: "city", city });
          const plan = buildPlannerSchedule(
            recommendCourse(pool, settings, city),
            settings,
            city,
          );
          expect(plan.dropped, `${city} · ${origin} · ${depTime}`).toEqual([]);
        }
  });

  it("빈 코스는 경유지 0 · 거리 0 · 시간 0", () => {
    const plan = buildPlannerSchedule([], settingsFor(3, "transit"), null);
    expect(plan.days).toHaveLength(3);
    expect(plan).toMatchObject({ stops: 0, km: 0, minutes: 0, wide: null });
  });
});

describe("날짜 · 광역 교통", () => {
  it("일수 = 날짜 차 + 1, 잘못된 날짜는 당일", () => {
    expect(tripDays(START, START)).toBe(1);
    expect(tripDays(START, "2026-09-29")).toBe(3);
    expect(tripDays(START, "2026-09-26")).toBe(1);
    expect(tripDays(null, null)).toBe(1);
    expect(dateError(START, "2026-09-26")).toBe("order");
    expect(dateError(START, addDays(START, 14))).toBe("tooLong");
    expect(dateError(START, addDays(START, 13))).toBeNull();
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("광역 교통을 고르지 않으면 출발지와 관문이 함께 가진 수단(서울역 → 경주 KTX)", () => {
    const pool = placesInScope({ kind: "city", city: "경주" });
    const settings = settingsFor(2, "transit");
    const plan = buildPlannerSchedule(
      recommendCourse(pool, settings, "경주"),
      settings,
      "경주",
    );
    expect(plan.wide).toBe("ktx");
    expect(plan.choice).toBe("rail");
    // 자가용을 고르면 현지도 자가용이고 도착 후 구간은 없다
    const own = { ...settings, wideMode: "own" as const };
    const ownPlan = buildPlannerSchedule(
      recommendCourse(pool, own, "경주"),
      own,
      "경주",
    );
    expect(ownPlan).toMatchObject({ wide: "own", local: "own", arrival: null });
  });

  it("제주에서 자가용을 고르면 카페리(배 본 구간) + 현지 자가용", () => {
    const settings = { ...settingsFor(1, "transit"), wideMode: "own" as const };
    const plan = buildPlannerSchedule(
      recommendCourse(
        placesInScope({ kind: "city", city: "제주" }),
        settings,
        "제주",
      ),
      settings,
      "제주",
    );
    expect(plan.local).toBe("own");
    expect(plan.wide).toBe("ship");
    expect(plan.carFerry).toBe(true);
  });
});
