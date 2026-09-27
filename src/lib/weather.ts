// 장소 시트의 날씨(어제 · 오늘 · 내일). Open-Meteo(키 없음)를 Route Handler(app/api/weather)가 대신 부르고,
// 장소 시트(components/ui/PlaceWeather)가 그 결과를 그린다. 여기에는 두 쪽이 함께 쓰는 순수 함수만 둔다.
// PoC shared.js의 _openMeteo와 같은 인자로 부른다.

/** Open-Meteo 일별 예보 주소 */
export const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
/** Open-Meteo 호출 시간 제한(ms) */
export const WEATHER_TIMEOUT_MS = 8000;
/**
 * 같은 좌표의 날씨를 다시 받는 간격(초). Open-Meteo 일별 예보는 몇 시간마다 갱신되므로 30분이면 충분히 새롭고,
 * 장소 시트를 열 때마다 외부를 부르지 않게 한다. 클라이언트 staleTime도 이 값에 맞춘다
 */
export const WEATHER_REVALIDATE_SECONDS = 1800;

/** 하루 날씨 */
export type WeatherDay = {
  /** 날짜(한국 시간, YYYY-MM-DD) */
  date: string;
  /** 최고 기온(°C). 값이 없으면 null */
  max: number | null;
  /** 최저 기온(°C). 값이 없으면 null (화면에는 보이지 않는다 — PoC와 같다) */
  min: number | null;
  /** 강수량 합(mm). 값이 없으면 0 (PoC와 같다) */
  rain: number;
  /** WMO 날씨 코드(Open-Meteo weather_code). 값이 없으면 null */
  code: number | null;
};

/** GET /api/weather 응답 */
export type WeatherResponse = {
  /** 어제 · 오늘 · 내일 순서 3일 */
  days: WeatherDay[];
};

/** 좌표를 소수 2자리(약 1km)로 반올림한다. 같은 동네를 같은 캐시로 묶는다 */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 쿼리의 lat · lng를 검사한다. 숫자가 아니거나 범위(위도 −90–90, 경도 −180–180)를 벗어나면 null.
 * 통과하면 소수 2자리로 반올림한 좌표를 돌려준다
 */
export function parseWeatherQuery(
  lat: string | null,
  lng: string | null,
): { lat: number; lng: number } | null {
  if (lat === null || lng === null) return null;
  if (lat.trim() === "" || lng.trim() === "") return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: roundCoord(la), lng: roundCoord(ln) };
}

/** Open-Meteo 호출 주소 (PoC와 같은 인자: 어제부터 3일, 한국 시간) */
export function openMeteoUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
    timezone: "Asia/Seoul",
    past_days: "1",
    forecast_days: "3",
  });
  return `${OPEN_METEO_URL}?${params}`;
}

type OpenMeteoDaily = {
  time?: unknown;
  temperature_2m_max?: unknown;
  temperature_2m_min?: unknown;
  precipitation_sum?: unknown;
  weather_code?: unknown;
};

function numAt(list: unknown, i: number): number | null {
  if (!Array.isArray(list)) return null;
  const v: unknown = list[i];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Open-Meteo 응답을 우리 모양으로 줄인다. past_days=1이라 daily 첫 3칸이 어제 · 오늘 · 내일이다
 * (forecast_days=3이면 4칸이 오고 마지막 모레는 버린다). 모양이 틀리면 null
 */
export function toWeatherResponse(body: unknown): WeatherResponse | null {
  if (typeof body !== "object" || body === null) return null;
  const daily = (body as { daily?: OpenMeteoDaily }).daily;
  if (typeof daily !== "object" || daily === null) return null;
  const time = daily.time;
  if (!Array.isArray(time) || time.length < 3) return null;
  const days: WeatherDay[] = [];
  for (let i = 0; i < 3; i++) {
    const date: unknown = time[i];
    if (typeof date !== "string") return null;
    days.push({
      date,
      max: numAt(daily.temperature_2m_max, i),
      min: numAt(daily.temperature_2m_min, i),
      rain: numAt(daily.precipitation_sum, i) ?? 0,
      code: numAt(daily.weather_code, i),
    });
  }
  return { days };
}

/** 날씨 종류. 아이콘과 화면 읽기용 이름(messages PlaceSheet.weatherKinds)의 키다 */
export type WeatherKind =
  | "clear"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "showers"
  | "snowShowers"
  | "thunderstorm"
  | "unknown";

/**
 * WMO 날씨 코드 → 종류. Open-Meteo 문서의 WMO 코드 표대로 묶는다
 * (맑음 0 · 구름 1–3 · 안개 45 · 48 · 이슬비 51–57 · 비 61–67 · 눈 71–77 · 소나기 80–82 · 눈 소나기 85–86 · 뇌우 95–99).
 * 표에 없는 코드 · 값 없음은 unknown
 */
export function weatherKind(code: number | null): WeatherKind {
  if (code === null) return "unknown";
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code === 85 || code === 86) return "snowShowers";
  if (code >= 95 && code <= 99) return "thunderstorm";
  return "unknown";
}

/** 브라우저가 부르는 우리 Route Handler 주소 (좌표는 서버와 같게 반올림해 같은 캐시를 쓴다) */
export function weatherPath(lat: number, lng: number): string {
  return `/api/weather?lat=${roundCoord(lat)}&lng=${roundCoord(lng)}`;
}
