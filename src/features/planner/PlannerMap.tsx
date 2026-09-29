"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CustomOverlayMap, useMap } from "react-kakao-maps-sdk";
import { type LatLng, MapFrame } from "@/components/ui/MapFrame";
import { type BubbleBox, visibleBubbleIds } from "./bubble-overlap";
import { categoryDot } from "./category";
import { CategoryIcon } from "./CategoryIcon";

// 투어 플래너 지도(카카오). 키 · 불러오기 실패 안내 · 화면 맞추기는 공통 지도 틀(components/ui/MapFrame)이 한다.
// 전국 보기는 권역 묶음, 권역을 고르면 도시 묶음, 도시 보기는 분류 색 핀을 그린다.
// 묶음은 「수도권 218」처럼 이름과 장소 수를 두 줄로 적은 둥근 버튼이고, 누르면 쓰는 쪽이 주소를 바꾼다.
// 도시 묶음은 가까운 도시끼리 겹치므로 겹치면 장소가 적은 쪽을 숨긴다(확대하면 다시 보인다).
// 겹침은 지도가 멈출 때(idle)마다 화면 상자를 재서 계산한다(bubble-overlap.ts).

/** 점이 하나뿐일 때 카카오 지도 레벨 (1이 가장 가깝다) */
const SINGLE_POINT_LEVEL = 5;
/** 맞출 점이 없을 때의 처음 화면 (전국) */
const EMPTY_VIEW = { center: { lat: 36.3, lng: 127.8 }, level: 13 };

export type MapBubble = LatLng & {
  id: string;
  label: string;
  count: number;
  /** 화면 읽기 · 마우스 툴팁 이름. 「수도권 · 장소 218곳」 */
  title: string;
  /** 크기. 권역은 md(기본), 권역 안에서 도시를 모아 볼 때는 sm(조금 작게, 도시가 촘촘해도 덜 겹친다) */
  size?: "sm" | "md";
};

/** 묶음 표시 크기별 원 지름 · 글자. 원형이라 가로 · 세로가 같다 */
const BUBBLE_SIZE = {
  md: "size-14 text-micro [&>[data-count]]:text-caption",
  sm: "size-11 text-[0.625rem] [&>[data-count]]:text-micro",
} as const;

export type MapPin = LatLng & {
  id: string;
  cat: string;
  title: string;
};

type PlannerMapProps = {
  apiKey: string;
  /** 지도 영역의 이름 */
  label: string;
  bubbles?: readonly MapBubble[];
  /** 묶음끼리 겹치면 장소 수가 적은 쪽을 숨길지 (도시 묶음) */
  hideOverlapping?: boolean;
  pins?: readonly MapPin[];
  /** 화면을 맞출 점들. fitKey가 바뀔 때만 다시 맞춘다 */
  fitPoints: readonly LatLng[];
  fitKey: string;
  selectedId?: string | null;
  onBubble?: (id: string) => void;
  onPin?: (id: string) => void;
};

export function PlannerMap({
  apiKey,
  label,
  bubbles = [],
  hideOverlapping = false,
  pins = [],
  fitPoints,
  fitKey,
  selectedId,
  onBubble,
  onPin,
}: PlannerMapProps) {
  const selected = pins.find((p) => p.id === selectedId) ?? null;

  return (
    <MapFrame
      apiKey={apiKey}
      label={label}
      fitPoints={fitPoints}
      fitKey={fitKey}
      focus={selected}
      singlePointLevel={SINGLE_POINT_LEVEL}
      emptyView={EMPTY_VIEW}
    >
      {pins.map((p) => {
        const on = p.id === selectedId;
        return (
          <CustomOverlayMap
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            clickable
            zIndex={on ? 1000 : 0}
          >
            {/* 누르는 자리는 44px, 보이는 핀은 분류 색 동그라미 안 흰 분류 아이콘 28px(고른 핀은 36px) */}
            <button
              type="button"
              aria-label={p.title}
              title={p.title}
              onClick={onPin ? () => onPin(p.id) : undefined}
              className="flex size-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary-bright"
            >
              <span
                className={`flex items-center justify-center rounded-full ring-2 ring-surface transition-[width,height] duration-150 motion-reduce:transition-none ${categoryDot(
                  p.cat,
                )} ${on ? "size-9" : "size-7"}`}
              >
                <CategoryIcon cat={p.cat} size={on ? 20 : 16} inverse />
              </span>
            </button>
          </CustomOverlayMap>
        );
      })}
      <BubbleLayer
        bubbles={bubbles}
        hideOverlapping={hideOverlapping}
        onBubble={onBubble}
      />
    </MapFrame>
  );
}

