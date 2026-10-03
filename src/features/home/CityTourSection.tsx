"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { SearchField } from "@/components/ui/SearchField";
import { cityName, groupCities, regionName } from "@/features/planner/regions";
import { decodeAnswers } from "@/features/recommend/answers";
import { LAST_RECOMMENDATION_KEY, useLocalValue } from "@/lib/local-store";
import { matchesQuery } from "@/lib/text-search";
import {
  type CityTour,
  type CourseScoreProfile,
  recommendTourPicks,
  regionCounts,
  tourRegion,
  visitsCity,
  typeProfile,
} from "./citytour";
import { CityTourCard, useCityTourAdd } from "./CityTourCard";
import { CityTourMore } from "./CityTourMore";
import toursData from "./data/citytour.json";
import scoresData from "./data/citytour-scores.json";
import { useNameTable } from "@/features/names/NamesProvider";
import type { CityTourText } from "@/features/translations/text";

const TOURS = toursData as CityTour[];
/** 노선별 코스 점수 자료(TOURS와 같은 순서, 분석 적격이 아니면 null) */
const PROFILES = scoresData as (CourseScoreProfile | null)[];
/** 노선 → data/citytour.json 순서(서버가 넘기는 옮긴 글 texts와 같은 순서) */
const TOUR_INDEX = new Map(TOURS.map((tour, i) => [tour, i]));
const COUNTS = regionCounts(TOURS);
/** 처음 고른 지역(목업과 같다) */

type Mode = "rec" | "region";

/** 지역별 검색 칩 묶음: 투어 플래너 도시 고르기와 같은 권역(수도권 · 강원권 …), 권역 안은 대표 도시 → 노선 많은 순 */
const GROUPS = groupCities(COUNTS.keys(), (c) => COUNTS.get(c) ?? 0);
/** 처음 고른 지역: 첫 권역(수도권)의 첫 도시(노선이 있는 도시만 칩이 된다. 서울은 여행지 기준으로 0개라 칩이 없다, 2026-10-02) */
const DEFAULT_REGION = GROUPS[0]?.cities[0] ?? "서울";

