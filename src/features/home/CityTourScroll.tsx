"use client";

import { useTranslations } from "next-intl";
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/** 막대 최소 길이(px). 코스가 많아도 잡을 수 있는 크기 */
const MIN_THUMB = 32;

/**
 * 시티투어 목록을 담는 칸 하나(홈 「내 유형 추천」 · 「지역별 검색」, 추천 결과 화면). 높이를 고정하고 칸 안에서 세로로 스크롤한다.
 * 첫 카드와 다음 카드 윗부분이 보이는 높이라 아래에 더 있음을 알 수 있다.
 * 오른쪽에 스크롤 막대를 직접 그린다: 모바일 브라우저의 기본 스크롤바는 스크롤할 때만 잠깐 보여서, 늘 보이는 막대(위치 · 길이)로
 * 얼마나 남았는지 알린다. 막대는 끌어서 옮길 수 있고, 화면 읽기 프로그램에는 숨긴다(칸 자체가 스크롤된다).
 * 키보드로도 스크롤할 수 있게 칸에 초점이 가고(tabIndex 0), 이름 붙은 영역으로 읽힌다
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
  const boxRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // 막대 위치 · 길이(px). 넘치지 않으면 null(막대를 그리지 않는다)
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(
    null,
  );
  const drag = useRef<{ y: number; scrollTop: number } | null>(null);

  const measure = useCallback(() => {
    const box = boxRef.current;
    const track = trackRef.current;
    if (!box || !track) return;
    const { scrollTop, scrollHeight, clientHeight } = box;
    if (scrollHeight <= clientHeight + 1) {
      setThumb(null);
      return;
    }
    const trackH = track.clientHeight;
    const height = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * trackH);
    const top = (scrollTop / (scrollHeight - clientHeight)) * (trackH - height);
    setThumb({ top, height });
  }, []);

  // 목록이 바뀌거나(지역 · 탭) 칸 · 목록 크기가 바뀌면 다시 잰다
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    return () => observer.disconnect();
  }, [measure, children]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = boxRef.current;
    if (!box) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, scrollTop: box.scrollTop };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = boxRef.current;
    const track = trackRef.current;
    if (!drag.current || !box || !track || !thumb) return;
    const room = track.clientHeight - thumb.height;
    if (room <= 0) return;
    const ratio = (box.scrollHeight - box.clientHeight) / room;
    box.scrollTop =
      drag.current.scrollTop + (e.clientY - drag.current.y) * ratio;
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="mt-3">
      <div className="relative">
        <div
          ref={boxRef}
          role="region"
          aria-label={label}
          tabIndex={0}
          onScroll={measure}
          className="max-h-[30rem] [scrollbar-width:none] overflow-y-auto overscroll-contain rounded-card bg-fill-weak py-3 pr-6 pl-3 ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright md:max-h-[34rem] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>
        {/* 스크롤 막대: 칸 오른쪽 안쪽. 넘치지 않으면 숨긴다 */}
        <div
          ref={trackRef}
          aria-hidden
          className={`absolute top-3 right-2 bottom-3 w-1.5 rounded-full bg-line ${thumb ? "" : "invisible"}`}
        >
          {thumb && (
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              // 손가락으로 잡기 쉽게 보이는 막대보다 넓게 잡는다
              className="absolute -inset-x-2 cursor-grab touch-none active:cursor-grabbing"
              style={{ top: thumb.top, height: thumb.height }}
            >
              <div className="mx-auto h-full w-1.5 rounded-full bg-fg-disabled" />
            </div>
          )}
        </div>
      </div>
      {count > 1 && (
        <p className="mt-2 text-caption text-fg-subtle">
          {t("scrollHint", { count })}
        </p>
      )}
    </div>
  );
}
