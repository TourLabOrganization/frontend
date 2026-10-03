import {
  openMeteoUrl,
  parseWeatherQuery,
  parseWeatherRange,
  rangeDays,
  toWeatherResponse,
  WEATHER_REVALIDATE_SECONDS,
  WEATHER_TIMEOUT_MS,
} from "@/lib/weather";

// 장소 시트의 날씨(어제 · 오늘 · 내일). 브라우저는 이 주소만 부르고, 외부 Open-Meteo는 서버에서 부른다(AGENTS.md 3).
// Open-Meteo는 키가 없다. 출처 표기(CC BY 4.0)는 장소 시트가 한다(components/ui/PlaceWeather).
// from · to(YYYY-MM-DD, 어제 ~ 오늘 + 15일)를 주면 그 범위를 받는다(코스 탭의 일자별 날씨 경고, features/planner/course-weather.ts)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coord = parseWeatherQuery(
    searchParams.get("lat"),
    searchParams.get("lng"),
  );
  if (!coord)
    return Response.json({ message: "invalid lat/lng" }, { status: 400 });
  const now = new Date();
  const range = parseWeatherRange(
    searchParams.get("from"),
    searchParams.get("to"),
    now,
  );
  if (range === undefined)
    return Response.json({ message: "invalid from/to" }, { status: 400 });

  try {
    const url = openMeteoUrl(coord.lat, coord.lng, now, range ?? undefined);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
      // 일별 예보는 몇 시간마다 바뀐다. 30분 동안은 같은 좌표(소수 2자리로 반올림) · 같은 한국 날짜의 응답을 다시 쓴다
      // (주소에 날짜가 들어가 날이 바뀌면 캐시 키도 바뀐다)
      next: { revalidate: WEATHER_REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const body = toWeatherResponse(
      await res.json(),
      range ? rangeDays(range) : undefined,
    );
    if (!body) throw new Error("open-meteo shape");
    return Response.json(body, {
      headers: {
        "Cache-Control": `public, max-age=${WEATHER_REVALIDATE_SECONDS}`,
      },
    });
  } catch {
    return Response.json({ message: "weather unavailable" }, { status: 502 });
  }
}
