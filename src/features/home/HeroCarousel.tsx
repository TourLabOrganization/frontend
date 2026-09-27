"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { ThemeSlug } from "@/features/recommend/themes";
import { themeBackdrop } from "@/features/recommend/works";
import { BANNER_VIDEO, type BannerVideo, bannerVideoSrc } from "./banner-media";
import { HOME_THEME_ORDER } from "./theme-order";
import { useReducedMotion } from "./use-reduced-motion";

/** 배너 순서는 홈 테마 순서와 같다. 문구는 messages Home.banners.<slug> */
const SLIDES = HOME_THEME_ORDER;
/** 자동 넘김 간격(목업 값) */
const INTERVAL_MS = 5000;
/** 영상 배경 슬라이드는 영상이 보이게 더 오래 머문다 */
const VIDEO_INTERVAL_MS = 10000;
/** 플레이어가 뜬 뒤 첫 화면이 나올 때까지 기다렸다가 썸네일에서 영상으로 바꾼다 */
const VIDEO_FADE_DELAY_MS = 1200;
/** 이만큼 이상 끌면 다음 · 이전 장으로 */
const SWIPE_PX = 40;
/** 이만큼 이상 움직였으면 끌기로 보고 링크 누름을 막는다 */
const CLICK_SLOP_PX = 5;

// 홈 위쪽 배너. 슬라이드마다 작품 스틸을 배경에 깔고, 영상이 있는 슬라이드(RESCENE)는 영상을 소리 없이 튼다.
// 5초마다(영상 슬라이드는 10초) 다음 장으로 넘어가고, 끌어서(터치 · 마우스) 넘기거나 좌우 화살표로 넘길 수 있다. 슬라이드 전체가 테마 화면 링크다.
// WCAG 2.2.2: 일시정지 버튼이 있고, 포커스가 안에 있거나 포인터가 올라가 있으면 멈춘다.
// 움직임 줄이기 설정이면 자동으로 넘기지 않고 전환 애니메이션 · 배경 영상도 없다(썸네일만)
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
      BANNER_VIDEO[SLIDES[index]] ? VIDEO_INTERVAL_MS : INTERVAL_MS,
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
      className="relative h-[22rem] touch-pan-y overflow-hidden bg-fg text-white select-none"
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
      <div className="h-full overflow-hidden">
        <div
          aria-live={running ? "off" : "polite"}
          className={`flex h-full ${
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
                className="relative h-full w-full shrink-0"
              >
                <SlideBackground
                  slug={slug}
                  first={i === 0}
                  playVideo={active && !paused && !reduced}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-b from-fg/80 via-fg/20 to-fg/70"
                />
                {/* 아래 조작(번호 · 멈춤 · 점 줄) 뒤를 더 진하게 덮는다. 영상 아래쪽에 박힌 자막이 점 줄 아래로 비치지 않게 */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-fg from-25% via-fg/75 via-60% to-fg/0"
                />
                <Link
                  href={`/themes/${slug}`}
                  draggable={false}
                  className="absolute inset-0 block px-6 pt-5 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
                >
                  <span className="inline-block bg-white px-2 py-1 text-micro font-bold tracking-[0.14em] text-fg">
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

      {/* 좌우 화살표. 제목 · 설명을 가리지 않게 가운데보다 조금 아래에 둔다(누르는 자리 44px) */}
      {(
        [
          ["prev", -1, ChevronLeft, "left-2"],
          ["next", 1, ChevronRight, "right-2"],
        ] as const
      ).map(([key, step, Icon, side]) => (
        <button
          key={key}
          type="button"
          onClick={() => go(index + step)}
          aria-label={t(key === "prev" ? "prevSlide" : "nextSlide")}
          className={`absolute top-[62%] ${side} flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-fg/45 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-white active:bg-fg/70 motion-reduce:transition-none`}
        >
          <Icon size={24} aria-hidden />
        </button>
      ))}

      <div className="absolute inset-x-0 bottom-0 px-6 pb-3">
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

// 슬라이드 배경. 작품 스틸, 영상 슬라이드는 썸네일 위에 소리 없는 영상을 얹는다.
// 영상은 보이는 슬라이드이고 멈춤이 아닐 때만 띄우고, 넘기거나 멈추면 내려서(썸네일로) 자원을 아낀다
function SlideBackground({
  slug,
  first,
  playVideo,
}: {
  slug: ThemeSlug;
  first: boolean;
  playVideo: boolean;
}) {
  const video = BANNER_VIDEO[slug];
  const poster = video ? video.poster : themeBackdrop(slug);

  return (
    <div aria-hidden className="absolute inset-0">
      {poster && (
        <Image
          src={poster}
          alt=""
          fill
          sizes="(min-width: 480px) 480px, 100vw"
          loading={first ? "eager" : "lazy"}
          fetchPriority={first ? "high" : "auto"}
          className="object-cover"
          // Wikimedia는 이미지 최적화 서버의 연속 요청에 429를 돌려줘서 브라우저가 직접 받는다
          unoptimized={poster.includes("wikimedia.org")}
          draggable={false}
        />
      )}
      {video && playVideo && <BackgroundVideo video={video} />}
    </div>
  );
}

// 배경 영상. 띄울 때마다 새로 그려져서, 플레이어가 준비될 때까지 투명했다가 썸네일 위로 나타난다
function BackgroundVideo({ video }: { video: BannerVideo }) {
  const [shown, setShown] = useState(false);
  return (
    <iframe
      src={bannerVideoSrc(video)}
      title={video.title}
      allow="autoplay; encrypted-media; picture-in-picture"
      tabIndex={-1}
      onLoad={() =>
        window.setTimeout(() => setShown(true), VIDEO_FADE_DELAY_MS)
      }
      className={`pointer-events-none absolute top-1/2 left-1/2 aspect-video h-[130%] min-w-full -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-500 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
