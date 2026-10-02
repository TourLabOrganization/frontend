"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useRef, useState } from "react";
import { cardIndex, stepCard } from "./card-carousel";

type CardCarouselProps = {
  /** 목록 이름(aria-label) */
  label: string;
  /** 화살표 왼쪽에 보일 글(없으면 화살표 · 「n / 전체」만 오른쪽에) */
  heading?: ReactNode;
  /** 카드 수 */
  total: number;
  /** i번째 카드. active는 지금 보이는 카드인지(무거운 것은 보이는 카드에만 붙인다) */
  card: (index: number, active: boolean) => ReactNode;
};

/**
 * 좌우로 넘기는 카드 줄(오디오 해설 · 시티투어 코스). 목록을 밑으로 늘리지 않고 카드 한 장이 폭을 다 차지한다.
 * 손가락 · 트랙패드로 밀면 한 번에 한 장씩 걸리고(scroll-snap, snap-always), 끝 카드에서 더 밀어도 바깥(브라우저 뒤로 가기)으로
 * 번지지 않는다(overscroll-x-contain). 이전 · 다음 화살표(44px)와 「n / 전체」(aria-live)가 있고, 끝에서는 화살표가 꺼진다.
 * 보이는 카드 번호는 스크롤 위치로 안다(card-carousel.ts). 카드 간격(gap)은 두 카드의 offsetLeft 차로 잰다
 */
export function CardCarousel({
  label,
  heading,
  total,
  card,
}: CardCarouselProps) {
  const t = useTranslations("Common.carousel");
  const rowRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);

  /** 카드 한 장에서 다음 장까지의 거리(카드 폭 + 간격) */
  function stride(row: HTMLUListElement): number {
    const [a, b] = row.children as unknown as HTMLElement[];
    return a && b ? b.offsetLeft - a.offsetLeft : row.clientWidth;
  }

  function onScroll() {
    const row = rowRef.current;
    if (!row) return;
    setIndex(cardIndex(row.scrollLeft, stride(row), total));
  }

  function go(step: -1 | 1) {
    const row = rowRef.current;
    if (!row) return;
    const next = stepCard(index, step, total);
    row.scrollTo({ left: next * stride(row), behavior: "smooth" });
    setIndex(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-caption font-semibold text-fg-muted">
          {heading}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={t("prev")}
            disabled={index === 0}
            onClick={() => go(-1)}
            className="inline-flex size-11 items-center justify-center rounded-xl text-fg-muted focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill disabled:opacity-30"
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <p
            aria-live="polite"
            className="min-w-10 text-center text-caption text-fg-muted tabular-nums"
          >
            {t("position", { index: index + 1, total })}
          </p>
          <button
            type="button"
            aria-label={t("next")}
            disabled={index === total - 1}
            onClick={() => go(1)}
            className="inline-flex size-11 items-center justify-center rounded-xl text-fg-muted focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill disabled:opacity-30"
          >
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
      </div>
      <ul
        ref={rowRef}
        onScroll={onScroll}
        aria-roledescription="carousel"
        aria-label={label}
        className="mt-1 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto overscroll-x-contain scroll-smooth [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            aria-roledescription="slide"
            aria-label={t("position", { index: i + 1, total })}
            className="w-full shrink-0 snap-center snap-always"
          >
            {card(i, i === index)}
          </li>
        ))}
      </ul>
    </div>
  );
}
