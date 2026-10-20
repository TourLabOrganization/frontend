"use client";

import { CustomOverlayMap, Polyline, useMap } from "react-kakao-maps-sdk";
import { type LatLng, MapFrame } from "@/components/ui/MapFrame";
import type { LegPoint } from "@/features/course/schedule";
import {
  courseRoadQueries,
  roadLegKey,
  themeRoadLegQuery,
} from "@/features/planner/course-map";
import { useRoadLegs } from "@/features/planner/use-road-legs";

// 테마 화면의 카카오 지도. 지도 탭과 코스 탭이 함께 쓴다.
// 키 · 불러오기 실패 안내 · 화면 맞추기는 공통 지도 틀(components/ui/MapFrame)이 한다. 키가 없을 때의 안내는 쓰는 쪽이 그린다.
// 핀은 누를 수 있으면(onSelect) 버튼으로 그려 키보드로도 연다. 코스 탭처럼 누를 일이 없으면 이름만 가진 표시다.
// 코스 탭의 방문 순서 선은 구간마다 서버 도로 경로(GET /api/route, themeRoadLegQuery)를 따라 실선, 못 받은 구간은 직선 점선(2026-10-20).

/** 핀이 하나뿐일 때 카카오 지도 레벨 (1이 가장 가깝다) */
const SINGLE_PIN_LEVEL = 4;
/** 핀이 없을 때의 처음 화면 */
const EMPTY_VIEW = { center: { lat: 36.5, lng: 127.8 }, level: 12 };

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  /** 화면 읽기 · 마우스 툴팁 이름 */
  title: string;
  /** 번호 핀의 숫자. 없으면 작은 점 */
  label?: number;
};

type ThemeMapProps = {
  apiKey: string;
  /** 지도 영역의 이름 */
  label: string;
  pins: readonly MapPin[];
  /** 방문 순서대로 잇는 점 (날짜마다 하나). 도시(locKo)가 있으면 도로 경로 우선순위를 정하는 데 쓴다 */
  paths?: readonly (readonly LegPoint[])[];
  /** 옮겨 갈 자리 (열린 장소) */
  focus?: LatLng | null;
  onSelect?: (id: string) => void;
};

/** 누르는 자리 44px. 보이는 모양은 안에 그린다 */
const HIT_CLASS =
  "flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary-bright";

function PinHit({
  pin,
  onSelect,
  children,
}: {
  pin: MapPin;
  onSelect?: (id: string) => void;
  children: React.ReactNode;
}) {
  if (!onSelect) {
    return (
      <span
        role="img"
        aria-label={pin.title}
        title={pin.title}
        className={HIT_CLASS}
      >
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={pin.title}
      title={pin.title}
      onClick={() => onSelect(pin.id)}
      className={`${HIT_CLASS} cursor-pointer`}
    >
      {children}
    </button>
  );
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

  return (
    <MapFrame
      apiKey={apiKey}
      label={label}
      fitPoints={fitPoints}
      fitKey={fitPoints.map((p) => p.id).join("|")}
      focus={focus}
      singlePointLevel={SINGLE_PIN_LEVEL}
      emptyView={EMPTY_VIEW}
    >
      <RoutePaths paths={paths} />
      {pins
        .filter((p) => p.label === undefined)
        .map((p) => (
          <CustomOverlayMap
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            clickable
          >
            {/* 보이는 점은 10px */}
            <PinHit pin={p} onSelect={onSelect}>
              <span className="block size-2.5 rounded-full bg-fg-subtle ring-2 ring-surface" />
            </PinHit>
          </CustomOverlayMap>
        ))}
      {numbered.map((p) => (
        <CustomOverlayMap
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          clickable
          // 번호가 작을수록 위
          zIndex={1000 - (p.label ?? 0)}
        >
          {/* 보이는 번호 원은 26px */}
          <PinHit pin={p} onSelect={onSelect}>
            <span className="flex size-[26px] items-center justify-center rounded-full bg-primary text-caption font-bold text-white tabular-nums ring-2 ring-surface">
              {p.label}
            </span>
          </PinHit>
        </CustomOverlayMap>
      ))}
    </MapFrame>
  );
}

/**
 * 방문 순서 선. 색은 primary 토큰 한 가지, 굵기는 날짜마다 같다.
 * 구간(같은 날 앞 장소 → 이 장소)마다 도로 경로를 받으면 그 길을 따라 실선, 받기 전 · 경로 없음 · 실패 · 상한(80) 넘음은 직선 점선
 */
function RoutePaths({ paths }: { paths: readonly (readonly LegPoint[])[] }) {
  // 지도가 생긴 뒤(브라우저)에만 그려진다. 선 색은 hex를 적지 않고 CSS 토큰에서 읽는다
  useMap();
  const queries = courseRoadQueries(paths, themeRoadLegQuery);
  const roads = useRoadLegs(queries.flat());
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-primary")
    .trim();
  if (!color) return null;
  return paths.flatMap((path, i) =>
    path.slice(1).map((to, k) => {
      const q = queries[i][k + 1];
      const road = q ? roads.get(roadLegKey(q)) : undefined;
      const from = path[k];
      return (
        <Polyline
          key={`${i}-${k}-${road ? "road" : "line"}`}
          path={
            road
              ? road.points
              : [
                  { lat: from.lat, lng: from.lng },
                  { lat: to.lat, lng: to.lng },
                ]
          }
          strokeColor={color}
          strokeOpacity={0.9}
          strokeWeight={4}
          strokeStyle={road ? "solid" : "shortdash"}
        />
      );
    }),
  );
}
