"use client";

import { Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { SearchField } from "@/components/ui/SearchField";
import { useNameTable } from "@/features/names/NamesProvider";
import { isCategoryKey, placeName } from "@/features/theme/place-meta";
import { matchesQuery } from "@/lib/text-search";
import { categoryDot } from "./category";
import type { PlannerPlace } from "./data";
import { cityName } from "./regions";

/** 검색어가 없을 때 보이는 그 도시 장소 수 · 검색 결과 수 (PoC dayPlaceHits: 12 · 6) */
const BROWSE_LIMIT = 12;
const HIT_LIMIT = 6;

type DayAddPlaceProps = {
  day: number;
  /** 그 날 여행 도시(한국어 이름). 이 도시 장소만 찾는다 */
  city: string;
  /** 그 도시 장소 중 아직 코스에 없는 것 */
  pool: readonly PlannerPlace[];
  onAdd: (place: PlannerPlace) => void;
};

// 일자별 일정 카드의 「장소 추가」(PoC dayAdd). 누르면 검색 칸이 열리고, 고른 장소를 그 날 마지막 장소 뒤에 넣는다.
// 검색은 그 날 도시(PoC _dayReg)의 장소만. PoC는 그 도시에 맞는 장소가 없으면 전국에서 찾지만,
// 우리 코스는 한 도시의 장소만 담는 규칙이라 도시 밖으로 넓히지 않는다
export function DayAddPlace({ day, city, pool, onAdd }: DayAddPlaceProps) {
  const t = useTranslations("Planner.course.dayAdd");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const names = useNameTable();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = `${id}-panel`;
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const cityLabel = cityName(city, locale, names);

  const q = query.trim();
  const hits = (
    q
      ? pool.filter((p) =>
          matchesQuery([p.ko, p.en, placeName(p, locale, names)], q),
        )
      : pool
  ).slice(0, q ? HIT_LIMIT : BROWSE_LIMIT);

  const close = () => {
    setOpen(false);
    setQuery("");
    toggleRef.current?.focus();
  };

  return (
    <div className="mt-4 px-1">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("openLabel", { day })}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-label font-semibold text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-primary-weak motion-reduce:transition-none"
      >
        {open ? <X size={20} aria-hidden /> : <Plus size={20} aria-hidden />}
        {t("open")}
      </button>
      {open && (
        <div
          id={panelId}
          className="mt-2 rounded-2xl p-3 ring-1 ring-line"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
        >
          <SearchField
            value={query}
            onChange={setQuery}
            label={t("search")}
            placeholder={t("search")}
            clearLabel={t("clear")}
            autoFocus
            describedBy={hintId}
          />
          <p id={hintId} className="mt-2 px-1 text-caption text-fg-muted">
            {t("hint")}
          </p>
          <p
            id={listId}
            aria-live="polite"
            className="mt-3 px-1 text-caption font-semibold text-fg-muted"
          >
            {q
              ? hits.length > 0
                ? t("results")
                : t("none")
              : t("cityPlaces", { city: cityLabel })}
          </p>
          {hits.length > 0 && (
            <ul aria-labelledby={listId} className="mt-1 flex flex-col">
              {hits.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAdd(p);
                      close();
                    }}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
                  >
                    <span
                      aria-hidden
                      className={`size-2.5 shrink-0 rounded-full ${categoryDot(p.cat)}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold">
                        {placeName(p, locale, names)}
                      </span>
                      <span className="block text-caption text-fg-subtle">
                        {[
                          cityName(p.locKo, locale, names),
                          isCategoryKey(p.cat)
                            ? tc(`categories.${p.cat}`)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <Plus
                      size={20}
                      aria-hidden
                      className="shrink-0 text-primary"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
