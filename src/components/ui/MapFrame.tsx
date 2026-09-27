"use client";

import { LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import {
  Circle,
  CustomOverlayMap,
  Map as KakaoMap,
  useKakaoLoader,
  useMap,
  ZoomControl,
} from "react-kakao-maps-sdk";
import {
  accuracyRadius,
  canLocate,
  GEOLOCATION_OPTIONS,
  type LocateFailure,
  locateFailure,
} from "./geolocation";

// 카카오 지도 틀 (react-kakao-maps-sdk). 테마 화면 지도(features/theme/ThemeMap)와 투어 플래너 지도(features/planner/PlannerMap)가 함께 쓴다.
// 키는 NEXT_PUBLIC_KAKAO_MAP_KEY(카카오 개발자 앱의 JavaScript 키, 브라우저 노출 키, docs/security.md). 키가 없을 때의 안내는 쓰는 쪽이 그린다.
// 카카오 지도는 영문 지도를 지원하지 않아 바탕 지도 글자는 언제나 한국어다. 핀 · 이름표는 쓰는 쪽이 화면 언어로 그린다.
// 표시(핀 · 묶음 · 선)는 children으로 받는다. fitKey가 바뀌면 fitPoints에 맞추고, focus가 바뀌면 그 자리로 옮긴다.
// 공통 조작: 확대 버튼(오른쪽 위, 카카오) · 지도/위성 전환(왼쪽 위) · 내 위치(오른쪽 아래). 서로 겹치지 않는 자리다.
// 내 위치는 누를 때만 위치 권한을 묻고, 받은 위치는 점 · 정확도 원으로만 그린다(저장하지 않는다).

/** 가장자리 표시가 잘리지 않게 두는 여백(px) */
const BOUNDS_PADDING = 48;
/** 내 위치로 옮길 때 이보다 멀면 이 레벨로 당긴다 (PoC: 구글 지도 줌 14 미만이면 14) */
const LOCATE_LEVEL = 5;

type MapType = "ROADMAP" | "HYBRID";
type MyPosition = LatLng & { accuracy: number };

const CONTROL_CLASS =
  "flex min-h-11 items-center justify-center bg-surface text-label font-semibold ring-1 ring-line transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none";

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
  const [mapType, setMapType] = useState<MapType>("ROADMAP");
  const [me, setMe] = useState<MyPosition | null>(null);
  // 내 위치로 옮긴 횟수. 같은 자리를 다시 눌러도 다시 옮긴다
  const [meTick, setMeTick] = useState(0);
  const [locating, setLocating] = useState(false);
  const [failure, setFailure] = useState<LocateFailure | null>(null);

  const locate = () => {
    setFailure(null);
    if (
      !canLocate({
        isSecureContext: window.isSecureContext,
        hasGeolocation: "geolocation" in navigator,
      })
    ) {
      setFailure("insecure");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setMe({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setMeTick((n) => n + 1);
      },
      (err) => {
        setLocating(false);
        setFailure(locateFailure(err.code));
      },
      GEOLOCATION_OPTIONS,
    );
  };

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
      className="relative h-full w-full"
    >
      {/* 불러오는 동안은 빈 자리만 둔다(크기는 쓰는 쪽 틀이 정해 레이아웃이 흔들리지 않는다) */}
      {!loading && (
        <>
          {/* 핀 · 묶음의 zIndex가 아래 조작 버튼을 덮지 않게 지도 안에 가둔다 */}
          <div className="isolate h-full w-full">
            <KakaoMap
              id={`kakao-map-${id}`}
              center={initial.center}
              level={initial.level}
              mapTypeId={mapType}
              className="h-full w-full"
            >
              <ZoomControl position="RIGHT" />
              {children}
              {me && <MyLocation position={me} tick={meTick} />}
              <MapCamera
                fitKey={fitKey}
                fitPoints={fitPoints}
                focus={focus}
                singlePointLevel={singlePointLevel}
              />
            </KakaoMap>
          </div>

          <div
            role="group"
            aria-label={t("map.typeLabel")}
            className="absolute top-3 left-3 z-10 flex overflow-hidden rounded-xl"
          >
            {(["ROADMAP", "HYBRID"] as const).map((type, i) => {
              const pressed = mapType === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setMapType(type)}
                  className={`${CONTROL_CLASS} px-3.5 ${i === 0 ? "rounded-l-xl" : "rounded-r-xl"} ${
                    pressed
                      ? "bg-primary-weak text-primary-strong"
                      : "text-fg-muted active:bg-fill"
                  }`}
                >
                  {type === "ROADMAP" ? t("map.roadmap") : t("map.satellite")}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-label={t("map.locate")}
            title={t("map.locate")}
            aria-busy={locating}
            onClick={locate}
            className={`${CONTROL_CLASS} absolute right-3 bottom-3 z-10 size-11 rounded-full active:bg-fill ${
              me ? "text-primary" : "text-fg-muted"
            }`}
          >
            <LocateFixed size={20} aria-hidden />
          </button>

          <p
            role="status"
            className={
              failure || locating
                ? "absolute top-17 right-14 left-3 z-10 w-fit rounded-xl bg-surface px-3 py-2 text-caption text-fg ring-1 ring-line"
                : "sr-only"
            }
          >
            {locating
              ? t("map.locating")
              : failure
                ? t(`map.${failure}`)
                : me
                  ? t("map.located")
                  : ""}
          </p>
        </>
      )}
    </div>
  );
}

/** 내 위치 점과 정확도 원. 위치를 받을 때마다(tick) 그리로 옮긴다 */
function MyLocation({
  position,
  tick,
}: {
  position: MyPosition;
  tick: number;
}) {
  const t = useTranslations("Common");
  const map = useMap();

  useEffect(() => {
    map.panTo(new kakao.maps.LatLng(position.lat, position.lng));
    if (map.getLevel() > LOCATE_LEVEL) map.setLevel(LOCATE_LEVEL);
    // 새 위치를 받을 때(tick)만 옮긴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, tick]);

  // 원 색은 hex를 적지 않고 CSS 토큰에서 읽는다(지도가 생긴 뒤 브라우저에서만 그려진다)
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-primary-bright")
    .trim();

  return (
    <>
      {color && (
        <Circle
          center={position}
          radius={accuracyRadius(position.accuracy)}
          strokeWeight={1}
          strokeColor={color}
          strokeOpacity={0.5}
          fillColor={color}
          fillOpacity={0.12}
        />
      )}
      <CustomOverlayMap position={position} zIndex={2000}>
        <span
          role="img"
          aria-label={t("map.myLocation")}
          className="block size-4 rounded-full bg-primary-bright ring-3 ring-surface"
        />
      </CustomOverlayMap>
    </>
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
