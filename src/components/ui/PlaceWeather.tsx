"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSunRain,
  type LucideIcon,
  ExternalLink,
  Snowflake,
  Sun,
  Thermometer,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import {
  AIR_REVALIDATE_SECONDS,
  AIR_TIMEOUT_MS,
  type AirGrade,
  type AirQuality,
  airPath,
} from "@/lib/air-quality";
import {
  pickWeatherDays,
  roundCoord,
  WEATHER_REVALIDATE_SECONDS,
  WEATHER_TIMEOUT_MS,
  type WeatherDay,
  type WeatherKind,
  weatherKind,
  weatherPath,
  type WeatherResponse,
} from "@/lib/weather";
import { Button } from "./Button";
import { useTourApi } from "./tour-api-context";

/** 날씨 종류 → lucide 아이콘 (WMO 코드 묶음은 lib/weather.ts의 weatherKind) */
const KIND_ICON: Record<WeatherKind, LucideIcon> = {
  clear: Sun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  showers: CloudSunRain,
  snowShowers: Snowflake,
  thunderstorm: CloudLightning,
  unknown: Thermometer,
};

async function fetchAir(
  lat: number,
  lng: number,
  id: string | undefined,
): Promise<AirQuality> {
  const res = await fetch(airPath(lat, lng, id), {
    signal: AbortSignal.timeout(AIR_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`air ${res.status}`);
  return (await res.json()) as AirQuality;
}

async function fetchWeather(
  lat: number,
  lng: number,
): Promise<WeatherResponse> {
  const res = await fetch(weatherPath(lat, lng), {
    signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  return (await res.json()) as WeatherResponse;
}

/**
 * 장소 시트의 날씨 칸(PoC 장소 상세의 날씨 칸). 오늘은 크게, 어제 · 내일은 작게 — 아이콘 · 최고 기온 · 강수량.
 * 시트가 열려 이 칸이 그려질 때만 우리 Route Handler(/api/weather)를 부른다
 */
export function PlaceWeather({
  lat,
  lng,
  id,
}: {
  lat: number;
  lng: number;
  /** 플래너 장소 id. 있으면 미세먼지 시도를 그 장소의 시군구로 정한다 */
  id?: string;
}) {
  const t = useTranslations("PlaceSheet.weather");
  const ts = useTranslations("PlaceSheet");
  const titleId = useId();
  const rLat = roundCoord(lat);
  const rLng = roundCoord(lng);
  const query = useQuery({
    queryKey: ["weather", rLat, rLng],
    queryFn: () => fetchWeather(rLat, rLng),
    // Route Handler가 같은 좌표를 30분 캐시하므로 그 안에는 다시 부르지 않는다
    staleTime: WEATHER_REVALIDATE_SECONDS * 1000,
    retry: 1,
  });
  // 캐시된 응답은 날짜가 밀려 있을 수 있어 순번이 아니라 날짜(한국)로 칸을 고른다. 불러오는 중이면 undefined
  const cells = query.data
    ? pickWeatherDays(query.data.days, new Date())
    : undefined;

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={query.isPending}
      className="mt-5 rounded-card border border-line"
    >
      <div className="flex items-center justify-between gap-3 pl-4">
        <h3 id={titleId} className="text-label font-bold">
          {t("title")}
        </h3>
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 rounded-2xl px-4 text-micro text-fg-subtle underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-bright"
        >
          {t("credit")}
          <ExternalLink size={16} aria-hidden />
          <span className="sr-only">{ts("newWindow")}</span>
        </a>
      </div>

      {query.isError ? (
        <div
          role="alert"
          className="flex min-h-28 items-center gap-3 border-t border-line px-4 py-3"
        >
          <p className="flex-1 text-label text-fg-muted">{t("error")}</p>
          <Button
            variant="secondary"
            size="md"
            onClick={() => void query.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] border-t border-line">
          {query.isPending && (
            <p role="status" className="sr-only">
              {t("loading")}
            </p>
          )}
          <TodayCell day={cells?.today} label={t("today")} />
          <div className="flex flex-col divide-y divide-line border-l border-line">
            <SmallDayRow day={cells?.yesterday} label={t("yesterday")} />
            <SmallDayRow day={cells?.tomorrow} label={t("tomorrow")} />
          </div>
        </div>
      )}
      <AirRow lat={rLat} lng={rLng} id={id} />
    </section>
  );
}

/** 등급 → 글자색(1 좋음 · 2 보통 · 3 나쁨 · 4 매우나쁨, PoC AIR_COLOR 순서를 앱 토큰으로) */
const GRADE_TEXT: Record<Exclude<AirGrade, 0>, string> = {
  1: "text-primary",
  2: "text-cat-heal",
  3: "text-warning",
  4: "text-danger",
};

/**
 * 날씨 칸 아래 「미세먼지」 줄(PoC 날씨 · 미세먼지 칸의 d_air). 에어코리아 시도 평균 PM10 · PM2.5와 둘 중 나쁜 등급.
 * 서버에 공공데이터포털 키가 없거나(에어코리아 활용신청 포함) 값이 없으면 줄을 숨긴다(PoC와 같다)
 */
function AirRow({
  lat,
  lng,
  id,
}: {
  lat: number;
  lng: number;
  id: string | undefined;
}) {
  const t = useTranslations("PlaceSheet.air");
  const locale = useLocale();
  const enabled = useTourApi();
  const query = useQuery({
    queryKey: ["air", lat, lng, id ?? null],
    queryFn: () => fetchAir(lat, lng, id),
    staleTime: AIR_REVALIDATE_SECONDS * 1000,
    retry: false,
    enabled,
  });
  const air = query.data;
  if (!air || air.grade === 0) return null;
  const num = new Intl.NumberFormat(locale);
  const value = (v: number | null) => (v === null ? "–" : num.format(v));
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-caption font-semibold">
          {t("title", { sido: t(`sido.${air.sido}`) })}
        </span>
        <span className="text-caption text-fg-muted tabular-nums">
          {t("values", { pm10: value(air.pm10), pm25: value(air.pm25) })}
        </span>
      </div>
      <span
        className={`shrink-0 rounded-full bg-fill px-3 py-1 text-label font-bold ${GRADE_TEXT[air.grade]}`}
      >
        {t(`grade.${air.grade}`)}
      </span>
    </div>
  );
}

function useWeatherFormat() {
  const locale = useLocale();
  const temp = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "celsius",
    maximumFractionDigits: 0,
  });
  const rain = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "millimeter",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return {
    temp: (v: number | null) => (v === null ? "–" : temp.format(Math.round(v))),
    rain: (v: number) => rain.format(v),
  };
}

