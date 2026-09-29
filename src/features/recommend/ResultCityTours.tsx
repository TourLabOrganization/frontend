"use client";

import { CityTourCard, useCityTourAdd } from "@/features/home/CityTourCard";
import type { CityTour, TourTag } from "@/features/home/citytour";
import type { CityTourText } from "@/features/translations/text";

/** 추천 결과의 시티투어 한 줄: 노선(서버가 고른 5개만 넘겨 노선 전체 표를 브라우저에 싣지 않는다)과 채운 관심사 보장 자리 */
export type ResultTourPick = {
  tour: CityTour;
  reservedFor: TourTag | null;
  /** 외국어 화면에서 보일 글(서버가 번역 표로 만든다). 한국어 화면은 없다 */
  text?: CityTourText;
};

// 추천 결과의 「나에게 맞는 지역 시티투어」 목록. 고르는 계산은 서버(결과 페이지)가 하고(citytour.ts recommendTourPicks),
// 여기서는 카드와 「코스빌더에 넣기」(담아 둔 코스가 있으면 먼저 묻는다)만 그린다. 카드는 홈 지역 시티투어와 같다
export function ResultCityTours({
  picks,
}: {
  picks: readonly ResultTourPick[];
}) {
  const { onAdd, dialog } = useCityTourAdd();
  return (
    <>
      <ul className="mt-4 flex flex-col gap-3">
        {picks.map(({ tour, reservedFor, text }, i) => {
          return (
            <CityTourCard
              key={`${tour.region}|${tour.name}`}
              tour={tour}
              text={text}
              rank={i + 1}
              reservedFor={reservedFor}
              onAdd={() => onAdd(tour, text?.name)}
            />
          );
        })}
      </ul>
      {dialog}
    </>
  );
}
