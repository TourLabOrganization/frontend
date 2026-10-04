import { describe, expect, it } from "vitest";
import {
  DAY_END,
  DAY_START,
  DEFAULT_DEP,
  DEFAULT_RET,
  MAX_STOPS,
} from "./params";
import {
  getThemePlaces,
  makeLegFn,
  ORIGINS,
  PLACES_BY_THEME,
  REGION_HUB,
} from "./places";
import {
  accessModeFor,
  buildScenario,
  dayEndClock,
  legModeFor,
  PLAN_IDS,
  planPool,
  sameCourse,
  type Transport,
  tripFromAnswers,
} from "./scenarios";
import {
  accessMin,
  autoCourse,
  dayStartClock,
  dayWindows,
  openHours,
  toMin,
} from "./schedule";

const SLUGS = Object.keys(PLACES_BY_THEME);
const TRANSPORTS: Transport[] = ["car", "public-transit", "flight", "tour-bus"];
const trip = (
  days: number,
  transport: Transport = "car",
  accessible = false,
) => ({
  days,
  transport,
  accessible,
  ignored: [],
});

describe("입력 (Q11 · Q12 · Q14)", () => {
  it("일수: 당일 1 · 1박 2 · 2박 이상 3, 없으면 1", () => {
    expect(tripFromAnswers({ q11: ["day-trip"] }).days).toBe(1);
    expect(tripFromAnswers({ q11: ["1-night"] }).days).toBe(2);
    expect(tripFromAnswers({ q11: ["2-nights-plus"] }).days).toBe(3);
    expect(tripFromAnswers({}).days).toBe(1);
  });

  it("이동수단: 없으면 자가용", () => {
    expect(tripFromAnswers({}).transport).toBe("car");
    expect(tripFromAnswers({ q12: ["flight"] }).transport).toBe("flight");
  });

  it("Q14: 무장애는 필터, 반려동물 · 실내는 반영하지 않은 조건으로 따로 둔다", () => {
    const t = tripFromAnswers({ q14: ["pet", "accessible", "indoor-rain"] });
    expect(t.accessible).toBe(true);
    expect(t.ignored).toEqual(["pet", "indoor-rain"]);
  });

  it("Q13: 걷기 난이도 데이터가 없어 코스는 그대로 두고 답만 남긴다", () => {
    expect(tripFromAnswers({ q13: ["1-3h"] }).walk).toBe("1-3h");
    expect(tripFromAnswers({}).walk).toBeUndefined();
    const plain = buildScenario("busan-film-trip", "classic", trip(1));
    const walked = buildScenario("busan-film-trip", "classic", {
      ...trip(1),
      walk: "under-1h",
    });
    expect(walked.days).toEqual(plain.days);
  });
});

describe("이동수단 매핑", () => {
  it("시내 구간: 자가용 own · 대중교통과 항공 transit · 단체버스 driving", () => {
    expect(legModeFor("car")).toBe("own");
    expect(legModeFor("public-transit")).toBe("transit");
    expect(legModeFor("flight")).toBe("transit");
    expect(legModeFor("tour-bus")).toBe("driving");
  });

  it("광역 접근: 서울역 기준", () => {
    expect(accessModeFor("car", REGION_HUB["영월"])).toBe("own");
    expect(accessModeFor("tour-bus", REGION_HUB["부산"])).toBe("own");
    // 제주는 육로가 없어 자가용 · 단체버스도 항공으로 들어간다
    expect(accessModeFor("car", REGION_HUB["제주"])).toBe("air");
    expect(accessModeFor("public-transit", REGION_HUB["영월"])).toBe("ktx");
    expect(accessModeFor("public-transit", REGION_HUB["거제"])).toBe("bus");
    expect(accessModeFor("public-transit", REGION_HUB["제주"])).toBe("air");
    expect(accessModeFor("flight", REGION_HUB["부산"])).toBe("air");
    // 항공 노선이 없는 지역은 대중교통과 같다
    expect(accessModeFor("flight", REGION_HUB["영월"])).toBe("ktx");
  });
});

