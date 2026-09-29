"use client";

import { ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { segmentClassName } from "@/components/ui/SegmentedControl";
import { type PlannerTab, plannerHref } from "./query";
import {
  CITY_GROUPS,
  CITY_INFO,
  cityName,
  MAJOR_CITIES,
  PLACE_COUNT_BY_CITY,
  regionName,
} from "./regions";
import { useNameTable } from "@/features/names/NamesProvider";

type CityPickerProps = {
  /** 지금 보고 있는 도시. 지역 탭의 전국 · 서울 · 부산 · 제주가 아니면 버튼에 이름을 적는다 */
  city: string | null;
  /** 버튼 칸을 고른 모양으로 그릴지 (서울 · 부산 · 제주 밖의 도시를 보고 있을 때) */
  selected: boolean;
  /** 도시를 고른 뒤에도 남길 탭 */
  tab: PlannerTab;
};

// 지역 탭의 「도시 ▾」 칸과 도시 고르기 패널(목업 1번 캡처).
// 패널은 아래에서 올라오는 모달 dialog다. showModal()이 초점을 가두고, Esc · 바깥 누르기로 닫힌다.
// 도시 검색(한국어 · 영어 이름) → 권역별 묶음(권역 이름 · 도시 수) → 도시 칩(이름 · 장소 수). 칩은 ?city= 링크다.
// 묶음 · 순서 · 장소 수는 regions.ts CITY_GROUPS(PoC cityGroups, 장소 수는 regions.json placeCounts). 주요 6도시 칩은 테두리로 강조한다
export function CityPicker({ city, selected, tab }: CityPickerProps) {
  const t = useTranslations("Planner");
  const locale = useLocale();
  const names = useNameTable();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const searchId = useId();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const groups = CITY_GROUPS.map((g) => ({
    ...g,
    cities: g.cities.filter(
      (c) =>
        !q ||
        c.includes(q) ||
        (CITY_INFO[c]?.en ?? "").toLowerCase().includes(q) ||
        cityName(c, locale, names).toLowerCase().includes(q),
    ),
  })).filter((g) => g.cities.length > 0);

  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={
          selected && city
            ? t("cityButtonCurrentLabel", {
                city: cityName(city, locale, names),
              })
            : t("cityButtonLabel")
        }
        onClick={() => ref.current?.showModal()}
        className={`${segmentClassName(selected)} flex-auto gap-0.5`}
      >
        <span className="truncate">
          {selected && city ? cityName(city, locale, names) : t("cityButton")}
        </span>
        <ChevronDown size={16} className="shrink-0" aria-hidden />
      </button>

      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => setQuery("")}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        // 창 자체는 스크롤하지 않고(스크롤 막대가 두 개 생기지 않게) 아래 도시 목록 칸만 스크롤한다
        className="inset-x-0 mx-auto mt-auto mb-0 h-[80dvh] max-h-[80dvh] w-full max-w-[480px] overflow-hidden rounded-t-card bg-surface p-0 text-fg backdrop:bg-ink/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between pt-3 pr-3 pl-5">
            <h2 id={titleId} className="text-headline font-bold">
              {t("picker.title")}
            </h2>
            <button
              type="button"
              aria-label={t("picker.close")}
              onClick={close}
              className="flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
            >
              <X size={24} aria-hidden />
            </button>
          </div>

          <div className="px-5 pt-2 pb-3">
            <label htmlFor={searchId} className="sr-only">
              {t("picker.searchLabel")}
            </label>
            <div className="relative">
              <Search
                size={20}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-subtle"
              />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("picker.searchPlaceholder")}
                autoComplete="off"
                enterKeyHint="search"
                className="h-12 w-full rounded-xl bg-fill pr-4 pl-11 text-body text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
              />
            </div>
          </div>

          {/* 검색 결과가 없을 때 화면 읽기 프로그램에 알린다. 영역은 늘 두고 글만 바꾼다 */}
          <p role="status" className="sr-only">
            {groups.length === 0 ? t("picker.empty") : ""}
          </p>
          {/* relative: 칩 안 화면 읽기용 글자(sr-only는 absolute)가 이 칸을 기준으로 자리를 잡아 칸 안에서 잘리게 한다.
              없으면 창(dialog) 기준으로 잡혀 창이 1,300px 넘게 늘고 끝까지 내리면 빈 화면이 나온다 */}
          <div className="relative flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {groups.length === 0 ? (
              <p className="py-10 text-center text-body text-fg-muted">
                {t("picker.empty")}
              </p>
            ) : (
              groups.map(({ key, region, cities }) => {
                const headingId = `${titleId}-${key}`;
                return (
                  <section
                    key={key}
                    aria-labelledby={headingId}
                    className="border-t border-line py-4 first:border-t-0 first:pt-1"
                  >
                    <div className="flex items-baseline justify-between">
                      <h3 id={headingId} className="text-body-lg font-bold">
                        {region
                          ? regionName(region, locale, names)
                          : t("picker.otherRegions")}
                      </h3>
                      <span className="text-caption text-fg-subtle tabular-nums">
                        {t("picker.regionCities", { count: cities.length })}
                      </span>
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {cities.map((c) => {
                        const count = PLACE_COUNT_BY_CITY.get(c) ?? 0;
                        const current = c === city;
                        const major = MAJOR_CITIES.has(c);
                        return (
                          <li key={c}>
                            <Link
                              href={plannerHref({ city: c, tab })}
                              replace
                              scroll={false}
                              onClick={close}
                              aria-current={current ? "true" : undefined}
                              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-label transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                                current
                                  ? "bg-primary-weak font-semibold text-primary-strong"
                                  : "bg-fill font-medium text-fg active:bg-line"
                              } ${major ? "ring-2 ring-primary-bright ring-inset" : ""}`}
                            >
                              {cityName(c, locale, names)}
                              <span
                                aria-hidden
                                className={`text-caption tabular-nums ${current ? "text-primary-strong" : "text-fg-muted"}`}
                              >
                                {count}
                              </span>
                              <span className="sr-only">
                                {t("picker.placeCount", { count })}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
