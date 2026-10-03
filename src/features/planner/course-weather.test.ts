import { describe, expect, it } from "vitest";
import type { PlannerPlace } from "./data";
import {
  ALT_COUNT,
  courseWeather,
  dayAlert,
  forecastRange,
  isIndoor,
  isOutdoor,
} from "./course-weather";

const place = (
  id: string,
  ko: string,
  cat: PlannerPlace["cat"],
  lat = 35.83,
  lng = 129.22,
): PlannerPlace =>
  ({
    id,
    n: null,
    ko,
    en: id,
    locKo: "경주",
    pickCity: "경주",
    macro: "daegyeong",
    cat,
    lat,
    lng,
    min: 60,
    hrs: "",
    open: null,
    close: null,
    yt: false,
    off: false,
    k100: false,
    un: false,
    bf: false,
    auto: false,
  }) as PlannerPlace;

const day = (date: string, rain: number, code: number | null, max: number) => ({
  date,
  max,
  min: 10,
  rain,
  code,
});

describe("dayAlert", () => {
  it("강수 5mm 이상 · 비 · 소나기 · 뇌우 · 눈이면 rain, 최고 33° 이상이면 heat, 둘 다면 rain", () => {
    expect(dayAlert(day("d", 5, 2, 25))).toBe("rain");
    expect(dayAlert(day("d", 0, 61, 25))).toBe("rain");
    expect(dayAlert(day("d", 0, 80, 25))).toBe("rain");
    expect(dayAlert(day("d", 0, 95, 25))).toBe("rain");
    expect(dayAlert(day("d", 0, 71, 25))).toBe("rain");
    expect(dayAlert(day("d", 0, 1, 33))).toBe("heat");
    expect(dayAlert(day("d", 10, 61, 35))).toBe("rain");
  });
  it("이슬비 · 적은 비 · 33° 미만이면 경고 없음, 예보 없음은 null", () => {
    expect(dayAlert(day("d", 4.9, 51, 32.9))).toBeNull();
    expect(dayAlert(day("d", 0, null, 20))).toBeNull();
    expect(dayAlert(null)).toBeNull();
  });
});

describe("isIndoor · isOutdoor", () => {
  it("이름의 실내 시설 말로 가르고, 야외 말이 함께 들면 야외. 식당 · 숙박은 어느 쪽도 아니다", () => {
    expect(isIndoor(place("a", "국립경주박물관", "herit"))).toBe(true);
    expect(isIndoor(place("b", "서울타워", "activity"))).toBe(true);
    expect(isIndoor(place("c", "영화 리틀포레스트 촬영지", "herit"))).toBe(
      false,
    );
    expect(isIndoor(place("d", "서산동부전통시장 쌈지공원", "heal"))).toBe(
      false,
    );
    expect(isOutdoor(place("e", "불국사", "herit"))).toBe(true);
    expect(isOutdoor(place("f", "경포해변", "sea"))).toBe(true);
    expect(isOutdoor(place("g", "국립경주박물관", "herit"))).toBe(false);
    expect(isOutdoor(place("h", "황남빵", "food"))).toBe(false);
    expect(isIndoor(place("h", "황남빵", "food"))).toBe(false);
    expect(isOutdoor(place("i", "힐튼 경주", "stay"))).toBe(false);
  });
});

describe("forecastRange", () => {
  it("여행 날짜와 오늘 ~ 오늘 + 15일이 겹치는 부분", () => {
    expect(forecastRange("2026-10-03", 3, "2026-10-03")).toEqual({
      from: "2026-10-03",
      to: "2026-10-05",
    });
    // 이미 시작한 여행은 오늘부터
    expect(forecastRange("2026-10-01", 5, "2026-10-03")).toEqual({
      from: "2026-10-03",
      to: "2026-10-05",
    });
    // 예보가 닿는 마지막 날에서 자른다
    expect(forecastRange("2026-10-15", 14, "2026-10-03")).toEqual({
      from: "2026-10-15",
      to: "2026-10-18",
    });
  });
  it("지난 여행 · 16일 뒤 여행은 null", () => {
    expect(forecastRange("2026-09-20", 3, "2026-10-03")).toBeNull();
    expect(forecastRange("2026-10-19", 3, "2026-10-03")).toBeNull();
  });
});

describe("courseWeather", () => {
  const temple = place("t", "불국사", "herit", 35.79, 129.332);
  const museum = place("m", "국립경주박물관", "herit", 35.829, 129.228);
  const expo = place("x", "경주 엑스포대공원", "activity", 35.834, 129.284);
  const near = place("n", "경주 솔거미술관", "herit", 35.835, 129.283);
  const far = place("f", "경주 테디베어박물관", "activity", 35.84, 129.21);
  const other = place("o", "포항 박물관", "herit", 36.0, 129.36);
  other.locKo = "포항";
  const cafe = place("c", "경주 카페거리", "food");
  const pool = [temple, museum, expo, near, far, other, cafe];
  const days = [
    { stops: [{ place: temple }, { place: expo }, { place: cafe }] },
    { stops: [{ place: museum }] },
    { stops: [] },
  ];
  const dates = ["2026-10-03", "2026-10-04", "2026-10-05"];

  it("날마다 예보 · 경고를 붙이고, 경고일에만 야외 장소와 같은 도시 실내 대안(가까운 순, 코스 밖)을 단다", () => {
    const out = courseWeather(
      days,
      dates,
      [day("2026-10-03", 12, 63, 24), day("2026-10-04", 0, 0, 34)],
      pool,
      new Set(["t", "x", "c", "m"]),
    );
    expect(out.map((d) => [d.date, d.alert, d.weather?.rain ?? null])).toEqual([
      ["2026-10-03", "rain", 12],
      ["2026-10-04", "heat", 0],
      ["2026-10-05", null, null],
    ]);
    // 첫날: 불국사 · 엑스포대공원이 야외(카페는 식당이라 제외). 대안은 경주 실내 장소 중 코스 밖(solgeo · teddy), 가까운 순
    expect(out[0].flagged.map((f) => f.place.id)).toEqual(["t", "x"]);
    expect(out[0].flagged[1].alternatives.map((p) => p.id)).toEqual(["n", "f"]);
    expect(out[0].flagged[0].alternatives.length).toBeLessThanOrEqual(
      ALT_COUNT,
    );
    // 둘째 날: 박물관은 실내라 폭염 경고여도 표시할 장소가 없다
    expect(out[1].flagged).toEqual([]);
    expect(out[2].flagged).toEqual([]);
  });

  it("같은 장소가 두 번 있어도 한 번만, 예보가 없으면 경고 없음", () => {
    const out = courseWeather(
      [{ stops: [{ place: temple }, { place: temple }] }],
      ["2026-10-03"],
      [day("2026-10-03", 20, 61, 20)],
      pool,
      new Set(["t"]),
    );
    expect(out[0].flagged.map((f) => f.place.id)).toEqual(["t"]);
    expect(courseWeather(days, dates, [], pool, new Set())[0].alert).toBeNull();
  });
});
