import { describe, expect, it } from "vitest";
import { straightKm } from "../course/schedule";
import { DEFAULT_SETTINGS, type PlannerSettings } from "./course-store";
import { findPlace, PLANNER_PLACES, placesInScope } from "./data";
import { addLocalDays, stayBookingLinks, tripStayDates } from "./data/booking";
import { addDays } from "./dates";
import { buildPlannerSchedule, recommendCourse } from "./schedule";
import {
  keepStays,
  nearbyStays,
  nightAnchor,
  pickNightStay,
  STAY_RADIUS_KM,
  STAY_SAMPLES,
  sampleMapUrl,
  splitStays,
  stayQuery,
  toggleNightStay,
} from "./stays";
import staysJson from "./data/stays.json";

const START = "2026-09-27";
const settings = (days: number): PlannerSettings => ({
  ...DEFAULT_SETTINGS,
  startDate: START,
  endDate: addDays(START, days - 1),
});

const gyeongju = placesInScope({ kind: "city", city: "경주" });
const gjStays = PLANNER_PLACES.filter(
  (p) => p.cat === "stay" && p.locKo === "경주",
);
const hyowoodang = findPlace("gj1")!;

describe("숙소 표본 (data/stays.json)", () => {
  it("PoC STAYS 153곳, 가격대(band)는 옮기지 않았다", () => {
    expect(STAY_SAMPLES).toHaveLength(153);
    expect(staysJson.some((s) => "band" in s)).toBe(false);
    expect(new Set(STAY_SAMPLES.map((s) => s.id)).size).toBe(153);
  });
});

describe("숙박 장소 분리 (splitStays · buildPlannerSchedule)", () => {
  it("담은 순서를 지키며 숙박 장소를 따로 뺀다", () => {
    const list = [
      { id: "a", cat: "herit" },
      { id: "s", cat: "stay" },
      { id: "b", cat: "food" },
    ];
    const { sights, stays } = splitStays(list);
    expect(sights.map((p) => p.id)).toEqual(["a", "b"]);
    expect(stays.map((p) => p.id)).toEqual(["s"]);
  });

  it("숙박 장소를 담아도 일정 시각 · 요약이 그대로다", () => {
    const s = settings(3);
    const course = recommendCourse(gyeongju, s, "경주");
    const base = buildPlannerSchedule(course, s, "경주");
    const withStay = buildPlannerSchedule(
      [...course.slice(0, 2), hyowoodang, ...course.slice(2)],
      s,
      "경주",
    );
    expect(withStay.stops).toBe(base.stops);
    expect(withStay.km).toBe(base.km);
    expect(withStay.minutes).toBe(base.minutes);
    expect(withStay.dropped).toEqual(base.dropped);
    expect(withStay.days).toEqual(base.days);
    const ids = withStay.days.flatMap((d) => d.stops.map((x) => x.id));
    expect(ids).not.toContain(hyowoodang.id);
  });

  it("추천 코스에는 숙박 장소가 들어가지 않는다", () => {
    const course = recommendCourse(gyeongju, settings(2), "경주");
    expect(course.some((p) => p.cat === "stay")).toBe(false);
  });
});

describe("그날 밤 숙소 (nightAnchor · pickNightStay)", () => {
  const P = (id: string) => ({ place: id });
  const days = [
    { stops: [P("a"), P("b")] },
    { stops: [] },
    { stops: [P("c")] },
    { stops: [] },
  ];

  it("기준점: 그날 마지막 → 다음 날 첫 → 이전 날 마지막", () => {
    expect(nightAnchor(days, 0)).toBe("b");
    expect(nightAnchor(days, 1)).toBe("c");
    expect(nightAnchor(days, 3)).toBe("c");
    expect(nightAnchor([{ stops: [] }], 0)).toBeNull();
  });

  const anchor = gyeongju.find((p) => p.id === "gj2") ?? gyeongju[0];

  it("25km 안의 담은 숙박 장소가 먼저(직접 지정)", () => {
    const r = pickNightStay(anchor, [hyowoodang], STAY_SAMPLES, 0);
    expect(r).toEqual({ kind: "picked", place: hyowoodang });
  });

  it("담은 숙박 장소가 없으면 25km 안의 가장 가까운 표본", () => {
    const r = pickNightStay(anchor, [], STAY_SAMPLES, 0);
    expect(r?.kind).toBe("sample");
    if (r?.kind !== "sample") return;
    const best = Math.min(...STAY_SAMPLES.map((s) => straightKm(anchor, s)));
    expect(straightKm(anchor, r.sample)).toBe(best);
    expect(best).toBeLessThanOrEqual(STAY_RADIUS_KM);
  });

  it("25km 밖이면 「숙소 {날짜 순번}」", () => {
    const far = { lat: 0, lng: 0 };
    expect(pickNightStay(far, [hyowoodang], STAY_SAMPLES, 1)).toEqual({
      kind: "generic",
      letter: "B",
      anchor: far,
    });
  });

  it("기준점이 없으면 담은 숙박 장소를 날짜 순서로, 없으면 카드 없음", () => {
    const a = { lat: 1, lng: 1, id: "x" };
    const b = { lat: 2, lng: 2, id: "y" };
    expect(pickNightStay(null, [a, b], STAY_SAMPLES, 3)).toEqual({
      kind: "picked",
      place: b,
    });
    expect(pickNightStay(null, [], STAY_SAMPLES, 0)).toBeNull();
  });
});

