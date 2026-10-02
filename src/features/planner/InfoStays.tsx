"use client";

import { BedDouble, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { CardCarousel } from "@/components/ui/CardCarousel";
import { Chip } from "@/components/ui/Chip";
import { useNameTable } from "@/features/names/NamesProvider";
import { placeName } from "@/features/theme/place-meta";
import { Dropdown } from "./CourseBookingLinks";
import type { PlannerPlace } from "./data";
import { addLocalDays, stayBookingLinks } from "./data/booking";
import type { CityStays } from "./info-stays";
import { CITY_INFO, cityName } from "./regions";
import {
  placeStayQuery,
  type StaySample,
  sampleMapUrl,
  stayQuery,
} from "./stays";

const LINK_CLASS =
  "inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-label font-semibold text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none";

type InfoStaysProps = {
  /** 도시 key(한국어 이름) */
  city: string;
  /** 제목에 쓸 도시 이름(화면 언어) */
  cityLabel: string;
  /** 도시를 고르지 않아 기본 지역(서울)을 보이는 중이면 true */
  isDefault: boolean;
  /** 그 도시의 숙소(서버가 info-stays.ts로 고른다). 앱 장소는 이름 · 좌표 · 체크인 안내만 넘긴다 */
  stays: CityStays<
    Pick<PlannerPlace, "id" | "ko" | "en" | "locKo" | "lat" | "lng" | "hrs">
  >;
};

/** 오늘(브라우저 날짜) YYYY-MM-DD. 서버 렌더에서는 빈 값(예약 링크는 클라이언트에서 날짜가 붙는다) */
function useToday(): string {
  return useSyncExternalStore(
    () => () => {},
    () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    },
    () => "",
  );
}

// 플래너 여행 정보 탭 「{도시} 숙소」. 코스 빌더의 일자별 「숙박」(CourseNightStay: 그날 기준점 · 지정 · 해제)과 달리
// 고른 도시 전체의 숙소를 좌우로 넘기는 카드(CardCarousel)로 보인다: 앱 장소 목록의 숙박 장소(도심에서 가까운 순) 뒤에
// 예시 숙소 지역(표본, 최대 4곳). 카드마다 이름 · 도시 · 분류 · (앱 장소) 체크인 안내 · (표본) 동네 · 유형 · 도심 거리,
// 「지도」(앱 장소는 카카오맵, 표본은 네이버 · Google 지도 검색, 새 창)와 「숙박 예약」(오늘 → 내일, data/booking.ts stayBookingLinks)
export function InfoStays({
  city,
  cityLabel,
  isDefault,
  stays,
}: InfoStaysProps) {
  const t = useTranslations("Planner.info.stay");
  const tn = useTranslations("Planner.info");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const names = useNameTable();
  const today = useToday();
  const ko = locale === "ko";
  const cityEn = CITY_INFO[city]?.en ?? "";

  type Card =
    | {
        kind: "own";
        place: InfoStaysProps["stays"]["own"][number]["place"];
        km: number;
      }
    | { kind: "sample"; sample: StaySample; km: number };
  const cards: Card[] = [
    ...stays.own.map(({ place, km }) => ({ kind: "own" as const, place, km })),
    ...stays.samples.map(({ sample, km }) => ({
      kind: "sample" as const,
      sample,
      km,
    })),
  ];
  const total = cards.length;

  function renderCard(card: Card) {
    const name =
      card.kind === "own"
        ? placeName(card.place, locale, names)
        : ko
          ? card.sample.ko
          : card.sample.en || card.sample.ko;
    const meta =
      card.kind === "own"
        ? [cityName(card.place.locKo, locale, names), tc("categories.stay")]
        : [
            ko ? card.sample.areaKo : card.sample.areaEn,
            ko ? card.sample.typeKo : card.sample.typeEn,
          ].filter(Boolean);
    const query =
      card.kind === "own"
        ? placeStayQuery(card.place, cityEn, locale)
        : stayQuery(card.sample, locale);
    const mapHref =
      card.kind === "own"
        ? `https://map.kakao.com/link/map/${encodeURIComponent(card.place.ko)},${card.place.lat},${card.place.lng}`
        : sampleMapUrl(card.sample, locale);
    const links = today
      ? stayBookingLinks({
          query,
          checkIn: today,
          checkOut: addLocalDays(today, 1),
          locale,
        })
      : [];
    return (
      <article className="rounded-card bg-surface p-4 ring-1 ring-line">
        <p className="flex items-center gap-1.5 text-caption font-semibold text-primary">
          <BedDouble size={16} aria-hidden />
          {card.kind === "own" ? t("ownLabel") : t("sampleLabel")}
        </p>
        <h4 className="mt-1 text-body-lg font-bold">{name}</h4>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-fg-muted">
          <span>{meta.join(" · ")}</span>
          {card.kind === "sample" && <Chip>{t("sample")}</Chip>}
        </p>
        <dl className="mt-2 flex flex-col gap-0.5 text-caption text-fg-subtle">
          {card.kind === "own" && card.place.hrs && (
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-semibold">{t("checkInOut")}</dt>
              <dd className="tabular-nums">{card.place.hrs}</dd>
            </div>
          )}
          <div className="flex gap-1.5">
            <dt className="shrink-0 font-semibold">{t("fromCenter")}</dt>
            <dd className="tabular-nums">
              {t("distance", { km: card.km.toFixed(1) })}
            </dd>
          </div>
        </dl>
        {card.kind === "sample" && (
          <p className="mt-2 text-caption text-fg-subtle">{t("sampleNote")}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={mapHref}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {t("map")}
            <ExternalLink size={16} aria-hidden />
            <span className="sr-only">{tn("newWindow")}</span>
          </a>
        </div>
        {links.length > 0 && (
          <Dropdown label={t("book")} links={links} wide className="mt-2" />
        )}
      </article>
    );
  }

  return (
    <section aria-labelledby="planner-stay-heading">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h3 id="planner-stay-heading" className="text-headline font-bold">
          {t("title", { city: cityLabel })}
        </h3>
        {total > 0 && (
          <span className="shrink-0 text-caption font-semibold text-fg-subtle tabular-nums">
            {isDefault && `${tn("defaultRegion")} · `}
            {t("meta", { count: total })}
          </span>
        )}
      </div>
      {total === 0 ? (
        <p className="mt-3 rounded-card bg-fill p-5 text-body text-fg-muted">
          {t("empty")}
        </p>
      ) : (
        <>
          <p className="mt-1 px-1 text-caption text-fg-subtle">{t("note")}</p>
          <div className="mt-3">
            <CardCarousel
              label={t("title", { city: cityLabel })}
              total={total}
              card={(i) => renderCard(cards[i])}
            />
          </div>
          <p className="mt-3 px-1 text-micro text-fg-subtle">{t("source")}</p>
        </>
      )}
    </section>
  );
}
