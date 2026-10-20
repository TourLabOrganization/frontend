import { describe, expect, it } from "vitest";
import {
  courseOverlay,
  courseRoadQueries,
  DAY_COLORS,
  dayColor,
  ROAD_LEG_CAP,
  type RoadLegQuery,
  roadLegKey,
  roadLegQuery,
  roadRoutePath,
  themeRoadLegQuery,
} from "./course-map";
import type { StaySample } from "./stays";

const p = (id: string, lat: number, lng: number) => ({ id, lat, lng });
const sample = (id: string, lat: number, lng: number): StaySample => ({
  region: "gyeongju",
  id,
  lat,
  lng,
  ko: id,
  en: id,
  areaKo: "",
  areaEn: "",
  typeKo: "",
  typeEn: "",
});

describe("코스 지도 표시 (courseOverlay)", () => {
  it("날짜 색은 1일차부터 돌고 8일차는 1일차 색", () => {
    expect(dayColor(1)).toBe(DAY_COLORS[0]);
    expect(dayColor(8)).toBe(DAY_COLORS[0]);
    expect(dayColor(3)).toBe(DAY_COLORS[2]);
  });

  it("날짜마다 선(경유지 2곳 이상) · 번호 핀, 마지막 날을 뺀 날의 숙소 핀(담은 숙박 → 표본, 25km 밖이면 없음)", () => {
    const a = p("a", 35.84, 129.21);
    const b = p("b", 35.85, 129.22);
    const c = p("c", 35.86, 129.23);
    const stayNear = p("stay", 35.845, 129.215);
    const days = [
      { day: 1, stops: [{ place: a }, { place: b }] },
      { day: 2, stops: [{ place: c }] },
      { day: 3, stops: [] },
      { day: 4, stops: [] },
    ];
    const far = sample("far", 36.9, 129.21);
    const near = sample("near", 35.861, 129.231);
    const o = courseOverlay(days, [stayNear], [far, near]);
    // 구간 선은 같은 날 앞 장소 → 이 장소. 조회 함수가 없으면 모두 직선(query null)
    expect(o.legs).toEqual([
      {
        day: 1,
        color: dayColor(1),
        from: { lat: 35.84, lng: 129.21 },
        to: { lat: 35.85, lng: 129.22 },
        query: null,
      },
    ]);
    expect(o.pins.map((x) => [x.id, x.day, x.order])).toEqual([
      ["a", 1, 1],
      ["b", 1, 2],
      ["c", 2, 1],
    ]);
    // 1일차 밤: 담은 숙박 장소(기준점 b에서 25km 안) · 2일차 밤: 기준점 c, 담은 숙박 장소도 25km 안이라 그것 · 3일차 밤: 기준점은 c(이전 날)
    expect(o.stays.map((s) => [s.day, s.stay.kind, s.lat])).toEqual([
      [1, "picked", 35.845],
      [2, "picked", 35.845],
      [3, "picked", 35.845],
    ]);
    const noOwn = courseOverlay(days, [], [far, near]);
    expect(noOwn.stays.map((s) => [s.day, s.stay.kind])).toEqual([
      [1, "sample"],
      [2, "sample"],
      [3, "sample"],
    ]);
    const nothing = courseOverlay(days, [], [far]);
    expect(nothing.stays).toEqual([]);
    expect(o.points).toHaveLength(3 + 3);
  });
});

