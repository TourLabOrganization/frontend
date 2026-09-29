"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useState } from "react";

/** 처음에 보이는 코스 수. 나머지는 「더 보기」로 펼친다 */
const INITIAL = 3;

/**
 * 시티투어 코스 목록(홈 「내 유형 추천」 · 「지역별 검색」, 추천 결과 화면).
 * 페이지 안에 따로 스크롤되는 칸을 두지 않는다(대표 결정 2026-09-30). 처음 3곳만 보이고
 * 「n개 코스 더 보기」로 모두 펼치며, 펼친 뒤에는 「접기」. 목록이 바뀌면(지역 · 탭) key로 새로 만들어 접힌 상태로 시작한다
 */
export function CityTourMore({
  label,
  items,
}: {
  /** 목록 이름(목록 제목과 같은 문장) */
  label: string;
  /** 코스 카드(CityTourCard, li) */
  items: readonly ReactNode[];
}) {
  const t = useTranslations("Home.citytour");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const rest = items.length - INITIAL;
  return (
    <div className="mt-3">
      <ul id={listId} aria-label={label} className="flex flex-col gap-3">
        {open || rest <= 0 ? items : items.slice(0, INITIAL)}
      </ul>
      {rest > 0 && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-fill text-label font-semibold text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-line motion-reduce:transition-none"
        >
          {open ? t("showLess") : t("showMore", { count: rest })}
          <ChevronDown
            size={18}
            aria-hidden
            className={`transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}
