"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * 시티투어 추천 목록을 담는 칸 하나. 높이를 고정하고 칸 안에서 세로로 스크롤해 모두 본다(홈 「내 유형 추천」 · 추천 결과 화면).
 * 첫 카드와 다음 카드 윗부분이 보이는 높이라 아래에 더 있음을 알 수 있다.
 * 키보드로도 스크롤할 수 있게 칸에 초점이 가고(tabIndex 0), 화면 읽기 프로그램에는 이름 붙은 영역으로 읽힌다
 */
export function CityTourScroll({
  label,
  count,
  children,
}: {
  /** 영역 이름(목록 제목과 같은 문장) */
  label: string;
  /** 칸 안의 코스 수(안내 문장) */
  count: number;
  /** 카드 목록(ul) */
  children: ReactNode;
}) {
  const t = useTranslations("Home.citytour");
  return (
    <div className="mt-3">
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="max-h-[30rem] overflow-y-auto overscroll-contain rounded-card bg-fill-weak p-3 ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright md:max-h-[34rem]"
      >
        {children}
      </div>
      {count > 1 && (
        <p className="mt-2 text-caption text-fg-subtle">
          {t("scrollHint", { count })}
        </p>
      )}
    </div>
  );
}