// 홈 「지역 시티투어」(목업: 배너 다음). 탭 두 칸 「내 유형 추천」 · 「지역별 검색」.
// 내 유형 추천은 마지막 테마 추천(tn.lastRecommendation)의 설문 6.4 결과(최종 유형 · 간접 선호 u · S3 · S4 두 관심사 · S6)로 citytour.ts recommendTourPicks를 돌린다(관심사별 1자리 보장).
// 추천 기록이 있으면 내 유형 추천이, 없으면 지역별 검색(서울)이 먼저 열린다(목업과 같다).
// 카드와 「코스빌더에 넣기」는 CityTourCard.tsx(플래너 여행 정보 탭과 함께 쓴다)
export function CityTourSection({
  texts,
}: {
  /** 외국어 화면에서 보일 글(data/citytour.json 순서, 홈 페이지가 서버에서 번역 표로 만든다). 한국어 화면은 없다 */
  texts?: readonly (CityTourText | undefined)[];
}) {
  const t = useTranslations("Home.citytour");
  const tc = useTranslations("Clusters");
  // 권역 묶음 머리(기타 지역 · 도시 수)는 투어 플래너 도시 고르기 문구를 같이 쓴다
  const tp = useTranslations("Planner");
  const locale = useLocale();
  const names = useNameTable();
  const { onAdd, dialog } = useCityTourAdd();
  const id = useId();

  const lastA = useLocalValue(LAST_RECOMMENDATION_KEY);
  const type = useMemo(
    () => (lastA ? typeProfile(decodeAnswers(lastA)) : null),
    [lastA],
  );
  const picks = useMemo(
    () => (type ? recommendTourPicks(TOURS, type, PROFILES) : []),
    [type],
  );
  const rec = useMemo(() => picks.map((p) => p.tour), [picks]);

  const [chosenMode, setChosenMode] = useState<Mode | null>(null);
  const mode: Mode = chosenMode ?? (rec.length > 0 ? "rec" : "region");
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [query, setQuery] = useState("");
  // 펼친 권역. null이면 고른 지역이 든 권역(처음엔 서울 → 수도권), ""이면 모두 접힘. 검색 중에는 맞는 권역을 모두 펼친다
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const groupBase = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const recRegions = new Set(rec.map((r) => tourRegion(r)));
  // 검색어로 권역 묶음 안의 도시를 거른다(도시가 없는 권역은 빠진다)
  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        cities: g.cities.filter((r) =>
          matchesQuery(
            [r, cityName(r, "en"), cityName(r, locale, names)],
            query,
          ),
        ),
      })).filter((g) => g.cities.length > 0),
    [query, locale, names],
  );
  const regionTotal = groups.reduce((n, g) => n + g.cities.length, 0);
  const list =
    mode === "rec" ? rec : TOURS.filter((tour) => visitsCity(tour, region));

  const searching = query.trim().length > 0;
  const shownGroup =
    openGroup ?? GROUPS.find((g) => g.cities.includes(region))?.key ?? "";

  const changeMode = (next: Mode) => {
    setChosenMode(next);
  };
  const pickRegion = (r: string) => {
    setRegion(r);
  };

  const modes: { key: Mode; label: string }[] = [
    {
      key: "rec",
      label:
        rec.length > 0 ? t("tabRecCount", { count: rec.length }) : t("tabRec"),
    },
    { key: "region", label: t("tabRegion") },
  ];
  const tabId = (m: Mode) => `${id}-tab-${m}`;
  const panelId = `${id}-panel`;

  return (
    <section
      id="home-citytour"
      className="mt-8 scroll-mt-4 px-5"
      aria-labelledby="home-citytour-heading"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-citytour-heading" className="text-headline font-bold">
          {t("heading")}
        </h2>
        <span className="text-caption font-semibold text-fg-subtle tabular-nums">
          {t("meta", { regions: COUNTS.size, tours: TOURS.length })}
        </span>
      </div>

      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="mt-4 flex gap-1 rounded-2xl bg-fill p-1"
      >
        {modes.map((m, i) => {
          const selected = mode === m.key;
          return (
            <button
              key={m.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={tabId(m.key)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => changeMode(m.key)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                const next = modes[(i + 1) % modes.length];
                changeMode(next.key);
                tabRefs.current[(i + 1) % modes.length]?.focus();
              }}
              className={`flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-2 text-label transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                selected
                  ? "bg-surface font-semibold text-fg ring-1 ring-line"
                  : "font-medium text-fg-muted active:bg-line"
              }`}
            >
              <span className="tabular-nums">{m.label}</span>
            </button>
          );
        })}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={tabId(mode)}>
        {mode === "region" && (
          <div className="mt-4">
            <SearchField
              value={query}
              onChange={setQuery}
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              clearLabel={t("searchClear")}
            />
            {/* 권역(수도권 · 강원권 …)만 먼저 보이고 누르면 그 권역 도시 칩이 펼쳐진다. 칸 속 스크롤을 두지 않는다(대표 결정 2026-09-30) */}
            <div
              role="group"
              aria-label={t("regionsLabel")}
              className="mt-3 divide-y divide-line rounded-card ring-1 ring-line"
            >
              {groups.length === 0 ? (
                <p className="px-4 py-3 text-label text-fg-muted">
                  {t("noRegion")}
                </p>
              ) : (
                groups.map(({ key, region: macro, cities }) => {
                  const groupName = macro
                    ? regionName(macro, locale, names)
                    : tp("picker.otherRegions");
                  const expanded = searching || key === shownGroup;
                  const groupId = `${groupBase}-${key}`;
                  return (
                    <section key={key} aria-label={groupName}>
                      <h4>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={groupId}
                          onClick={() => setOpenGroup(expanded ? "" : key)}
                          className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-label font-bold text-fg transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
                        >
                          <span className="flex-1">{groupName}</span>
                          <span className="text-caption font-medium text-fg-subtle tabular-nums">
                            {tp("picker.regionCities", {
                              count: cities.length,
                            })}
                          </span>
                          <ChevronDown
                            size={18}
                            aria-hidden
                            className={`shrink-0 text-fg-subtle transition-transform duration-150 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
                          />
                        </button>
                      </h4>
                      {expanded && (
                        <div
                          id={groupId}
                          className="flex flex-wrap gap-2 px-4 pb-4"
                        >
                          {cities.map((r) => {
                            const pressed = r === region;
                            const count = COUNTS.get(r) ?? 0;
                            const name = cityName(r, locale, names);
                            return (
                              <button
                                key={r}
                                type="button"
                                aria-pressed={pressed}
                                aria-label={t("regionChip", {
                                  region: name,
                                  count,
                                })}
                                onClick={() => pickRegion(r)}
                                className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-label whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                                  pressed
                                    ? "bg-primary-weak font-semibold text-primary-strong"
                                    : "bg-fill font-medium text-fg-muted active:bg-line"
                                }`}
                              >
                                {name}
                                <span className="text-caption tabular-nums">
                                  {count}
                                </span>
                                {recRegions.has(r) && (
                                  <span
                                    aria-hidden
                                    className="size-1.5 rounded-full bg-primary-bright"
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })
              )}
            </div>
            <p role="status" className="sr-only">
              {query.trim() ? t("searchStatus", { count: regionTotal }) : ""}
            </p>
            <h3 className="mt-5 text-body-lg font-bold tabular-nums">
              {t("regionHeading", {
                region: cityName(region, locale, names),
                count: COUNTS.get(region) ?? 0,
              })}
            </h3>
          </div>
        )}

        {mode === "rec" &&
          (type && rec.length > 0 ? (
            <h3 className="mt-5 text-body-lg font-bold">
              {t("recHeading", {
                type: tc(`${type.types[0]}.name`),
                count: rec.length,
              })}
            </h3>
          ) : (
            <div className="mt-4 rounded-card bg-fill p-5">
              <p className="text-body text-fg-muted">{t("recEmpty")}</p>
              <ButtonLink href="/recommend" size="md" className="mt-4">
                {t("recEmptyAction")}
                <ArrowRight size={20} aria-hidden />
              </ButtonLink>
            </div>
          ))}

        {/* 내 유형 추천 · 지역별 검색 모두 처음 3곳만 보이고 「더 보기」로 펼친다 */}
        {mode === "rec" && type && rec.length > 0 && (
          <CityTourMore
            label={t("recHeading", {
              type: tc(`${type.types[0]}.name`),
              count: rec.length,
            })}
            items={rec.map((tour, i) => {
              const text = texts?.[TOUR_INDEX.get(tour) ?? -1];
              return (
                <CityTourCard
                  key={`${tour.region}|${tour.name}|${i}`}
                  tour={tour}
                  text={text}
                  rank={i + 1}
                  reservedFor={picks[i]?.reservedFor}
                  onAdd={() => onAdd(tour, text?.name)}
                />
              );
            })}
          />
        )}

        {/* 지역을 바꾸면 목록을 새로 만들어 접힌 상태로 시작한다 */}
        {mode === "region" && list.length > 0 && (
          <CityTourMore
            key={region}
            label={t("regionHeading", {
              region: cityName(region, locale, names),
              count: list.length,
            })}
            items={list.map((tour, i) => {
              const text = texts?.[TOUR_INDEX.get(tour) ?? -1];
              return (
                <CityTourCard
                  key={`${tour.region}|${tour.name}|${i}`}
                  tour={tour}
                  text={text}
                  onAdd={() => onAdd(tour, text?.name)}
                />
              );
            })}
          />
        )}
      </div>
      <p className="mt-4 text-micro text-fg-subtle">{t("dataNote")}</p>

      {dialog}
    </section>
  );
}
