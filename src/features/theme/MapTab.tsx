"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { SearchField } from "@/components/ui/SearchField";
import { formatDuration } from "@/features/course/format-duration";
import type { Place } from "@/features/course/places";
import { matchesQuery } from "@/lib/text-search";
import {
  cityGroups,
  distanceLabel,
  inCity,
  orderByCities,
  scopeCity,
  type ThemeCity,
} from "./place-list";
import {
  type CategoryKey,
  CATEGORY_KEYS,
  corePlaces,
  isCategoryKey,
  placeName,
  placePhoto,
} from "./place-meta";
import { ThemePlaceSheet, type ThemePlaceText } from "./ThemePlaceSheet";
import { type MapPin, ThemeMap } from "./ThemeMap";
import type { PlaceExtra } from "./theme-data";
import type { NameTable } from "@/features/names/names";
import { useNameTable } from "@/features/names/NamesProvider";

export type SceneLink = {
  /** 시트의 장면 링크 한 줄 */
  text: string;
  /** 영화(영상) 탭의 그 장면 */
  href: string;
  /** 상세 표의 장면 행 */
  row: string;
  /** 이 장소가 나오는 영상(YouTube, 새 창) */
  video?: string;
};

type MapTabProps = {
  slug: string;
  /** 테마의 모든 장소 (핵심 + 목록 밖) */
  places: readonly Place[];
  extras: Readonly<Record<string, PlaceExtra>>;
  /** 장소 id → 시트의 장면 정보 한 줄과 영화 탭 주소 */
  sceneLinks: Readonly<Record<string, SceneLink>>;
  /** 테마 화면의 도시(칩 순서). 둘 이상이면(RESCENE) 전국 · 도시 칩으로 고른다 */
  cities: readonly ThemeCity[];
  /** 도시 한국어 이름(locKo) → 화면 언어 이름. 여러 도시 보기의 목록 행 · 묶음 머리에 쓴다 */
  cityLabels: Readonly<Record<string, string>>;
  /** 영상 테마(RESCENE)면 목록 행의 바로가기가 「영상」 */
  video: boolean;
  /** ?place= 로 들어왔을 때 처음부터 열어 둘 장소 */
  initialPlace?: string;
  /** 장소 id → 화면 언어로 옮긴 운영시간 · 좌표 기준(서버가 만든다). 한국어 화면은 비운다 */
  texts?: Readonly<Record<string, ThemePlaceText>>;
};

type Filter = "all" | CategoryKey;

/** 목록에 처음 보이는 수. 나머지는 「더 보기」로 */
const INITIAL_ROWS = 10;
/** 「더 보기」 한 번에 더 보이는 수(테마 장소는 이보다 적어 한 번에 모두 보인다) */
const PAGE_SIZE = 60;

function toPin(
  p: Place,
  locale: string,
  names: NameTable,
  label?: number,
): MapPin {
  return {
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    title: placeName(p, locale, names),
    label,
  };
}

