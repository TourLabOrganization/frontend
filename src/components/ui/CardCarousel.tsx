"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ReactNode,
  type Ref,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cardIndex, stepCard } from "./card-carousel";

/** 바깥에서 카드를 넘길 때(오디오 이어듣기: 해설이 끝나면 다음 카드로) */
export type CardCarouselHandle = { goTo: (index: number) => void };

type CardCarouselProps = {
  /** 바깥에서 넘기는 손잡이(goTo) */
  ref?: Ref<CardCarouselHandle>;
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
 * 보이는 카드 번호는 스크롤 위치로 안다(card-carousel.ts). 카드 간격(gap)은 두 카드의 offsetLeft 차로 잰다.
 * 카드 줄(ul)은 relative: 카드 안의 absolute 요소(sr-only 글자 등)가 줄 바깥(페이지) 기준으로 놓이면 문서 폭이 카드 전체 폭만큼 늘어나
 * 모바일 브라우저가 하단 탭 같은 fixed 요소를 그 폭 기준으로 놓는다(하단 탭이 밀리던 원인, 2026-10-02). 줄 기준으로 두어 줄 안에서 잘린다
 */
export function CardCarousel({
  ref,
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

  /** 화살표 · goTo로 넘기는 중인 목표 위치(px). 부드러운 스크롤이 지나가는 동안 스크롤 위치로 번호를 되돌리지 않게(오디오 이어듣기 때 다음 카드의 플레이어가 떼였다 붙어 재생이 끊기던 원인) */
  const target = useRef<number | null>(null);

  function onScroll() {
    const row = rowRef.current;
    if (!row) return;
    if (target.current !== null) {
      if (Math.abs(row.scrollLeft - target.current) > 2) return;
      target.current = null;
    }
    setIndex(cardIndex(row.scrollLeft, stride(row), total));
  }

  /** 손가락 · 휠로 직접 밀기 시작하면 넘기는 중인 목표를 버린다 */
  function cancelTarget() {
    target.current = null;
  }

  function goTo(next: number) {
    const row = rowRef.current;
    if (!row) return;
    const left = next * stride(row);
    target.current = left;
    row.scrollTo({ left, behavior: "smooth" });
    setIndex(next);
  }
  function go(step: -1 | 1) {
    goTo(stepCard(index, step, total));
  }
  useImperativeHandle(ref, () => ({
    goTo: (i: number) => goTo(Math.max(0, Math.min(total - 1, i))),
  }));

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
        onTouchStart={cancelTarget}
        onWheel={cancelTarget}
        onPointerDown={cancelTarget}
        aria-roledescription="carousel"
        aria-label={label}
        className="relative mt-1 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto overscroll-x-contain scroll-smooth [&::-webkit-scrollbar]:hidden"
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
