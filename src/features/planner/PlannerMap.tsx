"use client";

import {
  AdvancedMarker,
  APIProvider,
  CollisionBehavior,
  Map as GoogleMap,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { CATEGORY_DOT } from "./category";

// 투어 플래너 지도 (@vis.gl/react-google-maps). 키 · mapId는 테마 화면 지도(features/theme/ThemeMap.tsx)와 같다.
// 전국 보기는 권역 묶음, 권역을 고르면 도시 묶음, 도시 보기는 분류 색 핀을 그린다.
// 묶음은 「수도권 218」처럼 이름과 장소 수를 두 줄로 적은 둥근 표시이고, 누르면 쓰는 쪽이 주소를 바꾼다.
// 도시 묶음은 가까운 도시끼리 겹치므로 겹치면 장소가 적은 쪽을 숨긴다(확대하면 다시 보인다).

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "DEMO_MAP_ID";
/** 가장자리 표시가 잘리지 않게 두는 여백(px) */
const BOUNDS_PADDING = 48;
/** 점이 하나뿐일 때 확대 수준 (fitBounds는 한 점이면 최대로 확대한다) */
const SINGLE_POINT_ZOOM = 13;

type LatLng = { lat: number; lng: number };

export type MapBubble = LatLng & {
  id: string;
  label: string;
  count: number;
  /** 화면 읽기 · 마우스 툴팁 이름. 「수도권 · 장소 218곳」 */
  title: string;
  /**
   * 표시를 점의 북서쪽으로 펼칠지. 없으면 점 가운데.
   * 이름이 아주 긴 권역(영어 「Seoul Metropolitan Area」)이 옆 권역을 가리지 않게 바다 쪽으로 편다
   */
  offset?: "northwest";
};

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

function boundsOf(points: readonly LatLng[]) {
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const p of points) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  return { north, south, east, west };
}

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
  const initial = fitPoints.length > 0 ? boundsOf(fitPoints) : null;
  const selected = pins.find((p) => p.id === selectedId) ?? null;

  return (
    <div role="region" aria-label={label} className="h-full w-full">
      <APIProvider apiKey={apiKey}>
        <GoogleMap
          mapId={MAP_ID}
          defaultBounds={
            initial ? { ...initial, padding: BOUNDS_PADDING } : undefined
          }
          defaultCenter={initial ? undefined : { lat: 36.3, lng: 127.8 }}
          defaultZoom={initial ? undefined : 6}
          gestureHandling="cooperative"
          disableDefaultUI
          zoomControl
          clickableIcons={false}
          className="h-full w-full"
        >
          {pins.map((p) => {
            const on = p.id === selectedId;
            return (
              <AdvancedMarker
                key={p.id}
                position={{ lat: p.lat, lng: p.lng }}
                title={p.title}
                anchorLeft="-50%"
                anchorTop="-50%"
                zIndex={on ? 1000 : undefined}
                onClick={onPin ? () => onPin(p.id) : undefined}
              >
                {/* 누르는 자리는 44px, 보이는 점은 16px(고른 핀은 24px) */}
                <span className="flex size-11 items-center justify-center">
                  <span
                    className={`block rounded-full ring-2 ring-surface transition-[width,height] duration-150 motion-reduce:transition-none ${
                      CATEGORY_DOT[p.cat] ?? "bg-fg-subtle"
                    } ${on ? "size-6" : "size-4"}`}
                  />
                </span>
              </AdvancedMarker>
            );
          })}
          {bubbles.map((b) => (
            <AdvancedMarker
              key={b.id}
              position={{ lat: b.lat, lng: b.lng }}
              title={b.title}
              anchorLeft={b.offset === "northwest" ? "-100%" : "-50%"}
              anchorTop={b.offset === "northwest" ? "-100%" : "-50%"}
              zIndex={b.count}
              collisionBehavior={
                hideOverlapping
                  ? CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY
                  : CollisionBehavior.REQUIRED
              }
              onClick={onBubble ? () => onBubble(b.id) : undefined}
            >
              <span className="flex min-h-11 max-w-24 min-w-11 flex-col items-center justify-center rounded-2xl bg-primary px-2.5 py-1 text-center text-white ring-2 ring-surface">
                <span className="text-micro leading-tight font-semibold">
                  {b.label}
                </span>
                <span className="text-caption leading-tight font-bold tabular-nums">
                  {b.count}
                </span>
              </span>
            </AdvancedMarker>
          ))}
          <MapCamera fitKey={fitKey} fitPoints={fitPoints} focus={selected} />
        </GoogleMap>
      </APIProvider>
    </div>
  );
}

/** 범위(fitKey)가 바뀌면 다시 맞추고, 장소가 열리면 그 자리로 옮긴다 */
function MapCamera({
  fitKey,
  fitPoints,
  focus,
}: {
  fitKey: string;
  fitPoints: readonly LatLng[];
  focus: LatLng | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || fitPoints.length === 0) return;
    if (fitPoints.length === 1) {
      map.setCenter(fitPoints[0]);
      map.setZoom(SINGLE_POINT_ZOOM);
    } else {
      map.fitBounds(boundsOf(fitPoints), BOUNDS_PADDING);
    }
    // fitKey가 같으면 같은 점 묶음이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);

  useEffect(() => {
    if (map && focus) map.panTo(focus);
  }, [map, focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
