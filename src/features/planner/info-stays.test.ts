import { describe, expect, it } from "vitest";
import { cityStays, INFO_SAMPLE_LIMIT } from "./info-stays";
import type { StaySample } from "./stays";

const center = { lat: 35.84, lng: 129.21 };
const place = (
  id: string,
  lat: number,
  lng: number,
  extra: Partial<{ cat: string; locKo: string; pickCity: string }> = {},
) => ({
  id,
  lat,
  lng,
  cat: "stay",
  locKo: "경주",
  ...extra,
});
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

describe("여행 정보 탭 「{도시} 숙소」 (cityStays)", () => {
  it("그 도시의 숙박 장소를 모두, 도심에서 가까운 순으로", () => {
    const r = cityStays(
      "경주",
      center,
      [
        place("far", 35.95, 129.21),
        place("near", 35.841, 129.21),
        place("sight", 35.84, 129.21, { cat: "sight" }),
        place("busan", 35.84, 129.21, { locKo: "부산", pickCity: "부산" }),
        place("picked", 35.86, 129.21, { locKo: "경주", pickCity: "경주" }),
      ],
      [],
    );
    expect(r.own.map((x) => x.place.id)).toEqual(["near", "picked", "far"]);
    expect(r.own[0].km).toBeLessThan(r.own[2].km);
  });

  it("표본은 그 도시 region의 것을 가까운 순 최대 4곳", () => {
    const s = [
      sample("far", 36.2, 129.21),
      sample("b", 35.87, 129.21),
      sample("a", 35.85, 129.21),
      { ...sample("pohang", 35.845, 129.21), region: "pohang" },
      sample("c", 35.885, 129.21),
      sample("d", 35.9, 129.21),
    ];
    const r = cityStays("경주", center, [], s, "Gyeongju");
    expect(r.samples.map((x) => x.sample.id)).toEqual(["a", "b", "c", "d"]);
    expect(r.samples).toHaveLength(INFO_SAMPLE_LIMIT);
  });

  it("region 표본이 없으면 도심 25km 안 가까운 순 최대 4곳, 도심도 없으면 없음", () => {
    const s = [
      sample("s40", 36.2, 129.21),
      sample("s3", 35.87, 129.21),
      sample("s1", 35.85, 129.21),
      sample("s5", 35.885, 129.21),
      sample("s7", 35.9, 129.21),
      sample("s9", 35.92, 129.21),
    ];
    const r = cityStays("경주", center, [], s, "Paju");
    expect(r.samples.map((x) => x.sample.id)).toEqual(["s1", "s3", "s5", "s7"]);
    expect(cityStays("경주", null, [], s, "Paju").samples).toEqual([]);
  });
});
