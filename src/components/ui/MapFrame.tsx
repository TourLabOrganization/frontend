"use client";

import {
  APIProvider,
  Map as GoogleMap,
  useMap,
} from "@vis.gl/react-google-maps";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

// Google 지도 틀 (@vis.gl/react-google-maps). 테마 화면 지도(features/theme/ThemeMap)와 투어 플래너 지도(features/planner/PlannerMap)가 함께 쓴다.
// 키는 NEXT_PUBLIC_GOOGLE_MAPS_KEY(브라우저 노출 키, docs/security.md). 키가 없을 때의 안내는 쓰는 쪽이 그린다.
// mapId는 AdvancedMarker에 필요하다. 따로 만든 지도 스타일이 없으면 구글의 DEMO_MAP_ID를 쓴다.
// 표시(핀 · 묶음 · 선)는 children으로 받는다. fitKey가 바뀌면 fitPoints에 맞추고, focus가 바뀌면 그 자리로 옮긴다.

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "DEMO_MAP_ID";
/** 가장자리 표시가 잘리지 않게 두는 여백(px) */
const BOUNDS_PADDING = 48;

export type LatLng = { lat: number; lng: number };

type MapFrameProps = {
  apiKey: string;
  /** 지도 영역의 이름 */
  label: string;
  /** 화면을 맞출 점들. fitKey가 바뀔 때만 다시 맞춘다 */
  fitPoints: readonly LatLng[];
  fitKey: string;
  /** 옮겨 갈 자리 (열린 장소) */
  focus?: LatLng | null;
  /** 점이 하나뿐일 때 확대 수준 (fitBounds는 한 점이면 최대로 확대한다) */
  singlePointZoom: number;
  /** 맞출 점이 없을 때의 처음 화면 */
  emptyView: { center: LatLng; zoom: number };
  children: React.ReactNode;
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

export function MapFrame({
  apiKey,
  label,
  fitPoints,
  fitKey,
  focus,
  singlePointZoom,
  emptyView,
  children,
}: MapFrameProps) {
  const t = useTranslations("Common");
  const locale = useLocale();
  // 지도 스크립트를 받지 못했을 때(네트워크 등). 키가 없을 때와 같은 모양으로 안내한다
  const [failed, setFailed] = useState(false);
  const initial = fitPoints.length > 0 ? boundsOf(fitPoints) : null;

  if (failed) {
    return (
      <p
        role="note"
        className="flex h-full items-center justify-center px-6 text-center text-label text-fg-muted"
      >
        {t("mapLoadError")}
      </p>
    );
  }

  return (
    <div role="region" aria-label={label} className="h-full w-full">
      <APIProvider
        apiKey={apiKey}
        // 지도 글자를 화면 언어로. 스크립트는 한 번만 불러와서, 언어를 바꾸면 LocaleSwitch가 새로고침한다
        language={locale}
        region="KR"
        onError={() => setFailed(true)}
      >
        <GoogleMap
          mapId={MAP_ID}
          defaultBounds={
            initial ? { ...initial, padding: BOUNDS_PADDING } : undefined
          }
          defaultCenter={initial ? undefined : emptyView.center}
          defaultZoom={initial ? undefined : emptyView.zoom}
          gestureHandling="cooperative"
          disableDefaultUI
          zoomControl
          clickableIcons={false}
          className="h-full w-full"
        >
          {children}
          <MapCamera
            fitKey={fitKey}
            fitPoints={fitPoints}
            focus={focus}
            singlePointZoom={singlePointZoom}
          />
        </GoogleMap>
      </APIProvider>
    </div>
  );
}

/** 맞출 점 묶음(fitKey)이 바뀌면 다시 맞추고, 장소가 열리면 그 자리로 옮긴다 */
function MapCamera({
  fitKey,
  fitPoints,
  focus,
  singlePointZoom,
}: {
  fitKey: string;
  fitPoints: readonly LatLng[];
  focus?: LatLng | null;
  singlePointZoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || fitPoints.length === 0) return;
    if (fitPoints.length === 1) {
      map.setCenter(fitPoints[0]);
      map.setZoom(singlePointZoom);
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