function WeatherIcon({ code, size }: { code: number | null; size: number }) {
  const t = useTranslations("PlaceSheet.weather.kinds");
  const kind = weatherKind(code);
  const Icon = KIND_ICON[kind];
  return (
    <Icon
      size={size}
      role="img"
      aria-label={t(kind)}
      className="shrink-0 text-primary-bright"
    />
  );
}

/** 불러오는 동안의 자리. 값이 들어와도 크기가 같게 줄 높이를 맞춘다 */
function Placeholder({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`animate-pulse rounded-lg bg-fill motion-reduce:animate-none ${className}`}
    />
  );
}

/** undefined = 불러오는 중(자리), null = 응답에 그 날짜가 없음(「–」) */
type DayCell = WeatherDay | null | undefined;

function TodayCell({ day, label }: { day: DayCell; label: string }) {
  const t = useTranslations("PlaceSheet.weather");
  const f = useWeatherFormat();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {day ? (
        <WeatherIcon code={day.code} size={24} />
      ) : day === null ? (
        <WeatherIcon code={null} size={24} />
      ) : (
        <Placeholder className="block size-6 shrink-0" />
      )}
      <div className="flex min-w-0 flex-col">
        <span className="text-caption font-semibold text-primary">{label}</span>
        {day ? (
          <>
            <span className="text-title font-bold tabular-nums">
              <span className="sr-only">{t("max")} </span>
              {f.temp(day.max)}
            </span>
            <span className="text-caption whitespace-nowrap text-fg-muted tabular-nums">
              <span className="sr-only">{t("rain")} </span>
              {f.rain(day.rain)}
            </span>
          </>
        ) : day === null ? (
          <span className="text-title font-bold">–</span>
        ) : (
          <>
            <span className="text-title">
              <Placeholder className="inline-block h-6 w-14 align-middle" />
            </span>
            <span className="text-caption">
              <Placeholder className="inline-block h-3 w-12 align-middle" />
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function SmallDayRow({ day, label }: { day: DayCell; label: string }) {
  const t = useTranslations("PlaceSheet.weather");
  const f = useWeatherFormat();
  // 좁은 폭(390px)에서 스페인어 「Mañana 25 °C · 0,0 mm」가 한 줄에 들어가지 않아 이름과 값을 두 줄로 둔다
  return (
    <div className="flex flex-1 items-center gap-2 px-3 py-2">
      {day ? (
        <WeatherIcon code={day.code} size={20} />
      ) : day === null ? (
        <WeatherIcon code={null} size={20} />
      ) : (
        <Placeholder className="block size-5 shrink-0" />
      )}
      <div className="flex min-w-0 flex-col">
        <span className="text-caption font-semibold">{label}</span>
        {day ? (
          <span className="text-caption whitespace-nowrap text-fg-muted tabular-nums">
            <span className="sr-only">{t("max")} </span>
            {f.temp(day.max)}
            {" · "}
            <span className="sr-only">{t("rain")} </span>
            {f.rain(day.rain)}
          </span>
        ) : day === null ? (
          <span className="text-caption text-fg-muted">–</span>
        ) : (
          <span className="text-caption">
            <Placeholder className="inline-block h-3 w-16 align-middle" />
          </span>
        )}
      </div>
    </div>
  );
}
