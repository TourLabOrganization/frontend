import { describe, expect, it } from "vitest";
import { courseOverlay, DAY_COLORS, dayColor } from "./course-map";
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
    expect(o.paths).toEqual([
      {
        day: 1,
        color: dayColor(1),
        points: [
          { lat: 35.84, lng: 129.21 },
          { lat: 35.85, lng: 129.22 },
        ],
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
