"use client";

import type { ReactNode } from "react";
import { CardCarousel } from "@/components/ui/CardCarousel";

/**
 * 시티투어 코스 목록(홈 「내 유형 추천」 · 「지역별 검색」, 추천 결과 화면).
 * 밑으로 늘리는 「더 보기」 대신 오디오 해설처럼 좌우로 넘기는 카드(CardCarousel, 대표 결정 2026-10-02).
 * 목록이 바뀌면(지역 · 탭) key로 새로 만들어 첫 장부터 시작한다
 */
export function CityTourMore({
  label,
  items,
}: {
  /** 목록 이름(목록 제목과 같은 문장) */
  label: string;
  /** 코스 카드(CityTourCard) */
  items: readonly ReactNode[];
}) {
  return (
    <div className="mt-3">
      <CardCarousel label={label} total={items.length} card={(i) => items[i]} />
    </div>
  );
}