describe("도로 경로 조회 (roadLegQuery)", () => {
  const at = (lat: number, lng: number, locKo?: string) => ({
    lat,
    lng,
    ...(locKo ? { locKo } : {}),
  });
  const a = at(35.838114, 129.211184, "경주");
  const b = at(35.834686, 129.219013, "경주");
  const ends = {
    from: { lat: 35.83811, lng: 129.21118 },
    to: { lat: 35.83469, lng: 129.21901 },
  };

  it("좌표는 소수 5자리(같은 구간이 같은 캐시), 같은 도시 대중교통은 최단 거리 · 렌트카는 추천 경로", () => {
    expect(roadLegQuery(a, b, "transit")).toEqual({ ...ends, by: "distance" });
    expect(roadLegQuery(a, b, "driving")).toEqual(ends);
    expect(roadLegQuery(a, b, "driving")).not.toHaveProperty("by");
  });

  it("자가용은 도시가 달라도 추천 경로", () => {
    const seoul = at(37.5796, 126.977, "서울");
    const busan = at(35.1587, 129.1604, "부산");
    expect(roadLegQuery(seoul, busan, "own")).toEqual({
      from: { lat: 37.5796, lng: 126.977 },
      to: { lat: 35.1587, lng: 129.1604 },
    });
  });

  it("광역 구간: 시외버스는 추천 경로, 기차 · 광역전철은 부르지 않는다(실제 관문 데이터)", () => {
    const gangneung = at(37.7519, 128.8761, "강릉");
    const sokcho = at(38.207, 128.5918, "속초");
    const seoul = at(37.5796, 126.977, "서울");
    const busan = at(35.1587, 129.1604, "부산");
    const incheon = at(37.4563, 126.7052, "인천");
    expect(roadLegQuery(gangneung, sokcho, "transit")).toEqual({
      from: { lat: 37.7519, lng: 128.8761 },
      to: { lat: 38.207, lng: 128.5918 },
    });
    expect(roadLegQuery(gangneung, sokcho, "driving")).not.toBeNull();
    expect(roadLegQuery(seoul, busan, "transit")).toBeNull();
    expect(roadLegQuery(seoul, busan, "driving")).toBeNull();
    expect(roadLegQuery(seoul, incheon, "transit")).toBeNull();
  });

  it("광역 수단은 바꿔 끼운 함수를 따른다(도시가 다를 때만 부른다)", () => {
    const x = at(36, 127, "가");
    const y = at(36.1, 127.1, "나");
    const calls: string[] = [];
    const mode =
      (m: "metro" | "rail" | "bus") =>
      (p: { locKo: string }, q: { locKo: string }) => {
        calls.push(`${p.locKo}-${q.locKo}`);
        return m;
      };
    expect(roadLegQuery(x, y, "transit", mode("bus"))).not.toBeNull();
    expect(roadLegQuery(x, y, "transit", mode("rail"))).toBeNull();
    expect(roadLegQuery(x, y, "transit", mode("metro"))).toBeNull();
    expect(
      roadLegQuery(x, at(36.1, 127.1, "가"), "transit", mode("rail")),
    ).toEqual({
      from: { lat: 36, lng: 127 },
      to: { lat: 36.1, lng: 127.1 },
      by: "distance",
    });
    // 도시 하나를 모르면 광역이 아니다(legInfo wide와 같다)
    expect(
      roadLegQuery(x, at(36.1, 127.1), "driving", mode("rail")),
    ).not.toBeNull();
    expect(calls).toEqual(["가-나", "가-나", "가-나"]);
  });

  it("20m 안이면 부르지 않는다(어느 수단이든)", () => {
    const p = at(35.8, 129.2, "경주");
    const near = at(35.80015, 129.2, "경주"); // 약 17m
    const far = at(35.8002, 129.2, "경주"); // 약 22m
    for (const m of ["transit", "driving", "own"] as const) {
      expect(roadLegQuery(p, near, m)).toBeNull();
      expect(roadLegQuery(p, far, m)).not.toBeNull();
    }
    expect(themeRoadLegQuery(p, near)).toBeNull();
  });

  it("테마 코스: 같은 도시 · 도시를 모르면 최단 거리, 도시가 다르면 추천 경로(기차 구간도 도로로)", () => {
    expect(themeRoadLegQuery(a, b)).toEqual({ ...ends, by: "distance" });
    expect(
      themeRoadLegQuery(at(35.8, 129.2), at(35.9, 129.3, "경주")),
    ).toMatchObject({
      by: "distance",
    });
    const seoul = at(37.5796, 126.977, "서울");
    const busan = at(35.1587, 129.1604, "부산");
    expect(themeRoadLegQuery(seoul, busan)).toEqual({
      from: { lat: 37.5796, lng: 126.977 },
      to: { lat: 35.1587, lng: 129.1604 },
    });
  });

  it("키 · 주소: 같은 구간은 같은 키, by가 다르면 다른 키", () => {
    const q: RoadLegQuery = { ...ends, by: "distance" };
    expect(roadLegKey(q)).toBe(
      "35.83811,129.21118|35.83469,129.21901|distance",
    );
    expect(roadLegKey(ends)).toBe("35.83811,129.21118|35.83469,129.21901|");
    expect(roadRoutePath(q)).toBe(
      "/api/route?from=35.83811,129.21118&to=35.83469,129.21901&by=distance",
    );
    expect(roadRoutePath(ends)).toBe(
      "/api/route?from=35.83811,129.21118&to=35.83469,129.21901",
    );
  });
});

describe("코스 구간 조회 상한 (courseRoadQueries)", () => {
  const stop = (i: number) => ({ lat: 35 + i * 0.01, lng: 127 });
  const legs = (n: number) => Array.from({ length: n + 1 }, (_, i) => stop(i));

  it("날마다 첫 장소는 null, 앞 날부터 80개까지 · 넘는 새 구간은 null", () => {
    const days = [legs(50), legs(50).map((p) => ({ ...p, lng: 128 }))];
    const out = courseRoadQueries(days, (p, q) => themeRoadLegQuery(p, q));
    expect(out.map((d) => d.length)).toEqual([51, 51]);
    expect(out[0][0]).toBeNull();
    expect(out[1][0]).toBeNull();
    const kept = out.flat().filter((q) => q !== null);
    expect(kept).toHaveLength(ROAD_LEG_CAP);
    expect(out[0].slice(1).every((q) => q !== null)).toBe(true);
    expect(out[1].slice(1, 31).every((q) => q !== null)).toBe(true);
    expect(out[1].slice(31).every((q) => q === null)).toBe(true);
  });

  it("같은 조회는 한 번만 센다(상한을 넘어도 이미 부른 구간은 그린다)", () => {
    const back = [stop(0), stop(1), stop(0), stop(1)];
    const many = [legs(ROAD_LEG_CAP), back];
    const out = courseRoadQueries(many, (p, q) => themeRoadLegQuery(p, q));
    // 둘째 날 0 → 1은 첫날에 부른 구간, 1 → 0은 새 구간(상한 넘음)
    expect(out[1][1]).not.toBeNull();
    expect(out[1][2]).toBeNull();
    expect(out[1][3]).not.toBeNull();
  });

  it("courseOverlay는 같은 조회 · 상한으로 구간 선에 query를 붙인다", () => {
    const pl = (id: string, lat: number, lng: number) => ({
      id,
      lat,
      lng,
      locKo: "경주",
    });
    const o = courseOverlay(
      [
        {
          day: 1,
          stops: [
            { place: pl("a", 35.84, 129.21) },
            { place: pl("b", 35.85, 129.22) },
            { place: pl("c", 35.85001, 129.22) },
          ],
        },
      ],
      [],
      [],
      (p, q) => roadLegQuery(p, q, "transit"),
    );
    expect(o.legs.map((l) => l.query)).toEqual([
      {
        from: { lat: 35.84, lng: 129.21 },
        to: { lat: 35.85, lng: 129.22 },
        by: "distance",
      },
      null,
    ]);
  });
});