// 지도 탭. 지역(도시) 줄 → 분류 칩 → 지도(번호 핀) → 장소 목록(접기) → 목록 밖 장소 토글.
// 핀 · 이름 칩 · 목록을 누르면 장소 시트가 열리고 지도가 그 장소로 옮겨 간다.
// 목록 행: 한 도시 보기는 도시 center에서의 거리, 여러 도시 보기(RESCENE 전국)는 도시 이름(목업 규칙, place-list.ts).
// 장면이 있는 장소는 행 오른쪽에 영화(영상) 탭 바로가기
export function MapTab({
  slug,
  places,
  extras,
  sceneLinks,
  cities,
  cityLabels,
  video,
  initialPlace,
  texts,
}: MapTabProps) {
  const t = useTranslations("Theme.map");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const names = useNameTable();
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  const [filter, setFilter] = useState<Filter>("all");
  // 고른 도시(한국어 이름). null = 전국. 도시가 하나뿐인 테마는 고르지 않는다
  const [picked, setPicked] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(INITIAL_ROWS);
  // 「더 보기」 뒤 초점을 옮길 첫 새 행
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [showOff, setShowOff] = useState(
    () => places.find((p) => p.id === initialPlace)?.off ?? false,
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPlace && places.some((p) => p.id === initialPlace)
      ? initialPlace
      : null,
  );

  const categories = CATEGORY_KEYS.filter((c) =>
    places.some((p) => p.cat === c),
  );
  const multiCity = cities.length > 1;
  const city = scopeCity(cities, picked);
  const cityLabel = (c: ThemeCity) =>
    locale === "ko" ? c.ko : names.cities[c.ko] || c.en;
  const inScope = (p: Place) => inCity(p, multiCity ? picked : null);
  // 지역 줄의 장소 수(목업 cityCount): 분류 · 검색과 무관하게 그 지역의 목록 장소, 목록 밖을 펴면 더한다
  const scopeCount = places.filter(
    (p) => inScope(p) && (showOff || !p.off),
  ).length;
  // 지역 · 분류 칩과 검색어(장소 이름 한 · 영)로 거른다. 지도 핀과 목록이 같이 쓴다
  const inFilter = (p: Place) =>
    inScope(p) &&
    (filter === "all" || p.cat === filter) &&
    matchesQuery([p.ko, p.en, placeName(p, locale, names)], query);
  // 여러 도시 테마(RESCENE)는 목록을 도시 칩 순서(경주 · 거제 · 수원 · 정선 · 대전 · 충주 · 동해 — 장소 번호 순)로 묶는다
  const byCity = (list: Place[]) =>
    multiCity ? orderByCities(list, cities) : list;
  const core = byCity(corePlaces(places).filter(inFilter));
  const off = byCity(places.filter((p) => p.off && inFilter(p)));
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const rows = [...core, ...(showOff ? off : [])];
  const visible = rows.slice(0, shown);
  const remaining = rows.length - visible.length;
  // 여러 도시 보기(RESCENE 전국)는 목록을 도시별로 묶는다(「경주 · 7개 장소」)
  const groups =
    multiCity && city === null
      ? new Map(cityGroups(core).map((g) => [g.city, g.count]))
      : null;

  useEffect(() => {
    if (focusIndex === null) return;
    listRef.current
      ?.querySelectorAll<HTMLButtonElement>("[data-row]")
      [focusIndex]?.focus();
  }, [focusIndex]);

  const resetRows = () => {
    setShown(INITIAL_ROWS);
    setFocusIndex(null);
  };

  const meta = (p: Place) => {
    const km = distanceLabel(p, city);
    return [
      isCategoryKey(p.cat) ? tc(`categories.${p.cat}`) : null,
      p.min > 0 ? tc("stay", { duration: formatDuration(tc, p.min) }) : null,
      km !== null ? t("distance", { km }) : (cityLabels[p.locKo] ?? p.locKo),
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const pickCity = (next: string | null) => {
    setPicked(next);
    resetRows();
  };

  const groupHeading = (p: Place, i: number) => {
    if (!groups || p.off || visible[i - 1]?.locKo === p.locKo) return null;
    return (
      <li key={`group-${p.locKo}`} className="px-5 pt-4 pb-1">
        <h3 className="text-label font-semibold text-fg-muted tabular-nums">
          {t("regionCount", {
            city: cityLabels[p.locKo] ?? p.locKo,
            count: groups.get(p.locKo) ?? 0,
          })}
        </h3>
      </li>
    );
  };

  const row = (p: Place) => {
    const img = extras[p.id]?.img;
    const scene = sceneLinks[p.id];
    const name = placeName(p, locale, names);
    return (
      <li key={p.id} className="flex items-center">
        <button
          type="button"
          data-row
          onClick={() => setSelectedId(p.id)}
          className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
        >
          {p.off ? (
            <span className="flex size-[26px] shrink-0 items-center justify-center">
              <span className="size-2.5 rounded-full bg-fg-subtle" />
            </span>
          ) : (
            <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-primary text-caption font-bold text-white tabular-nums">
              {p.n}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-body-lg font-semibold">{name}</span>
            <span className="block text-caption text-fg-subtle">{meta(p)}</span>
            {p.yt && (
              <span className="mt-1.5 block">
                <Chip tone="primary">{tc("videoBadge")}</Chip>
              </span>
            )}
          </span>
          {img && (
            <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-fill">
              <Image
                src={placePhoto(img, 120)}
                alt=""
                fill
                unoptimized
                className="object-cover"
              />
            </span>
          )}
        </button>
        {scene ? (
          <Link
            href={scene.href}
            aria-label={t("filmLinkLabel", { name })}
            className="mr-5 ml-2 inline-flex min-h-11 shrink-0 items-center rounded-lg bg-primary-weak px-3 text-caption font-semibold text-primary-strong transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none"
          >
            {video ? t("videoLink") : t("filmLink")}
          </Link>
        ) : (
          <span className="w-5 shrink-0" />
        )}
      </li>
    );
  };

  return (
    <>
      {multiCity ? (
        <div className="flex items-center gap-3 px-5 pt-3">
          <div
            role="group"
            aria-label={t("regionsLabel")}
            className="flex min-w-0 flex-1 gap-2 overflow-x-auto"
          >
            {[null, ...cities.map((c) => c.ko)].map((key) => {
              const pressed = picked === key;
              const c = cities.find((x) => x.ko === key);
              return (
                <button
                  key={key ?? "nation"}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => pickCity(key)}
                  className={`min-h-11 shrink-0 rounded-xl px-4 text-label whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                    pressed
                      ? "bg-primary-weak font-semibold text-primary-strong"
                      : "bg-fill font-medium text-fg-muted active:bg-line"
                  }`}
                >
                  {c ? cityLabel(c) : t("nation")}
                </button>
              );
            })}
          </div>
          <p className="shrink-0 text-caption text-fg-subtle tabular-nums">
            {t("regionCount", {
              city: city ? cityLabel(city) : t("nation"),
              count: scopeCount,
            })}
          </p>
        </div>
      ) : city ? (
        <p className="px-5 pt-3 text-label font-semibold tabular-nums">
          {t("regionCount", { city: cityLabel(city), count: scopeCount })}
        </p>
      ) : null}

      <div
        role="group"
        aria-label={t("categoriesLabel")}
        className="flex gap-2 overflow-x-auto px-5 py-3"
      >
        {(["all", ...categories] as const).map((c) => {
          const pressed = filter === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={pressed}
              onClick={() => {
                setFilter(c);
                resetRows();
              }}
              className={`min-h-11 shrink-0 rounded-xl px-4 text-label whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                pressed
                  ? "bg-primary-weak font-semibold text-primary-strong"
                  : "bg-fill font-medium text-fg-muted active:bg-line"
              }`}
            >
              {c === "all" ? t("all") : tc(`categories.${c}`)}
            </button>
          );
        })}
      </div>

      <div className="h-[45vh] min-h-72 bg-fill">
        {apiKey ? (
          <ThemeMap
            apiKey={apiKey}
            label={t("mapLabel")}
            pins={[
              ...(showOff ? off : []).map((p) => toPin(p, locale, names)),
              ...core.map((p) => toPin(p, locale, names, p.n ?? undefined)),
            ]}
            focus={selected}
            onSelect={setSelectedId}
          />
        ) : (
          <p
            role="note"
            className="flex h-full items-center justify-center px-6 text-center text-label text-fg-muted"
          >
            {t("noKey")}
          </p>
        )}
      </div>

      <section aria-labelledby="place-list-heading" className="pt-5">
        <h2 id="place-list-heading" className="px-5">
          <button
            type="button"
            aria-expanded={listOpen}
            aria-controls="place-list-body"
            onClick={() => setListOpen((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl text-left text-headline font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
          >
            {t("listHeading", { count: core.length })}
            <ChevronDown
              size={24}
              aria-hidden
              className={`shrink-0 text-fg-muted transition-transform duration-150 motion-reduce:transition-none ${listOpen ? "" : "-rotate-90"}`}
            />
          </button>
        </h2>
        <div id="place-list-body" hidden={!listOpen}>
          <SearchField
            value={query}
            onChange={(q) => {
              setQuery(q);
              resetRows();
            }}
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            clearLabel={t("searchClear")}
            className="mx-5 mt-3"
          />
          <p role="status" className="sr-only">
            {query.trim() ? t("searchStatus", { count: rows.length }) : ""}
          </p>
          {rows.length === 0 && query.trim() ? (
            <p className="px-5 py-10 text-center text-body text-fg-muted">
              {t("searchEmpty", { query: query.trim() })}
            </p>
          ) : (
            <ul ref={listRef} className="mt-2">
              {visible.map((p, i) => [groupHeading(p, i), row(p)])}
            </ul>
          )}
          {remaining > 0 && (
            <div className="px-5 pt-2">
              <Button
                variant="secondary"
                size="md"
                block
                onClick={() => {
                  setFocusIndex(visible.length);
                  setShown((n) => n + PAGE_SIZE);
                }}
              >
                <span className="tabular-nums">
                  {t("more", { count: remaining })}
                </span>
              </Button>
            </div>
          )}
          {off.length > 0 && (
            <div className="px-5 pt-2">
              <button
                type="button"
                aria-pressed={showOff}
                onClick={() => setShowOff((v) => !v)}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-fill px-4 text-label font-semibold text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-line motion-reduce:transition-none"
              >
                {t("showOff", { count: off.length })}
                <ChevronDown
                  size={20}
                  aria-hidden
                  className={`transition-transform duration-150 motion-reduce:transition-none ${showOff ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          )}
        </div>
      </section>

      <ThemePlaceSheet
        slug={slug}
        place={selected}
        extra={selected ? extras[selected.id] : undefined}
        scene={selected ? sceneLinks[selected.id] : undefined}
        text={selected ? texts?.[selected.id] : undefined}
        onOpenPlace={setSelectedId}
        canOpenPlace={(id) => places.some((p) => p.id === id)}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
