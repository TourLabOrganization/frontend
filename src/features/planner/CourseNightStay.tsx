"use client";

import { BedDouble, Check, ChevronDown, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { buttonClassName } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useNameTable } from "@/features/names/NamesProvider";
import { distanceLabel } from "@/features/theme/place-list";
import { placeName } from "@/features/theme/place-meta";
import { Dropdown } from "./CourseBookingLinks";
import type { PlannerPlace } from "./data";
import { addLocalDays, stayBookingLinks } from "./data/booking";
import { CITY_INFO, cityName } from "./regions";
import {
  type NearbyStays,
  type NightStay,
  placeStayQuery,
  type StaySample,
  sampleMapUrl,
  stayQuery,
} from "./stays";

const SUMMARY_CLASS = `${buttonClassName({ variant: "secondary", size: "md" })} w-full cursor-pointer list-none [&::-webkit-details-marker]:hidden`;
const ROW =
  "flex min-h-11 w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none";

type CourseNightStayProps = {
  /** 0부터 센 날짜 순번 */
  dayIndex: number;
  /** 그날(체크인) YYYY-MM-DD */
  date: string;
  stay: NightStay<PlannerPlace>;
  /** 숙소 기준점(그날 마지막 경유지 등). 없으면 null */
  anchor: PlannerPlace | null;
  /** 「주변 숙소」 목록. 기준점이 없으면 null */
  nearby: NearbyStays<PlannerPlace> | null;
  /** 담은 장소 id(지정된 숙소 표시) */
  courseIds: ReadonlySet<string>;
  /** 우리 숙박 장소를 그날 밤 숙소로 지정 · 해제 */
  onToggle: (place: PlannerPlace) => void;
};

// 일자별 일정 카드 끝의 「숙박」(PoC dayPlan stayShow · stayName · stayMeta · sgShow · staySuggest · stayBookings).
// 마지막 날에는 두지 않는다(쓰는 쪽이 정한다). 숙소 표본은 「예시」로 표시하고 가격은 보이지 않는다
export function CourseNightStay({
  dayIndex,
  date,
  stay,
  anchor,
  nearby,
  courseIds,
  onToggle,
}: CourseNightStayProps) {
  const t = useTranslations("Planner.course.nightStay");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const names = useNameTable();
  const id = useId();
  const ko = locale === "ko";

  const sampleName = (s: StaySample) => (ko ? s.ko : s.en);
  const sampleMeta = (s: StaySample) =>
    [ko ? s.areaKo : s.areaEn, ko ? s.typeKo : s.typeEn]
      .filter(Boolean)
      .join(" · ");

  let name: string;
  let meta: string;
  let query: string;
  if (stay.kind === "picked") {
    const p = stay.place;
    name = placeName(p, locale, names);
    meta = [
      cityName(p.locKo, locale, names),
      tc("categories.stay"),
      t("picked"),
    ].join(" · ");
    query = placeStayQuery(p, CITY_INFO[p.locKo]?.en ?? "", locale);
  } else if (stay.kind === "sample") {
    name = sampleName(stay.sample);
    meta = sampleMeta(stay.sample);
    query = stayQuery(stay.sample, locale);
  } else {
    const area = placeName(stay.anchor, locale, names);
    name = t("generic", { letter: stay.letter });
    meta = t("genericMeta", { area });
    query = area;
  }

  const links = stayBookingLinks({
    query,
    checkIn: date,
    checkOut: addLocalDays(date, 1),
    locale,
  });
  const hasNearby =
    nearby !== null && (nearby.own.length > 0 || nearby.samples.length > 0);
  const headingId = `${id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="mt-4 rounded-card p-4 ring-1 ring-line"
      data-night-stay={dayIndex + 1}
    >
      <p className="flex items-center gap-1.5 text-caption font-semibold text-primary">
        <BedDouble size={16} aria-hidden />
        {t("label")}
      </p>
      <h4 id={headingId} className="mt-1 text-body-lg font-bold">
        <span className="sr-only">{t("labelFor", { day: dayIndex + 1 })} </span>
        {name}
      </h4>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-fg-muted">
        <span>{meta}</span>
        {stay.kind === "sample" && <Chip>{t("sample")}</Chip>}
      </p>
      {stay.kind === "sample" && (
        <p className="mt-2 text-caption text-fg-subtle">{t("sampleNote")}</p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2">
        {hasNearby && nearby && (
          <details className="group">
            <summary className={SUMMARY_CLASS}>
              {t("nearby")}
              <ChevronDown
                size={16}
                aria-hidden
                className="shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <div className="mt-2 rounded-2xl bg-surface p-2 ring-1 ring-line">
              {nearby.own.length > 0 && (
                <>
                  <p className="px-3 pt-1 text-caption font-semibold text-fg-muted">
                    {t("ownHeading")}
                  </p>
                  <ul className="mt-1">
                    {nearby.own.map(({ place }) => {
                      const on = courseIds.has(place.id);
                      return (
                        <li key={place.id}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => onToggle(place)}
                            className={`${ROW} ${on ? "bg-primary-weak" : ""}`}
                          >
                            <span className="flex size-5 shrink-0 items-center justify-center pt-0.5">
                              {on && (
                                <Check
                                  size={16}
                                  className="text-primary-strong"
                                  aria-hidden
                                />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-body font-semibold">
                                {placeName(place, locale, names)}
                              </span>
                              <span
                                className={`block text-caption ${on ? "text-primary-strong" : "text-fg-muted"}`}
                              >
                                {[
                                  t("place"),
                                  tc("categories.stay"),
                                  on ? t("setAsStay") : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            <span className="shrink-0 text-caption text-fg-muted tabular-nums">
                              {t("distance", {
                                km: distanceLabel(place, anchor) ?? "",
                              })}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              {nearby.samples.length > 0 && (
                <>
                  <p className="px-3 pt-2 text-caption font-semibold text-fg-muted">
                    {t("samplesHeading")}
                  </p>
                  <ul className="mt-1">
                    {nearby.samples.map(({ sample }) => (
                      <li key={sample.id}>
                        <a
                          href={sampleMapUrl(sample, locale)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={ROW}
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center pt-0.5">
                            <ExternalLink
                              size={16}
                              className="text-fg-muted"
                              aria-hidden
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-body font-semibold">
                              {sampleName(sample)}
                            </span>
                            <span className="block text-caption text-fg-muted">
                              {[sampleMeta(sample), t("sample")].join(" · ")}
                            </span>
                          </span>
                          <span className="shrink-0 text-caption text-fg-muted tabular-nums">
                            {t("distance", {
                              km: distanceLabel(sample, anchor) ?? "",
                            })}
                          </span>
                          <span className="sr-only">{t("mapNewWindow")}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="px-3 pt-1 pb-1 text-caption text-fg-subtle">
                    {t("sampleNote")}
                  </p>
                </>
              )}
            </div>
          </details>
        )}
        <Dropdown label={t("book")} links={links} wide />
      </div>
    </section>
  );
}
