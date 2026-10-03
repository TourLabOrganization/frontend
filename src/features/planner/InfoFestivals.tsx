"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, Phone } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { CardCarousel } from "@/components/ui/CardCarousel";
import { Chip } from "@/components/ui/Chip";
import { useTourApi } from "@/components/ui/tour-api-context";
import { formatDate } from "@/lib/format-date";
import {
  festivalPath,
  isTourEmpty,
  TOUR_FESTIVAL_SECONDS,
  TOUR_TIMEOUT_MS,
  type TourFestival,
  type TourFestivalItem,
} from "@/lib/tour";
import { kakaoMapLink } from "./tic";

const LINK_CLASS =
  "inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-label font-semibold text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none";

type InfoFestivalsProps = {
  /** 도시 key(한국어 이름) */
  city: string;
  /** 제목에 쓸 도시 이름(화면 언어) */
  cityLabel: string;
  /** 도시를 고르지 않아 기본 지역(서울)을 보이는 중이면 true */
  isDefault: boolean;
};

async function fetchFestivals(
  city: string,
  locale: string,
): Promise<TourFestival | null> {
  const res = await fetch(festivalPath(city, locale), {
    signal: AbortSignal.timeout(TOUR_TIMEOUT_MS),
  });
  if (res.status === 503 || (res.status >= 400 && res.status < 500))
    return null;
  if (!res.ok) throw new Error(`tour festival ${res.status}`);
  const body: unknown = await res.json();
  return isTourEmpty(body) ? null : (body as TourFestival);
}

// 플래너 여행 정보 탭 「{도시} 축제 · 행사」(2026-10-03). 한국관광공사 축제공연행사(app/api/tour/festival, lib/tour-festival.ts)를
// 브라우저가 도시 이름으로 부르고, 숙소처럼 좌우로 넘기는 카드(CardCarousel)로 보인다: 사진(있을 때, 보이는 카드에만) · 진행 중 · 예정 칩 · 제목 · 기간 · 주소 ·
// 전화 · 「지도」(카카오맵 새 창). 서버에 키가 없으면(TourApiProvider) 부르지 않고 칸을 두지 않는다. 받는 동안 스켈레톤, 실패 · 결과 없음이면 빈 상태 문구
export function InfoFestivals({
  city,
  cityLabel,
  isDefault,
}: InfoFestivalsProps) {
  const t = useTranslations("Planner.info.festival");
  const tn = useTranslations("Planner.info");
  const locale = useLocale();
  const enabled = useTourApi();
  const query = useQuery({
    queryKey: ["tour", "festival", city, locale],
    queryFn: () => fetchFestivals(city, locale),
    enabled,
    staleTime: TOUR_FESTIVAL_SECONDS * 1000,
    retry: 1,
  });
  if (!enabled) return null;
  const items = query.data?.items ?? [];

  return (
    <section aria-labelledby="planner-festival-heading">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h3 id="planner-festival-heading" className="text-headline font-bold">
          {t("title", { city: cityLabel })}
        </h3>
        {items.length > 0 && (
          <span className="shrink-0 text-caption font-semibold text-fg-subtle tabular-nums">
            {isDefault && `${tn("defaultRegion")} · `}
            {t("meta", { count: items.length })}
          </span>
        )}
      </div>
      {query.isPending ? (
        <div aria-hidden className="mt-3 rounded-card bg-fill p-5">
          <div className="h-4 w-2/3 animate-pulse rounded bg-line motion-reduce:animate-none" />
          <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-line motion-reduce:animate-none" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 rounded-card bg-fill p-5 text-body text-fg-muted">
          {t("empty")}
        </p>
      ) : (
        <>
          <div className="mt-3">
            <CardCarousel
              label={t("title", { city: cityLabel })}
              total={items.length}
              card={(i, active) => (
                <FestivalCard item={items[i]} active={active} />
              )}
            />
          </div>
          <p className="mt-3 px-1 text-micro text-fg-subtle">
            {t("source", { limit: 20 })}
          </p>
        </>
      )}
    </section>
  );
}

/** 축제 한 건. 사진은 보이는 카드에만 붙인다(안 보이는 카드의 사진은 받지 않는다) */
function FestivalCard({
  item,
  active,
}: {
  item: TourFestivalItem;
  active: boolean;
}) {
  const t = useTranslations("Planner.info.festival");
  const tn = useTranslations("Planner.info");
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  return (
    <article className="rounded-card bg-surface p-4 ring-1 ring-line">
      {item.image && active && !failed && (
        <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded-xl bg-fill">
          <Image
            src={item.image}
            alt=""
            fill
            unoptimized
            onError={() => setFailed(true)}
            className="object-cover"
          />
        </div>
      )}
      <p className="flex items-center gap-1.5 text-caption font-semibold text-primary">
        <CalendarDays size={16} aria-hidden />
        <Chip tone={item.ongoing ? "primary" : undefined}>
          {item.ongoing ? t("ongoing") : t("upcoming")}
        </Chip>
      </p>
      <h4 className="mt-1 text-body-lg font-bold">{item.title}</h4>
      <p className="mt-0.5 text-label text-fg-muted tabular-nums">
        {t("period", {
          start: formatDate(item.start, locale),
          end: formatDate(item.end, locale),
        })}
      </p>
      {item.addr && (
        <p className="mt-1 text-caption text-fg-subtle">{item.addr}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {item.lat !== undefined && item.lng !== undefined && (
          <a
            href={kakaoMapLink({
              name: item.title,
              lat: item.lat,
              lng: item.lng,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {t("map")}
            <ExternalLink size={16} aria-hidden />
            <span className="sr-only">{tn("newWindow")}</span>
          </a>
        )}
        {item.tel && (
          <a
            href={`tel:${item.tel.replace(/[^\d+]/g, "")}`}
            className={`${LINK_CLASS} tabular-nums`}
          >
            <Phone size={16} aria-hidden />
            <span className="sr-only">{tn("call")} </span>
            {item.tel}
          </a>
        )}
      </div>
    </article>
  );
}
