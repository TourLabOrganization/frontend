import { describe, expect, it } from "vitest";
import {
  openMeteoUrl,
  parseWeatherQuery,
  roundCoord,
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

describe("openMeteoUrl", () => {
  it("PoC와 같은 인자로 부른다", () => {
    const url = new URL(openMeteoUrl(35.83, 129.22));
    expect(url.origin + url.pathname).toBe(
      "https://api.open-meteo.com/v1/forecast",
    );
    expect(url.searchParams.get("latitude")).toBe("35.83");
    expect(url.searchParams.get("longitude")).toBe("129.22");
    expect(url.searchParams.get("daily")).toBe(
      "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
    );
    expect(url.searchParams.get("timezone")).toBe("Asia/Seoul");
    expect(url.searchParams.get("past_days")).toBe("1");
    expect(url.searchParams.get("forecast_days")).toBe("3");
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
