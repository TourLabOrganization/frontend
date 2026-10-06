"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useTourApi } from "@/components/ui/tour-api-context";
import { useNameTable } from "@/features/names/NamesProvider";
import { rememberPlace } from "@/features/planner/extra-places";
import { plannerHref } from "@/features/planner/query";
import { cityName } from "@/features/planner/regions";
import { placeName } from "@/features/theme/place-meta";
import {
  POPULAR_FALLBACK,
  popularFallback,
} from "@/features/home/popular-fallback";
import { searchCities } from "@/features/home/popular-search";
import { POPULAR_CITY_KEY, useLocalValue, writeLocal } from "@/lib/local-store";
import { markSheetReturn } from "@/lib/sheet-return";
import {
  type CrowdLevel,
  crowdLevel,
  POPULAR_CITIES,
  POPULAR_SEARCH_CITIES,
  type PopularCity,
  popularPath,
  POPULAR_SEARCH_MIN_PLACES,
  TOUR_CROWD_SECONDS,
  TOUR_TIMEOUT_MS,
  type TourEmpty,
  type TourPopular,
} from "@/lib/tour";

const LEVEL_TEXT: Record<CrowdLevel, string> = {
  quiet: "text-primary",
  moderate: "text-warning",
  busy: "text-danger",
};

async function fetchPopular(
  city: string,
  locale: string,
): Promise<TourPopular | TourEmpty> {
  const res = await fetch(popularPath(city, locale), {
    // 서버가 시군구 여러 곳(쪽 여러 개)을 부르므로 한 칸보다 넉넉히 기다린다
    signal: AbortSignal.timeout(TOUR_TIMEOUT_MS * 3),
  });
  if (!res.ok) throw new Error(`popular ${res.status}`);
  return (await res.json()) as TourPopular | TourEmpty;
}