describe("3안 후보 규칙", () => {
  it("정석은 100선 · 유네스코를 영상 장소처럼 우대하고 개장 대기를 순위에 넣은 autoCourse 결과 순서를 쓴다", () => {
    for (const slug of SLUGS) {
      for (const days of [1, 2, 3]) {
        const s = buildScenario(slug, "classic", trip(days, "public-transit"));
        const pool = getThemePlaces(slug)
          .filter((p) => p.auto)
          .map((p) => (p.k100 || p.un ? { ...p, yt: true, off: false } : p));
        const windows = dayWindows({ days, accIn: s.accIn });
        const raw = autoCourse(pool, {
          days,
          windows,
          legFn: makeLegFn("transit"),
          accIn: s.accIn,
          waitAware: true,
        });
        const ids = s.days.flatMap((d) => d.stops.map((x) => x.id));
        expect(raw.slice(0, ids.length).map((p) => p.id)).toEqual(ids);
      }
    }
  });

  it("한적에는 한국관광 100선 · 유네스코 · 영상 장소가 없다", () => {
    for (const slug of SLUGS)
      for (const transport of TRANSPORTS)
        for (const days of [1, 2, 3]) {
          const s = buildScenario(slug, "quiet", trip(days, transport));
          for (const d of s.days)
            for (const x of d.stops) {
              expect(x.place.k100).toBe(false);
              expect(x.place.un).toBe(false);
              expect(x.place.yt).toBe(false);
            }
        }
    expect(
      planPool("quiet", getThemePlaces("rescene-route")).some(
        (p) => p.k100 || p.un || p.yt,
      ),
    ).toBe(false);
  });

  // 트렌드가 정석과 같아질 수 있는 테마는 둘뿐이다. 영월은 대표 명소(장릉)가 영상 장소이기도 하고,
  // 부산은 대표 명소(해동용궁사 · 오시리아 · 송정)가 영상 장소(서부산)와 멀어 정석에 잘 들어오지 않는다
  it("한적은 정석 · 트렌드와 다른 코스다. 트렌드는 영월 · 부산 말고는 정석과 다르다", () => {
    for (const slug of SLUGS)
      for (const transport of TRANSPORTS)
        for (const days of [1, 2, 3]) {
          const where = `${slug} ${transport} ${days}`;
          const [classic, trend, quiet] = PLAN_IDS.map((plan) =>
            buildScenario(slug, plan, trip(days, transport)),
          );
          expect(sameCourse(quiet, classic), where).toBe(false);
          expect(sameCourse(quiet, trend), where).toBe(false);
          if (slug !== "kings-warden" && slug !== "busan-film-trip")
            expect(sameCourse(trend, classic), where).toBe(false);
        }
  });

  it("트렌드의 첫 장소는 영상 장소다", () => {
    for (const slug of SLUGS)
      for (const transport of TRANSPORTS)
        for (const days of [1, 2, 3]) {
          const s = buildScenario(slug, "trend", trip(days, transport));
          expect(s.days[0].stops[0]?.place.yt).toBe(true);
        }
  });

  it("무장애를 고르면 무장애 장소만 담는다", () => {
    for (const slug of SLUGS)
      for (const plan of PLAN_IDS) {
        const s = buildScenario(slug, plan, trip(2, "car", true));
        for (const d of s.days)
          for (const x of d.stops) expect(x.place.bf).toBe(true);
      }
  });

  it("무장애 장소가 없는 테마는 빈 코스가 된다", () => {
    // 영월(kings-warden)은 청령포 · 장릉이 2023년 열린관광지로 뽑혀 무장애 장소가 생겼다(2026-10-04 명단 재점검)
    const s = buildScenario(
      "kpop-demon-hunters",
      "classic",
      trip(1, "car", true),
    );
    expect(s.placeCount).toBe(0);
    expect(s.days).toHaveLength(1);
  });
});

describe("시각", () => {
  it("개장 전인 식당을 아침 첫 장소로 골라 몇 시간씩 기다리게 하지 않는다 (RESCENE 정석 · 대중교통 · 3일)", () => {
    // 원본 순위(이동만 봄)로는 2일차가 "09:00부터 420분 대기 → 16:00 양곱창 전골" 한 곳이었다
    const s = buildScenario(
      "rescene-route",
      "classic",
      trip(3, "public-transit"),
    );
    const waits = s.days.flatMap((d) => d.stops.map((x) => x.wait));
    expect(Math.max(...waits)).toBeLessThan(420);
    expect(s.days[1].stops.length).toBeGreaterThan(1);
  });

  it("광역 접근 시간은 첫 시군 관문 기준이다 (영월 · KTX)", () => {
    const s = buildScenario(
      "kings-warden",
      "classic",
      trip(1, "public-transit"),
    );
    expect(s.accIn).toBe(accessMin(ORIGINS.seoul, REGION_HUB["영월"], "ktx"));
  });

  it("테마 5개 × 3안 × 이동수단 4개 × 일수 1·2·3: 창 안 · 겹침 없음 · 폐장 전", () => {
    for (const slug of SLUGS)
      for (const plan of PLAN_IDS)
        for (const transport of TRANSPORTS)
          for (const days of [1, 2, 3]) {
            const s = buildScenario(slug, plan, trip(days, transport));
            const where = `${slug} ${plan} ${transport} ${days}`;
            expect(s.days, where).toHaveLength(days);
            expect(s.placeCount, where).toBeGreaterThan(0);
            expect(s.placeCount, where).toBeLessThanOrEqual(MAX_STOPS);
            const ids = s.days.flatMap((d) => d.stops.map((x) => x.id));
            expect(new Set(ids).size, where).toBe(ids.length);

            s.days.forEach((d, i) => {
              const start = dayStartClock(i, {
                depTime: DEFAULT_DEP,
                accIn: s.accIn,
              });
              const end = dayEndClock(s, i);
              expect(start).toBeGreaterThanOrEqual(DAY_START);
              expect(end).toBeLessThanOrEqual(DAY_END);
              // 마지막 날은 19:00에 여행지를 떠난다 (당일 여행에 늦게 도착해도)
              if (i === days - 1)
                expect(end).toBeLessThanOrEqual(toMin(DEFAULT_RET));
              let prev = start;
              d.stops.forEach((x, k) => {
                expect(x.day, where).toBe(i + 1);
                expect(x.order, where).toBe(k + 1);
                expect(x.arriveMin, where).toBeGreaterThanOrEqual(prev);
                expect(x.leaveMin, where).toBe(x.arriveMin + x.stay);
                expect(x.leaveMin, where).toBeLessThanOrEqual(end);
                const oh = openHours(x.place);
                if (oh) {
                  expect(x.arriveMin, where).toBeGreaterThanOrEqual(oh.open);
                  expect(x.leaveMin, where).toBeLessThanOrEqual(oh.close);
                }
                prev = x.leaveMin;
              });
            });

            const stays = s.days.flatMap((d) => d.stops.map((x) => x.stay));
            expect(s.stayTotal).toBe(stays.reduce((a, b) => a + b, 0));
          }
  });
});
