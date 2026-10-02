"use client";

import { useLocale, useTranslations } from "next-intl";
import { CardCarousel } from "@/components/ui/CardCarousel";
import { formatDate } from "@/lib/format-date";
import type { CityTour } from "@/features/home/citytour";
import { CityTourCard, useCityTourAdd } from "@/features/home/CityTourCard";
import type { CityTourText } from "@/features/translations/text";

type InfoCityToursProps = {
  /** 제목에 쓸 도시 이름(화면 언어) */
  cityLabel: string;
  /** 도시를 고르지 않아 기본 지역(서울)을 보이는 중이면 true(PoC _dflt) */
  isDefault: boolean;
  /** 그 도시의 노선(원천 순서) */
  tours: readonly CityTour[];
  /** 외국어 화면에서 보일 글(tours와 같은 순서, 서버가 번역 표로 만든다). 한국어 화면은 없다 */
  texts?: readonly (CityTourText | undefined)[];
};

// 플래너 여행 정보 탭 「{도시} 시티투어」(PoC ctList · ctMore · ctSrc).
// 카드와 「코스빌더에 넣기」(확인 창 포함)는 홈 지역 시티투어와 같다(features/home/CityTourCard.tsx).
// 밑으로 늘리는 「더 보기」 대신 좌우로 넘기는 카드(CardCarousel, 대표 결정 2026-10-02). 출처의 기준일은 PoC처럼 첫 노선의 기준일
export function InfoCityTours({
  cityLabel,
  isDefault,
  tours,
  texts,
}: InfoCityToursProps) {
  const t = useTranslations("Planner.info");
  const locale = useLocale();
  const { onAdd, dialog } = useCityTourAdd();
  return (
    <section aria-labelledby="planner-citytour-heading">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h3 id="planner-citytour-heading" className="text-headline font-bold">
          {t("citytour.title", { city: cityLabel })}
        </h3>
        {tours.length > 0 && (
          <span className="shrink-0 text-caption font-semibold text-fg-subtle tabular-nums">
            {isDefault && `${t("defaultRegion")} · `}
            {t("citytour.meta", { count: tours.length })}
          </span>
        )}
      </div>

      {tours.length === 0 ? (
        <p className="mt-3 rounded-card bg-fill p-5 text-body text-fg-muted">
          {t("citytour.empty")}
        </p>
      ) : (
        <>
          <div className="mt-3">
            <CardCarousel
              label={t("citytour.title", { city: cityLabel })}
              total={tours.length}
              card={(i) => (
                <CityTourCard
                  tour={tours[i]}
                  text={texts?.[i]}
                  onAdd={() => onAdd(tours[i], texts?.[i]?.name)}
                />
              )}
            />
          </div>
          <p className="mt-3 px-1 text-micro text-fg-subtle">
            {t("citytour.source", {
              date: formatDate(tours[0].date, locale),
            })}
          </p>
        </>
      )}
      {dialog}
    </section>
  );
}
