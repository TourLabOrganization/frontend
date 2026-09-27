"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { SearchField } from "@/components/ui/SearchField";
import { formatDuration } from "@/features/course/format-duration";
import type { Place } from "@/features/course/places";
import { matchesQuery } from "@/lib/text-search";
import {
  type CategoryKey,
  CATEGORY_KEYS,
  corePlaces,
  isCategoryKey,
  placeName,
  placePhoto,
} from "./place-meta";
import { ThemePlaceSheet } from "./ThemePlaceSheet";
import { type MapPin, ThemeMap } from "./ThemeMap";
import type { PlaceExtra } from "./theme-data";

export type SceneLink = { text: string; href: string };

type MapTabProps = {
  slug: string;
  /** 테마의 모든 장소 (핵심 + 목록 밖) */
  places: readonly Place[];
  extras: Readonly<Record<string, PlaceExtra>>;
  /** 장소 id → 시트의 장면 정보 한 줄과 영화 탭 주소 */
  sceneLinks: Readonly<Record<string, SceneLink>>;
  /** ?place= 로 들어왔을 때 처음부터 열어 둘 장소 */
  initialPlace?: string;
};

type Filter = "all" | CategoryKey;

/** 목록에 처음 보이는 수. 나머지는 「더 보기」로 */
const INITIAL_ROWS = 10;
/** 「더 보기」 한 번에 더 보이는 수(테마 장소는 이보다 적어 한 번에 모두 보인다) */
const PAGE_SIZE = 60;

function toPin(p: Place, locale: string, label?: number): MapPin {
  return {
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    title: placeName(p, locale),
    label,
  };
}

// 지도 탭. 분류 칩 → 지도(번호 핀) → 장소 목록 → 목록 밖 장소 토글. 핀이나 목록을 누르면 장소 시트가 열린다
export function MapTab({
  slug,
  places,
  extras,
  sceneLinks,
  initialPlace,
}: MapTabProps) {
  const t = useTranslations("Theme.map");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  const [filter, setFilter] = useState<Filter>("all");
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
  // 분류 칩과 검색어(장소 이름 한 · 영)로 거른다. 지도 핀과 목록이 같이 쓴다
  const inFilter = (p: Place) =>
    (filter === "all" || p.cat === filter) && matchesQuery([p.ko, p.en], query);
  const core = corePlaces(places).filter(inFilter);
  const off = places.filter((p) => p.off && inFilter(p));
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const rows = [...core, ...(showOff ? off : [])];
  const visible = rows.slice(0, shown);
  const remaining = rows.length - visible.length;

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

  const meta = (p: Place) =>
    [
      isCategoryKey(p.cat) ? tc(`categories.${p.cat}`) : null,
      p.min > 0 ? tc("stay", { duration: formatDuration(tc, p.min) }) : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const row = (p: Place) => {
    const img = extras[p.id]?.img;
    return (
      <li key={p.id}>
        <button
          type="button"
          data-row
          onClick={() => setSelectedId(p.id)}
          className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
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
            <span className="block text-body-lg font-semibold">
              {placeName(p, locale)}
            </span>
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
      </li>
    );
  };

  return (
    <>
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
              ...(showOff ? off : []).map((p) => toPin(p, locale)),
              ...core.map((p) => toPin(p, locale, p.n ?? undefined)),
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
        <h2
          id="place-list-heading"
          className="px-5 text-headline font-bold tabular-nums"
        >
          {t("listHeading", { count: core.length })}
        </h2>
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
            {visible.map(row)}
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
      </section>

      <ThemePlaceSheet
        slug={slug}
        place={selected}
        extra={selected ? extras[selected.id] : undefined}
        scene={selected ? sceneLinks[selected.id] : undefined}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