describe("주변 숙소 (nearbyStays)", () => {
  const anchor = hyowoodang;
  it("우리 숙박 장소 최대 4곳 + 표본 2곳, 모두 25km 안 · 가까운 순", () => {
    const r = nearbyStays(anchor, gjStays, STAY_SAMPLES);
    expect(r.own.length).toBeGreaterThan(0);
    expect(r.own.length).toBeLessThanOrEqual(4);
    expect(r.samples.length).toBeLessThanOrEqual(2);
    const kms = r.own.map((x) => x.km);
    expect([...kms].sort((x, y) => x - y)).toEqual(kms);
    expect(
      [...r.own.map((x) => x.km), ...r.samples.map((x) => x.km)].every(
        (k) => k <= STAY_RADIUS_KM,
      ),
    ).toBe(true);
  });
  it("우리 장소가 없으면 표본 최대 4곳", () => {
    const r = nearbyStays(anchor, [], STAY_SAMPLES);
    expect(r.own).toEqual([]);
    expect(r.samples.length).toBeGreaterThan(2);
    expect(r.samples.length).toBeLessThanOrEqual(4);
  });
});

describe("그날 밤 숙소 지정 · 해제 (toggleNightStay)", () => {
  const lookup = (id: string) => findPlace(id);
  const [s1, s2] = gjStays.filter(
    (p) => straightKm(hyowoodang, p) <= STAY_RADIUS_KM,
  );
  it("지정하면 같은 기준점 25km 안의 다른 숙박 장소는 빠지고 맨 뒤에 담긴다", () => {
    const next = toggleNightStay(
      ["gj2", s1.id, "gj3"],
      s2.id,
      hyowoodang,
      lookup,
    );
    expect(next).toEqual(["gj2", "gj3", s2.id]);
  });
  it("이미 담긴 곳을 누르면 뺀다", () => {
    expect(toggleNightStay(["gj2", s1.id], s1.id, hyowoodang, lookup)).toEqual([
      "gj2",
    ]);
  });
});

describe("자동 추천 뒤 숙소 유지 (keepStays)", () => {
  const lookup = (id: string) => findPlace(id);
  it("지정한 숙박 장소를 추천 코스 뒤에 남긴다", () => {
    expect(
      keepStays(["gj2", "gj3"], ["gj5", "gj1", "gj3"], lookup, "경주"),
    ).toEqual(["gj2", "gj3", "gj1"]);
  });
  it("다른 도시의 숙박 장소는 남기지 않는다", () => {
    expect(keepStays(["gj2"], ["gj1"], lookup, "서울")).toEqual(["gj2"]);
  });
});

describe("예약 링크 (날짜 · 검색어 · 언어)", () => {
  it("로컬 날짜로 다음 날을 만든다. 달 · 해를 넘는다", () => {
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addLocalDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addLocalDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addLocalDays("2026-09-27", 0)).toBe("2026-09-27");
  });

  it("코스 전체 날짜: 출발일 ~ 귀가일, 같거나 없으면 다음 날, 없으면 오늘", () => {
    expect(tripStayDates("2026-12-30", "2027-01-02", "2026-01-01")).toEqual({
      checkIn: "2026-12-30",
      checkOut: "2027-01-02",
    });
    expect(tripStayDates("2026-12-31", "2026-12-31", "x")).toEqual({
      checkIn: "2026-12-31",
      checkOut: "2027-01-01",
    });
    expect(tripStayDates(null, null, "2026-09-27")).toEqual({
      checkIn: "2026-09-27",
      checkOut: "2026-09-28",
    });
  });

  it("6곳 · 날짜 · 검색어 · 언어 인자", () => {
    const links = stayBookingLinks({
      query: "경주 황남동 한옥스테이",
      checkIn: "2026-12-31",
      checkOut: "2027-01-01",
      locale: "zh",
    });
    expect(links.map((l) => l.label)).toEqual([
      "bookingCom",
      "agoda",
      "airbnb",
      "yanolja",
      "goodchoice",
      "tripCom",
    ]);
    const q = encodeURIComponent("경주 황남동 한옥스테이");
    const [booking, agoda, airbnb, yanolja, goodchoice, trip] = links.map(
      (l) => l.href,
    );
    expect(booking).toBe(
      `https://www.booking.com/searchresults.html?ss=${q}&checkin=2026-12-31&checkout=2027-01-01&lang=zh_CN`,
    );
    expect(agoda).toContain(
      "checkIn=2026-12-31&checkOut=2027-01-01&lang=zh_CN",
    );
    expect(airbnb).toBe(
      `https://www.airbnb.com/s/${q}/homes?checkin=2026-12-31&checkout=2027-01-01`,
    );
    expect(yanolja).toBe(`https://www.yanolja.com/search/${q}`);
    expect(goodchoice).toBe(`https://www.goodchoice.kr/product/search/${q}`);
    expect(trip).toBe(
      `https://www.trip.com/zh/hotels/list?checkin=2026-12-31&checkout=2027-01-01&city=${q}`,
    );
    const es = stayBookingLinks({
      query: "x",
      checkIn: "a",
      checkOut: "b",
      locale: "es",
    });
    expect(es[0].href).toContain("lang=en");
    expect(es[5].href).toContain("trip.com/en/");
  });

  it("표본 검색어와 지도 주소(한국어는 네이버, 그 밖은 Google)", () => {
    const s = STAY_SAMPLES.find((x) => x.id === "sg1")!;
    expect(stayQuery(s, "ko")).toBe("경주 황남동 한옥스테이");
    expect(stayQuery(s, "ja")).toBe("hanok stay Hwangnam-dong Gyeongju");
    expect(sampleMapUrl(s, "ko")).toBe(
      `https://map.naver.com/p/search/${encodeURIComponent("경주 황남동 한옥스테이")}`,
    );
    expect(sampleMapUrl(s, "zh")).toBe(
      `https://www.google.com/maps/search/${encodeURIComponent("hanok stay Hwangnam-dong Gyeongju")}?hl=zh-CN`,
    );
  });
});
