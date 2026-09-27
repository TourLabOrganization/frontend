import { describe, expect, it } from "vitest";
import {
  addDays,
  openMeteoUrl,
  parseWeatherQuery,
  pickWeatherDays,
  roundCoord,
  seoulDate,
  toWeatherResponse,
  weatherKind,
  weatherPath,
} from "./weather";

// Open-Meteo v1/forecast 실제 응답(경주 35.83, 129.22 · 2026-09-27 받음)
const SAMPLE = {
  latitude: 35.85,
  longitude: 129.25,
  generationtime_ms: 0.089,
  utc_offset_seconds: 32400,
  timezone: "Asia/Seoul",
  timezone_abbreviation: "GMT+9",
  elevation: 57.0,
  daily_units: {
    time: "iso8601",
    temperature_2m_max: "°C",
    temperature_2m_min: "°C",
    precipitation_sum: "mm",
    weather_code: "wmo code",
  },
  daily: {
    time: ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"],
    temperature_2m_max: [22.5, 25.3, 25.9, 22.9],
    temperature_2m_min: [17.9, 16.8, 18.1, 17.4],
    precipitation_sum: [3.8, 0.0, 0.0, 1.3],
    weather_code: [55, 3, 3, 53],
  },
};

describe("roundCoord", () => {
  it("소수 2자리로 반올림한다", () => {
    expect(roundCoord(35.83456)).toBe(35.83);
    expect(roundCoord(129.225)).toBeCloseTo(129.23, 2);
    expect(roundCoord(-33.8671)).toBe(-33.87);
    expect(roundCoord(37)).toBe(37);
  });
});

describe("parseWeatherQuery", () => {
  it("숫자 좌표를 반올림해 돌려준다", () => {
    expect(parseWeatherQuery("35.83456", "129.2211")).toEqual({
      lat: 35.83,
      lng: 129.22,
    });
  });

  it("경계값은 받는다", () => {
    expect(parseWeatherQuery("-90", "180")).toEqual({ lat: -90, lng: 180 });
  });

  it("빠졌거나 숫자가 아니면 null", () => {
    expect(parseWeatherQuery(null, "129")).toBeNull();
    expect(parseWeatherQuery("35", null)).toBeNull();
    expect(parseWeatherQuery("", "129")).toBeNull();
    expect(parseWeatherQuery(" ", "129")).toBeNull();
    expect(parseWeatherQuery("abc", "129")).toBeNull();
    expect(parseWeatherQuery("35", "NaN")).toBeNull();
    expect(parseWeatherQuery("Infinity", "129")).toBeNull();
  });

  it("범위를 벗어나면 null", () => {
    expect(parseWeatherQuery("90.01", "129")).toBeNull();
    expect(parseWeatherQuery("-91", "129")).toBeNull();
    expect(parseWeatherQuery("35", "180.5")).toBeNull();
    expect(parseWeatherQuery("35", "-181")).toBeNull();
  });
});