/** 묶음의 앵커(0~1). 북서쪽으로 펴면 오른쪽 아래 모서리가 점에 온다 */
/** 표시는 늘 점 가운데(원형이라 크기가 정해져 있어 긴 이름이 옆 표시를 가리지 않는다) */
const BUBBLE_ANCHOR = 0.5;

/** 권역 · 도시 묶음. hideOverlapping이면 지도가 멈출 때마다 겹친 묶음 중 장소가 적은 쪽을 숨긴다 */
function BubbleLayer({
  bubbles,
  hideOverlapping,
  onBubble,
}: {
  bubbles: readonly MapBubble[];
  hideOverlapping: boolean;
  onBubble?: (id: string) => void;
}) {
  const map = useMap();
  const elements = useRef(new Map<string, HTMLElement>());
  // 숨긴 묶음 id. 겹침 숨기기를 하지 않으면 늘 비어 있다
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const measure = useCallback(() => {
    if (!hideOverlapping) return;
    const projection = map.getProjection();
    const boxes: BubbleBox[] = [];
    for (const b of bubbles) {
      const el = elements.current.get(b.id);
      if (!el) continue;
      const point = projection.containerPointFromCoords(
        new kakao.maps.LatLng(b.lat, b.lng),
      );
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      const anchor = BUBBLE_ANCHOR;
      boxes.push({
        id: b.id,
        count: b.count,
        left: point.x - width * anchor,
        top: point.y - height * anchor,
        width,
        height,
      });
    }
    const visible = visibleBubbleIds(boxes);
    setHidden(
      new Set(boxes.filter((b) => !visible.has(b.id)).map((b) => b.id)),
    );
  }, [map, bubbles, hideOverlapping]);

  useEffect(() => {
    if (!hideOverlapping) return;
    // 묶음이 그려진 뒤 한 번 재고, 이후 이동 · 확대가 끝날 때마다 다시 잰다
    const frame = requestAnimationFrame(measure);
    kakao.maps.event.addListener(map, "idle", measure);
    return () => {
      cancelAnimationFrame(frame);
      kakao.maps.event.removeListener(map, "idle", measure);
    };
  }, [map, measure, hideOverlapping]);

  return bubbles.map((b) => {
    const off = hideOverlapping && hidden.has(b.id);
    return (
      <CustomOverlayMap
        key={b.id}
        position={{ lat: b.lat, lng: b.lng }}
        clickable
        xAnchor={BUBBLE_ANCHOR}
        yAnchor={BUBBLE_ANCHOR}
        zIndex={b.count}
      >
        <button
          ref={(el) => {
            if (el) elements.current.set(b.id, el);
            else elements.current.delete(b.id);
          }}
          type="button"
          aria-label={b.title}
          title={b.title}
          aria-hidden={off || undefined}
          tabIndex={off ? -1 : undefined}
          onClick={onBubble ? () => onBubble(b.id) : undefined}
          // 원형 표시(권역 · 도시 같다). 이름은 원 안에서 한 줄로 줄이고 전체 이름은 title · aria-label에 있다
          className={`flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-full bg-primary px-1 text-center text-white ring-2 ring-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright ${
            BUBBLE_SIZE[b.size ?? "md"]
          } ${off ? "invisible" : ""}`}
        >
          <span className="max-w-full truncate leading-tight font-semibold">
            {b.label}
          </span>
          <span data-count className="leading-tight font-bold tabular-nums">
            {b.count}
          </span>
        </button>
      </CustomOverlayMap>
    );
  });
}
