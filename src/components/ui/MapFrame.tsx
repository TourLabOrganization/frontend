"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import {
  Map as KakaoMap,
  useKakaoLoader,
  useMap,
  ZoomControl,
} from "react-kakao-maps-sdk";

// 카카오 지도 틀 (react-kakao-maps-sdk). 테마 화면 지도(features/theme/ThemeMap)와 투어 플래너 지도(features/planner/PlannerMap)가 함께 쓴다.
// 키는 NEXT_PUBLIC_KAKAO_MAP_KEY(카카오 개발자 앱의 JavaScript 키, 브라우저 노출 키, docs/security.md). 키가 없을 때의 안내는 쓰는 쪽이 그린다.
// 카카오 지도는 영문 지도를 지원하지 않아 바탕 지도 글자는 언제나 한국어다. 핀 · 이름표는 쓰는 쪽이 화면 언어로 그린다.
// 표시(핀 · 묶음 · 선)는 children으로 받는다. fitKey가 바뀌면 fitPoints에 맞추고, focus가 바뀌면 그 자리로 옮긴다.

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
  /** 점이 하나뿐일 때 카카오 지도 레벨 (1이 가장 가깝다) */
  singlePointLevel: number;
  /** 맞출 점이 없을 때의 처음 화면 (level은 카카오 지도 레벨) */
  emptyView: { center: LatLng; level: number };
  children: React.ReactNode;
};

export function MapFrame({
  apiKey,
  label,
  fitPoints,
  fitKey,
  focus,
  singlePointLevel,
  emptyView,
  children,
}: MapFrameProps) {
  const t = useTranslations("Common");
  const id = useId();
  // SDK는 한 번만 불러온다(같은 키로 여러 곳에서 불러도 스크립트는 하나)
  const [loading, error] = useKakaoLoader({ appkey: apiKey });
  const frameRef = useRef<HTMLDivElement>(null);
  // 마우스 휠은 지도에 닿기 전에(캡처 단계) 멈춰서 지도가 확대되지 않고 페이지가 스크롤되게 한다.
  // 카카오 scrollwheel 옵션은 두 손가락 확대까지 함께 꺼서 쓰지 않는다. preventDefault는 하지 않는다(스크롤 유지)
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stop, { capture: true, passive: true });
    return () => el.removeEventListener("wheel", stop, { capture: true });
  }, []);
  // 처음 화면. 이후 화면 맞추기는 MapCamera가 하므로 처음 값으로 굳힌다
  const [initial] = useState(() =>
    fitPoints.length > 0
      ? { center: fitPoints[0], level: singlePointLevel }
      : emptyView,
  );

  // 지도 스크립트를 받지 못했을 때(네트워크 등). 키가 없을 때와 같은 모양으로 안내한다
  if (error) {
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
    <div
      ref={frameRef}
      role="region"
      aria-label={label}
      className="h-full w-full"
    >
      {/* 불러오는 동안은 빈 자리만 둔다(크기는 쓰는 쪽 틀이 정해 레이아웃이 흔들리지 않는다) */}
      {!loading && (
        <KakaoMap
          id={`kakao-map-${id}`}
          center={initial.center}
          level={initial.level}
          className="h-full w-full"
        >
          <ZoomControl position="RIGHT" />
          {children}
          <MapCamera
            fitKey={fitKey}
            fitPoints={fitPoints}
            focus={focus}
            singlePointLevel={singlePointLevel}
          />
        </KakaoMap>
      )}
    </div>
  );
}

/** 맞출 점 묶음(fitKey)이 바뀌면 다시 맞추고, 장소가 열리면 그 자리로 옮긴다 */
function MapCamera({
  fitKey,
  fitPoints,
  focus,
  singlePointLevel,
}: {
  fitKey: string;
  fitPoints: readonly LatLng[];
  focus?: LatLng | null;
  singlePointLevel: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (fitPoints.length === 0) return;
    if (fitPoints.length === 1) {
      map.setCenter(new kakao.maps.LatLng(fitPoints[0].lat, fitPoints[0].lng));
      map.setLevel(singlePointLevel);
    } else {
      const bounds = new kakao.maps.LatLngBounds();
      for (const p of fitPoints)
        bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
      map.setBounds(
        bounds,
        BOUNDS_PADDING,
        BOUNDS_PADDING,
        BOUNDS_PADDING,
        BOUNDS_PADDING,
      );
    }
    // fitKey가 같으면 같은 점 묶음이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);

  useEffect(() => {
    if (focus) map.panTo(new kakao.maps.LatLng(focus.lat, focus.lng));
  }, [map, focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
