"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format-date";
import type { CityTour } from "@/features/home/citytour";
import { CityTourCard, useCityTourAdd } from "@/features/home/CityTourCard";
import type { CityTourText } from "@/features/translations/text";

/** 처음 보이는 수와 「더 보기」 한 번에 더 보이는 수(PoC ctLimit 3 · +6) */
const CT_INITIAL = 3;
const CT_STEP = 6;

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
// 처음 3개, 「더 보기」마다 6개씩. 출처의 기준일은 PoC처럼 첫 노선의 기준일
export function InfoCityTours({
  cityLabel,
  isDefault,
  tours,
  texts,
}: InfoCityToursProps) {
  const t = useTranslations("Planner.info");
  const locale = useLocale();
  const { onAdd, dialog } = useCityTourAdd();
  const [shown, setShown] = useState(CT_INITIAL);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const visible = tours.slice(0, shown);

  useEffect(() => {
    if (focusIndex === null) return;
    listRef.current
      ?.querySelectorAll<HTMLElement>("[data-card]")
      [focusIndex]?.focus();
  }, [focusIndex]);

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
          <ul ref={listRef} className="mt-3 flex flex-col gap-3">
            {visible.map((tour, i) => (
              <CityTourCard
                key={`${tour.name}|${i}`}
                tour={tour}
                text={texts?.[i]}
                onAdd={() => onAdd(tour, texts?.[i]?.name)}
              />
            ))}
          </ul>
          {tours.length > shown && (
            <Button
              variant="secondary"
              size="md"
              block
              className="mt-3"
              onClick={() => {
                setFocusIndex(visible.length);
                setShown((n) => n + CT_STEP);
              }}
            >
              <span className="tabular-nums">
                {t("more", { shown, total: tours.length })}
              </span>
            </Button>
          )}
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
