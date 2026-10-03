// 코스 탭의 일자별 날씨 경고(순수 함수). 여행 날짜의 Open-Meteo 예보(lib/weather.ts, /api/weather?from=&to=)를 일정의 날에 붙여
// 비 · 폭염 예보일에 야외 장소를 표시하고, 같은 도시의 실내 장소를 대안으로 고른다. 화면은 PlannerCourseTab이 그린다.
import type { PlannerPlace } from "./data";
import { addDays } from "./dates";
import {
  WEATHER_FORECAST_DAYS,
  type WeatherDay,
  type WeatherRange,
  weatherKind,
} from "../../lib/weather";

/** 하루 강수량이 이 값(mm) 이상이면 비 예보로 본다(날씨 종류가 비 · 소나기 · 뇌우 · 눈이어도 비 예보) */
export const RAIN_ALERT_MM = 5;
/** 최고 기온이 이 값(°C) 이상이면 폭염 예보로 본다(기상청 폭염주의보 기준 체감 33°) */
export const HEAT_ALERT_C = 33;
/** 대안으로 보여 줄 실내 장소 수 */
export const ALT_COUNT = 3;

export type WeatherAlert = "rain" | "heat";

/** 날씨 경고가 보는 장소 필드(플래너 장소 · 테마 장소 공통) */
export type WeatherPlace = Pick<
  PlannerPlace,
  "id" | "ko" | "en" | "cat" | "locKo" | "lat" | "lng"
>;

/** 하루 예보의 경고. 비가 폭염보다 먼저다(둘 다면 비). 예보가 없으면 null */
export function dayAlert(day: WeatherDay | null): WeatherAlert | null {
  if (!day) return null;
  const kind = weatherKind(day.code);
  const wet =
    day.rain >= RAIN_ALERT_MM ||
    kind === "rain" ||
    kind === "showers" ||
    kind === "thunderstorm" ||
    kind === "snow" ||
    kind === "snowShowers";
  if (wet) return "rain";
  if (day.max !== null && day.max >= HEAT_ALERT_C) return "heat";
  return null;
}

/**
 * 실내로 보는 장소: 이름에 실내 시설 말이 든 관광지(박물관 · 미술관 · 기념관 · 전시 · 과학관 · 아쿠아리움 · 도서관 · 극장 ·
 * 백화점 · 아울렛 · 시장 · 온천 · 스파 · 카페 · 체험관 · 타워 · 성당 …). 촬영지 · 공원 · 탐방 같은 야외 말이 함께 들면 야외.
 * 식당 · 숙박은 어느 쪽도 아니다(날씨 경고 대상이 아니다)
 */
const INDOOR =
  /(박물관|미술관|기념관|전시|과학관|아쿠아리움|수족관|도서관|극장|백화점|아울렛|몰$|시장|온천|스파|찜질|카페|서점|체험관|플라자|타워|실내|성당|교회|사우나|키즈|쇼핑)/;
const OUTDOOR_HINT =
  /(촬영지|공원|탐방|둘레길|산책|해변|해수욕장|포구|항$|섬$|오름|폭포|계곡|정원|농원|목장)/;

export function isIndoor(place: Pick<WeatherPlace, "ko" | "cat">): boolean {
  if (place.cat === "stay" || place.cat === "food") return false;
  return INDOOR.test(place.ko) && !OUTDOOR_HINT.test(place.ko);
}

/** 야외로 보는 장소: 관광지(식당 · 숙박 제외) 중 실내가 아닌 곳 */
export function isOutdoor(place: Pick<WeatherPlace, "ko" | "cat">): boolean {
  if (place.cat === "stay" || place.cat === "food") return false;
  return !isIndoor(place);
}

/** 여행 날짜 중 예보가 닿는 범위(오늘 ~ 오늘 + 15일과 겹치는 부분). 안 겹치면 null */
export function forecastRange(
  startDate: string,
  dayCount: number,
  today: string,
): WeatherRange | null {
  const end = addDays(startDate, dayCount - 1);
  const from = startDate < today ? today : startDate;
  const last = addDays(today, WEATHER_FORECAST_DAYS);
  const to = end > last ? last : end;
  return from <= to ? { from, to } : null;
}

function meters(a: WeatherPlace, b: WeatherPlace): number {
  const r = Math.PI / 180;
  const x =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
}

export type FlaggedPlace = {
  place: WeatherPlace;
  /** 같은 도시의 실내 장소(가까운 순, 코스에 없는 곳, 최대 ALT_COUNT) */
  alternatives: PlannerPlace[];
};

export type DayWeather = {
  date: string;
  /** 그날 예보. 범위 밖이거나 응답에 없으면 null */
  weather: WeatherDay | null;
  alert: WeatherAlert | null;
  /** 경고일의 야외 장소(일정 순). 경고가 없으면 빈 배열 */
  flagged: FlaggedPlace[];
};

/**
 * 일정의 날마다 예보와 경고를 붙인다. dates는 일자별 날짜(YYYY-MM-DD), stops는 그날 장소(일정 순).
 * 대안은 pool(모든 플래너 장소)에서 같은 도시 · 실내 · 코스에 없는 곳을 그 장소에서 가까운 순으로 고른다
 */
export function courseWeather(
  days: readonly { stops: readonly { place: WeatherPlace }[] }[],
  dates: readonly string[],
  forecast: readonly WeatherDay[],
  pool: readonly PlannerPlace[],
  inCourse: ReadonlySet<string>,
): DayWeather[] {
  const byDate = new Map(forecast.map((d) => [d.date, d]));
  return days.map((day, i) => {
    const date = dates[i] ?? "";
    const weather = byDate.get(date) ?? null;
    const alert = dayAlert(weather);
    const flagged: FlaggedPlace[] = [];
    if (alert) {
      const seen = new Set<string>();
      for (const { place } of day.stops) {
        if (!isOutdoor(place) || seen.has(place.id)) continue;
        seen.add(place.id);
        const alternatives = pool
          .filter(
            (p) =>
              p.locKo === place.locKo && !inCourse.has(p.id) && isIndoor(p),
          )
          .map((p) => ({ p, d: meters(place, p) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, ALT_COUNT)
          .map((x) => x.p);
        flagged.push({ place, alternatives });
      }
    }
    return { date, weather, alert, flagged };
  });
}
