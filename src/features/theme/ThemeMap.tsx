"use client";

import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  Polyline,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect } from "react";

// 테마 화면의 Google 지도 (@vis.gl/react-google-maps). 지도 탭과 코스 탭이 함께 쓴다.
// 키는 NEXT_PUBLIC_GOOGLE_MAPS_KEY(브라우저 노출 키, docs/security.md). 키가 없을 때의 안내는 쓰는 쪽이 그린다.
// mapId는 AdvancedMarker에 필요하다. 따로 만든 지도 스타일이 없으면 구글의 DEMO_MAP_ID를 쓴다.

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "DEMO_MAP_ID";
/** 핀이 하나뿐일 때 확대 수준 (fitBounds는 한 점이면 최대로 확대한다) */
const SINGLE_PIN_ZOOM = 14;
/** 가장자리 핀이 잘리지 않게 두는 여백(px) */
const BOUNDS_PADDING = 48;

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  /** 화면 읽기 · 마우스 툴팁 이름 */
  title: string;
  /** 번호 핀의 숫자. 없으면 작은 점 */
  label?: number;
};

type LatLng = { lat: number; lng: number };

type ThemeMapProps = {
  apiKey: string;
  /** 지도 영역의 이름 */
  label: string;
  pins: readonly MapPin[];
  /** 방문 순서대로 잇는 선 (날짜마다 하나) */
  paths?: readonly (readonly LatLng[])[];
  /** 옮겨 갈 자리 (열린 장소) */
  focus?: LatLng | null;
  onSelect?: (id: string) => void;
};

function boundsOf(points: readonly LatLng[]) {
  return {
    north: Math.max(...points.map((p) => p.lat)),
    south: Math.min(...points.map((p) => p.lat)),
    east: Math.max(...points.map((p) => p.lng)),
    west: Math.min(...points.map((p) => p.lng)),
  };
}

export function ThemeMap({
  apiKey,
  label,
  pins,
  paths = [],
  focus,
  onSelect,
}: ThemeMapProps) {
  // 번호 핀이 다 보이게 맞춘다. 번호 핀이 없으면 모든 핀
  const numbered = pins.filter((p) => p.label !== undefined);
  const fitPoints = numbered.length > 0 ? numbered : pins;
  const fitKey = fitPoints.map((p) => p.id).join("|");
  const initial = fitPoints.length > 0 ? boundsOf(fitPoints) : null;

  return (
    <div role="region" aria-label={label} className="h-full w-full">
      <APIProvider apiKey={apiKey}>
        <GoogleMap
          mapId={MAP_ID}
          defaultBounds={
            initial ? { ...initial, padding: BOUNDS_PADDING } : undefined
          }
          defaultCenter={initial ? undefined : { lat: 36.5, lng: 127.8 }}
          defaultZoom={initial ? undefined : 7}
          gestureHandling="cooperative"
          disableDefaultUI
          zoomControl
          clickableIcons={false}
          className="h-full w-full"
        >
          {pins
            .filter((p) => p.label === undefined)
            .map((p) => (
              <AdvancedMarker
                key={p.id}
                position={{ lat: p.lat, lng: p.lng }}
                title={p.title}
                onClick={onSelect ? () => onSelect(p.id) : undefined}
              >
                <span className="block size-2.5 rounded-full bg-fg-subtle ring-2 ring-surface" />
              </AdvancedMarker>
            ))}
          {numbered.map((p) => (
            <AdvancedMarker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              title={p.title}
              zIndex={1000 - (p.label ?? 0)}
              onClick={onSelect ? () => onSelect(p.id) : undefined}
            >
              <span className="flex size-[26px] items-center justify-center rounded-full bg-primary text-caption font-bold text-white tabular-nums ring-2 ring-surface">
                {p.label}
              </span>
            </AdvancedMarker>
          ))}
          <RoutePaths paths={paths} />
          <MapCamera fitKey={fitKey} fitPoints={fitPoints} focus={focus} />
        </GoogleMap>
      </APIProvider>
    </div>
  );
}

/** 방문 순서 선. 색은 primary 토큰 한 가지, 굵기는 날짜마다 같다 */
function RoutePaths({ paths }: { paths: readonly (readonly LatLng[])[] }) {
  // 지도가 생긴 뒤(브라우저)에만 그린다. 선 색은 hex를 적지 않고 CSS 토큰에서 읽는다
  const map = useMap();
  const color = map
    ? getComputedStyle(document.documentElement)
        .getPropertyValue("--color-primary")
        .trim()
    : "";
  if (!color) return null;
  return paths.map((path, i) =>
    path.length > 1 ? (
      <Polyline
        key={i}
        path={[...path]}
        strokeColor={color}
        strokeOpacity={0.9}
        strokeWeight={4}
        clickable={false}
      />
    ) : null,
  );
}

/** 걸러진 핀이 바뀌면 다시 맞추고, 장소가 열리면 그 자리로 옮긴다 */
function MapCamera({
  fitKey,
  fitPoints,
  focus,
}: {
  fitKey: string;
  fitPoints: readonly LatLng[];
  focus?: LatLng | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || fitPoints.length === 0) return;
    if (fitPoints.length === 1) {
      map.setCenter(fitPoints[0]);
      map.setZoom(SINGLE_PIN_ZOOM);
    } else {
      map.fitBounds(boundsOf(fitPoints), BOUNDS_PADDING);
    }
    // fitKey가 같으면 같은 핀 묶음이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);

  useEffect(() => {
    if (map && focus) map.panTo(focus);
  }, [map, focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
