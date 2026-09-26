"use client";

import { Pause, Play, Send } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { HOME_THEME_ORDER } from "./theme-order";
import { useReducedMotion } from "./use-reduced-motion";

/** 배너 순서는 홈 테마 순서와 같다. 문구는 messages Home.banners.<slug> */
const SLIDES = HOME_THEME_ORDER;
/** 자동 넘김 간격(목업 값) */
const INTERVAL_MS = 5000;
/** 이만큼 이상 끌면 다음 · 이전 장으로 */
const SWIPE_PX = 40;
/** 이만큼 이상 움직였으면 끌기로 보고 링크 누름을 막는다 */
const CLICK_SLOP_PX = 5;

// 홈 위쪽 배너. 5초마다 다음 장으로 넘어가고, 끌어서(터치 · 마우스) 넘길 수 있다. 슬라이드 전체가 테마 화면 링크다.
// WCAG 2.2.2: 일시정지 버튼이 있고, 포커스가 안에 있거나 포인터가 올라가 있으면 멈춘다.
// 움직임 줄이기 설정이면 자동으로 넘기지 않고 전환 애니메이션도 없다
export function HeroCarousel() {
  const t = useTranslations("Home");
  const reduced = useReducedMotion();
  const total = SLIDES.length;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const running = !paused && !hovered && !focused && !reduced;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(
      () => setIndex((i) => (i + 1) % total),
      INTERVAL_MS,
    );
    return () => window.clearTimeout(id);
  }, [running, index, total]);

  const go = (next: number) => setIndex((next + total) % total);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { startX: e.clientX, moved: false };
    suppressClick.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < CLICK_SLOP_PX) return;
    d.moved = true;
    setDragging(true);
    setDragX(dx);
  }

  function endDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const dx = e.clientX - d.startX;
    if (d.moved) {
      suppressClick.current = true;
      if (dx <= -SWIPE_PX) go(index + 1);
      else if (dx >= SWIPE_PX) go(index - 1);
    }
    setDragging(false);
    setDragX(0);
  }

  function cancelDrag() {
    drag.current = null;
    setDragging(false);
    setDragX(0);
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("carouselLabel")}
      className="relative touch-pan-y bg-primary text-white select-none"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHovered(false);
        if (drag.current) endDrag(e);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
      onClickCapture={(e) => {
        // 끌기로 끝난 누름은 링크로 가지 않는다
        if (suppressClick.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressClick.current = false;
        }
      }}
    >
      <div className="overflow-hidden">
        <div
          aria-live={running ? "off" : "polite"}
          className={`flex ${
            dragging || reduced
              ? ""
              : "transition-transform duration-[550ms] ease-out"
          }`}
          style={{
            transform: `translateX(calc(${-index * 100}% + ${dragX}px))`,
          }}
        >
          {SLIDES.map((slug, i) => {
            const active = i === index;
            return (
              <div
                key={slug}
                role="group"
                aria-roledescription="slide"
                aria-label={t("slideLabel", { current: i + 1, total })}
                aria-hidden={!active}
                inert={!active}
                className="w-full shrink-0"
              >
                <Link
                  href={`/themes/${slug}`}
                  draggable={false}
                  className="block px-6 pt-5 pb-3 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
                >
                  <span className="inline-block bg-white px-2 py-1 text-micro font-bold tracking-[0.14em] text-primary">
                    {t(`banners.${slug}.kicker`)}
                  </span>
                  <span className="mt-3 block text-title font-bold">
                    <span className="block">
                      {t(`banners.${slug}.titleFirst`)}
                    </span>
                    <span className="block">
                      {t(`banners.${slug}.titleSecond`)}
                    </span>
                  </span>
                  <span className="mt-2 block text-label text-white/85">
                    {t(`banners.${slug}.description`)}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="flex items-center gap-2">
          <span className="border-2 border-white/70 px-2.5 py-1 text-caption font-bold">
            {t("slideLabel", { current: index + 1, total })}
          </span>
          {!reduced && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? t("play") : t("pause")}
              className="flex size-11 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-white active:bg-white/15 motion-reduce:transition-none"
            >
              {paused ? (
                <Play size={20} aria-hidden />
              ) : (
                <Pause size={20} aria-hidden />
              )}
            </button>
          )}
          <Send
            size={56}
            strokeWidth={1.5}
            className="ml-auto text-white/50"
            aria-hidden
          />
        </div>
        <div className="mt-1 -ml-3 flex">
          {SLIDES.map((slug, i) => (
            <button
              key={slug}
              type="button"
              onClick={() => go(i)}
              aria-label={t("goToSlide", { current: i + 1 })}
              aria-current={i === index ? "true" : undefined}
              className="flex h-11 w-11 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
            >
              <span
                className={`h-1 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                  i === index ? "w-7 bg-white" : "w-3.5 bg-white/35"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