describe("seoulDate", () => {
  it("한국 시간(UTC+9)의 날짜를 쓴다", () => {
    // 한국 00:05 = UTC 전날 15:05
    expect(seoulDate(new Date("2026-09-27T15:05:00Z"))).toBe("2026-09-28");
    // 한국 23:55 = UTC 같은 날 14:55
    expect(seoulDate(new Date("2026-09-28T14:55:00Z"))).toBe("2026-09-28");
    // 연말 경계
    expect(seoulDate(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });
});

describe("addDays", () => {
  it("달 · 해 경계를 넘긴다", () => {
    expect(addDays("2026-09-28", -1)).toBe("2026-09-27");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("openMeteoUrl", () => {
  it("PoC와 같은 값을 한국 날짜 어제 ~ 내일로 부른다", () => {
    const url = new URL(
      openMeteoUrl(35.83, 129.22, new Date("2026-09-28T03:00:00Z")),
    );
    expect(url.origin + url.pathname).toBe(
      "https://api.open-meteo.com/v1/forecast",
    );
    expect(url.searchParams.get("latitude")).toBe("35.83");
    expect(url.searchParams.get("longitude")).toBe("129.22");
    expect(url.searchParams.get("daily")).toBe(
      "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
    );
    expect(url.searchParams.get("timezone")).toBe("Asia/Seoul");
    expect(url.searchParams.get("start_date")).toBe("2026-09-27");
    expect(url.searchParams.get("end_date")).toBe("2026-09-29");
    // 날짜가 주소에 들어가야 날이 바뀔 때 캐시 키도 바뀐다
    expect(url.searchParams.has("past_days")).toBe(false);
    expect(url.searchParams.has("forecast_days")).toBe(false);
  });

  it("한국 자정을 막 넘기면(UTC로는 전날) 새 날짜로 부른다", () => {
    const before = new URL(
      openMeteoUrl(35.83, 129.22, new Date("2026-09-27T14:55:00Z")),
    );
    const after = new URL(
      openMeteoUrl(35.83, 129.22, new Date("2026-09-27T15:05:00Z")),
    );
    expect(before.searchParams.get("start_date")).toBe("2026-09-26");
    expect(before.searchParams.get("end_date")).toBe("2026-09-28");
    expect(after.searchParams.get("start_date")).toBe("2026-09-27");
    expect(after.searchParams.get("end_date")).toBe("2026-09-29");
    expect(before.toString()).not.toBe(after.toString());
  });
});

describe("pickWeatherDays", () => {
  const days = [
    { date: "2026-09-26", max: 22.5, min: 17.9, rain: 3.8, code: 55 },
    { date: "2026-09-27", max: 25.3, min: 16.8, rain: 0, code: 3 },
    { date: "2026-09-28", max: 25.9, min: 18.1, rain: 0, code: 3 },
  ];

  it("한국 날짜로 어제 · 오늘 · 내일 칸을 고른다", () => {
    // 한국 2026-09-27 12:00
    expect(pickWeatherDays(days, new Date("2026-09-27T03:00:00Z"))).toEqual({
      yesterday: days[0],
      today: days[1],
      tomorrow: days[2],
    });
  });

  it("며칠 지난 응답이면 순번이 아니라 날짜로 맞추고 없는 칸은 null", () => {
    // 한국 2026-09-28 00:05 — 응답은 하루 전 것
    expect(pickWeatherDays(days, new Date("2026-09-27T15:05:00Z"))).toEqual({
      yesterday: days[1],
      today: days[2],
      tomorrow: null,
    });
    // 한국 2026-10-01 — 맞는 날짜가 하나도 없다
    expect(pickWeatherDays(days, new Date("2026-10-01T03:00:00Z"))).toEqual({
      yesterday: null,
      today: null,
      tomorrow: null,
    });
  });
});

describe("weatherPath", () => {
  it("좌표를 반올림한 우리 주소", () => {
    expect(weatherPath(35.83456, 129.2211)).toBe(
      "/api/weather?lat=35.83&lng=129.22",
    );
  });
});

describe("toWeatherResponse", () => {
  it("어제 · 오늘 · 내일 3일로 줄인다(모레는 버린다)", () => {
    expect(toWeatherResponse(SAMPLE)).toEqual({
      days: [
        { date: "2026-09-26", max: 22.5, min: 17.9, rain: 3.8, code: 55 },
        { date: "2026-09-27", max: 25.3, min: 16.8, rain: 0, code: 3 },
        { date: "2026-09-28", max: 25.9, min: 18.1, rain: 0, code: 3 },
      ],
    });
  });

  it("값이 빠진 칸은 null(강수량은 0)", () => {
    const body = {
      daily: {
        time: ["2026-09-26", "2026-09-27", "2026-09-28"],
        temperature_2m_max: [null, 25.3, 25.9],
        temperature_2m_min: [17.9, null, 18.1],
        precipitation_sum: [null, 0.4, 0],
        weather_code: [0, 61, null],
      },
    };
    expect(toWeatherResponse(body)?.days).toEqual([
      { date: "2026-09-26", max: null, min: 17.9, rain: 0, code: 0 },
      { date: "2026-09-27", max: 25.3, min: null, rain: 0.4, code: 61 },
      { date: "2026-09-28", max: 25.9, min: 18.1, rain: 0, code: null },
    ]);
  });

  it("모양이 틀리면 null", () => {
    expect(toWeatherResponse(null)).toBeNull();
    expect(toWeatherResponse("x")).toBeNull();
    expect(toWeatherResponse({})).toBeNull();
    expect(
      toWeatherResponse({ error: true, reason: "Latitude must be in range" }),
    ).toBeNull();
    expect(toWeatherResponse({ daily: { time: ["2026-09-26"] } })).toBeNull();
    expect(toWeatherResponse({ daily: { time: [1, 2, 3] } })).toBeNull();
  });
});

describe("weatherKind", () => {
  it("WMO 코드 표대로 묶는다", () => {
    expect(weatherKind(0)).toBe("clear");
    for (const c of [1, 2, 3]) expect(weatherKind(c)).toBe("cloudy");
    for (const c of [45, 48]) expect(weatherKind(c)).toBe("fog");
    for (const c of [51, 53, 55, 56, 57])
      expect(weatherKind(c)).toBe("drizzle");
    for (const c of [61, 63, 65, 66, 67]) expect(weatherKind(c)).toBe("rain");
    for (const c of [71, 73, 75, 77]) expect(weatherKind(c)).toBe("snow");
    for (const c of [80, 81, 82]) expect(weatherKind(c)).toBe("showers");
    for (const c of [85, 86]) expect(weatherKind(c)).toBe("snowShowers");
    for (const c of [95, 96, 99]) expect(weatherKind(c)).toBe("thunderstorm");
  });

  it("표에 없는 코드 · 값 없음은 unknown", () => {
    expect(weatherKind(null)).toBe("unknown");
    expect(weatherKind(4)).toBe("unknown");
    expect(weatherKind(50)).toBe("unknown");
    expect(weatherKind(100)).toBe("unknown");
  });
});