// 홈 「지금 인기 관광지」. 도시 칩을 고르면 그 도시의 관광지를 오늘 방문 집중률(한국관광공사 예측)이 높은 순으로 10곳 보인다.
// 앱 장소와 이름이 맞는 곳은 투어 플래너 지도에서 그 장소 시트를 연다.
// 서버에 공공데이터포털 키가 없거나 호출이 실패 · 비면 수기 목록(features/home/popular-fallback.ts, 순위만 · 집중률 없음)을 보인다(2026-10-03)
export function PopularAttractions() {
  const t = useTranslations("Home.attractions");
  const tl = useTranslations("PlaceSheet.tour.crowd.levels");
  const locale = useLocale();
  const names = useNameTable();
  const enabled = useTourApi();
  const id = useId();
  // 고른 도시는 이 브라우저에 둔다(장소를 열었다가 돌아오면 같은 도시 · 같은 자리). 서버 렌더와 첫 수화는 첫 도시
  const stored = useLocalValue(POPULAR_CITY_KEY);
  const city: PopularCity =
    POPULAR_SEARCH_CITIES.find((c) => c === stored) ?? POPULAR_CITIES[0];
  const setCity = (c: PopularCity) => writeLocal(POPULAR_CITY_KEY, c);
  // 검색칸(춘천 칩 자리, 2026-10-06): 관광지 50곳 이상인 도시를 이름으로 찾아 고른다
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const chipCity = (POPULAR_CITIES as readonly string[]).includes(city);
  const matches = searchCities(q, locale, names);
  const pick = (c: PopularCity) => {
    setCity(c);
    setSearching(false);
    setQ("");
  };
  const query = useQuery({
    queryKey: ["popular", city, locale],
    queryFn: () => fetchPopular(city, locale),
    staleTime: TOUR_CROWD_SECONDS * 1000,
    retry: false,
    enabled,
  });
  const data = query.data && "items" in query.data ? query.data : null;
  // 수기 목록을 보일 때: 키가 없거나, 호출이 실패했거나, 결과가 비었을 때
  const fallback =
    !enabled || query.isError || (query.isSuccess && !data)
      ? popularFallback(city)
      : [];
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "long",
      day: "numeric",
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  const dateLabel = data ? formatDate(data.date) : "";
  const fallbackDate = formatDate(POPULAR_FALLBACK.date);
  const rowClass = "flex min-h-14 items-center gap-3 px-3 py-2 text-left";

  return (
    <section className="mt-10 px-5" aria-labelledby={`${id}-title`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${id}-title`} className="text-headline font-bold">
          {t("heading")}
        </h2>
        {data && (
          <span className="text-caption text-fg-subtle tabular-nums">
            {t("date", { date: dateLabel })}
          </span>
        )}
        {!data && fallback.length > 0 && (
          <span className="text-caption text-fg-subtle tabular-nums">
            {t("fallbackDate", { date: fallbackDate })}
          </span>
        )}
      </div>
      <p className="mt-1 text-caption text-fg-muted">
        {fallback.length > 0 ? t("fallbackNote") : t("note")}
      </p>

      <div
        role="group"
        aria-label={t("citiesLabel")}
        // 도시 칩 9곳 + 검색칸을 5칸 두 줄로(좌우 스크롤 없이)
        className="mt-3 grid grid-cols-5 gap-2"
      >
        {POPULAR_CITIES.map((c) => {
          const pressed = c === city;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={pressed}
              onClick={() => setCity(c)}
              className={`flex min-h-11 min-w-0 items-center justify-center rounded-xl px-1 text-center text-label break-keep transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                pressed
                  ? "bg-primary-weak font-semibold text-primary-strong"
                  : "bg-fill font-medium text-fg-muted active:bg-line"
              }`}
            >
              {cityName(c, locale, names)}
            </button>
          );
        })}
        <button
          type="button"
          aria-expanded={searching}
          aria-controls={`${id}-search`}
          aria-pressed={!chipCity}
          onClick={() => setSearching((v) => !v)}
          className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-1 text-center text-label break-keep transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
            !chipCity
              ? "bg-primary-weak font-semibold text-primary-strong"
              : "bg-fill font-medium text-fg-muted active:bg-line"
          }`}
        >
          <Search size={16} aria-hidden className="shrink-0" />
          <span className="truncate">
            {chipCity ? t("search") : cityName(city, locale, names)}
          </span>
        </button>
      </div>

      {searching && (
        <div id={`${id}-search`} className="mt-2 rounded-card bg-fill p-3">
          <label htmlFor={`${id}-q`} className="sr-only">
            {t("search")}
          </label>
          <input
            id={`${id}-q`}
            type="search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearching(false);
              if (e.key === "Enter" && matches.length > 0) pick(matches[0]);
            }}
            placeholder={t("searchPlaceholder", {
              count: POPULAR_SEARCH_MIN_PLACES,
            })}
            className="h-11 w-full rounded-xl bg-surface px-3 text-body ring-1 ring-line focus-visible:outline-2 focus-visible:outline-primary-bright"
          />
          {matches.length > 0 ? (
            <ul
              aria-label={t("citiesLabel")}
              className="mt-2 flex flex-wrap gap-2"
            >
              {matches.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    aria-pressed={c === city}
                    onClick={() => pick(c)}
                    className={`min-h-11 rounded-xl px-3 text-label transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                      c === city
                        ? "bg-primary-weak font-semibold text-primary-strong"
                        : "bg-surface font-medium text-fg-muted ring-1 ring-line active:bg-line"
                    }`}
                  >
                    {cityName(c, locale, names)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-label text-fg-muted">{t("searchEmpty")}</p>
          )}
        </div>
      )}

      <div aria-live="polite" aria-busy={enabled && query.isFetching}>
        {fallback.length > 0 ? (
          <>
            {enabled && query.isError && (
              <div className="mt-3 flex items-center gap-3 rounded-card bg-fill p-4">
                <p className="flex-1 text-label text-fg-muted">{t("error")}</p>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => void query.refetch()}
                >
                  {t("retry")}
                </Button>
              </div>
            )}
            <ol className="mt-3 flex flex-col divide-y divide-line rounded-card ring-1 ring-line">
              {fallback.map((item, i) => (
                <li key={item.id}>
                  <Link
                    href={plannerHref({ city, place: item.id })}
                    onClick={() => markSheetReturn(item.id)}
                    className={`${rowClass} rounded-card focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill`}
                  >
                    <span className="w-6 shrink-0 text-center text-label font-bold text-primary tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body font-semibold">
                      {placeName(item, locale, names)}
                    </span>
                    <ChevronRight
                      size={20}
                      aria-hidden
                      className="shrink-0 text-fg-subtle"
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </>
        ) : !enabled ? (
          <p className="mt-3 rounded-card bg-fill p-4 text-label text-fg-muted">
            {t("empty", { city: cityName(city, locale, names) })}
          </p>
        ) : query.isPending ? (
          <ul aria-hidden className="mt-3 flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <li
                key={i}
                className="h-14 animate-pulse rounded-card bg-fill motion-reduce:animate-none"
              />
            ))}
          </ul>
        ) : query.isError ? (
          <div className="mt-3 flex items-center gap-3 rounded-card bg-fill p-4">
            <p className="flex-1 text-label text-fg-muted">{t("error")}</p>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void query.refetch()}
            >
              {t("retry")}
            </Button>
          </div>
        ) : !data ? (
          <p className="mt-3 rounded-card bg-fill p-4 text-label text-fg-muted">
            {t("empty", { city: cityName(city, locale, names) })}
          </p>
        ) : (
          <ol className="mt-3 flex flex-col divide-y divide-line rounded-card ring-1 ring-line">
            {data.items.map((item, i) => {
              const pct = Math.round(item.rate);
              const level = crowdLevel(item.rate);
              const body = (
                <>
                  <span className="w-6 shrink-0 text-center text-label font-bold text-primary tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-semibold">
                      {item.name}
                    </span>
                    {/* 막대를 구 이름 앞에 두어 모든 줄에서 같은 자리에서 시작한다(구 이름 길이와 무관).
                        10곳이 대개 모두 혼잡이라 막대는 브랜드 색으로 두고, 수준은 글자 색으로만 알린다 */}
                    <span className="mt-1 flex items-center gap-2 text-caption text-fg-muted">
                      <span
                        aria-hidden
                        className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-fill"
                      >
                        <span
                          className="block h-full rounded-full bg-primary-bright"
                          style={{
                            width: `${Math.min(100, Math.max(2, pct))}%`,
                          }}
                        />
                      </span>
                      {locale === "ko" && item.district && (
                        <span className="truncate">{item.district}</span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-caption tabular-nums">
                    <span className="block text-label font-bold">{pct}%</span>
                    <span className={`font-semibold ${LEVEL_TEXT[level]}`}>
                      {tl(level)}
                    </span>
                  </span>
                  {/* 앱 장소와 연결되지 않은 줄도 화살표 자리를 비워 두어 % 열이 줄마다 같은 자리에 온다 */}
                  {item.id ? (
                    <ChevronRight
                      size={20}
                      aria-hidden
                      className="shrink-0 text-fg-subtle"
                    />
                  ) : (
                    <span aria-hidden className="size-5 shrink-0" />
                  )}
                </>
              );
              const row = rowClass;
              return (
                <li key={`${item.district}|${item.name}`}>
                  {item.id ? (
                    <Link
                      href={plannerHref({ city, place: item.id })}
                      // 신규 관광지(앱 장소 데이터에 없는 곳)는 기억해 두어 지도 · 코스에서 앱 장소처럼 쓴다.
                      // 시트를 닫으면 이 목록(같은 도시 · 같은 스크롤)으로 돌아온다(lib/sheet-return.ts)
                      onClick={() => {
                        if (item.place) rememberPlace(item.place);
                        if (item.id) markSheetReturn(item.id);
                      }}
                      className={`${row} rounded-card focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={row}>{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-micro text-fg-subtle">
        <UsersRound size={14} aria-hidden className="shrink-0" />
        {fallback.length > 0 ? t("fallbackSource") : t("source")}
      </p>
    </section>
  );
}
