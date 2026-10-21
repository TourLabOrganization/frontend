import type { LatLng, LegPoint, TravelMode } from "../course/schedule";
import { courseRoadQueries, legEnds, type RoadLegQuery } from "./road-legs";
import { wideLegMode } from "./schedule";
import {
  type NightStay,
  nightAnchor,
  pickNightStay,
  type StaySample,
} from "./stays";

// 지도 탭의 코스 표시(2026-10-03). 코스 탭이 계산한 일자별 일정(buildPlannerSchedule days)을 지도에 그릴 재료로 바꾼다:
// 날짜마다 색 하나로 경유지 순서 선과 번호 핀, 마지막 날을 뺀 날마다 그날 밤 숙소 핀(코스 탭 「숙박」 카드와 같은 규칙 pickNightStay:
// 담은 숙박 장소 → 숙소 표본, 25km 안에 없으면 핀 없음). 순수 함수만 둔다. 색은 카카오 도형이 CSS 변수를 못 받아 hex다.
// 선은 구간(같은 날 앞 장소 → 이 장소)마다 하나다(2026-10-20): 서버 도로 경로(GET /api/route, lib/road-route.ts)를 받으면 그 길을 따라 실선,
// 부르지 않는 구간(roadLegQuery null · 상한 넘음)이나 받기 전 · 경로 없음 · 실패면 두 장소를 잇는 직선 점선. 일정 시각은 바꾸지 않는다.
// 조회 · 키 · 주소 · 상한(테마 화면도 쓰는 것)은 장소 데이터를 싣지 않는 road-legs.ts에 둔다

/** 날짜 색(1일차부터). 7가지가 넘으면 처음부터 다시 */
export const DAY_COLORS: readonly string[] = [
  "#3182f6", // primary-bright
  "#f04452", // danger
  "#1aa36a", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#0ea5a4", // teal
  "#ec4899", // pink
];

export function dayColor(day: number): string {
  return DAY_COLORS[(day - 1) % DAY_COLORS.length];
}

/**
 * 투어 플래너 구간의 도로 경로 조회. null이면 부르지 않고 직선 점선으로 그린다.
 *  - 20m 안 → null
 *  - 자가용(own) → 추천 경로
 *  - 도시가 다른 광역 구간(legInfo wide와 같은 기준): 시외버스(wideLegMode bus) → 추천 경로, 기차 · 광역전철 → null(도로가 아니다)
 *  - 같은 도시: 대중교통 → 최단 거리(by=distance, 도보 · 버스 길에 가깝다. 카카오 도보 길찾기는 제휴 전용), 렌트카 → 추천 경로
 * legMode는 테스트가 바꿔 끼운다(기본 schedule.ts wideLegMode)
 */
export function roadLegQuery(
  p: LegPoint,
  q: LegPoint,
  mode: TravelMode,
  legMode: (
    p: { locKo: string },
    q: { locKo: string },
  ) => "metro" | "rail" | "bus" | null = wideLegMode,
): RoadLegQuery | null {
  const ends = legEnds(p, q);
  if (!ends) return null;
  if (mode === "own") return ends;
  if (p.locKo && q.locKo && p.locKo !== q.locKo)
    return legMode({ locKo: p.locKo }, { locKo: q.locKo }) === "bus"
      ? ends
      : null;
  return mode === "transit" ? { ...ends, by: "distance" } : ends;
}

/** 지도 선 한 구간. query가 없으면 직선 점선 */
export type CourseLeg = {
  day: number;
  color: string;
  from: LatLng;
  to: LatLng;
  query: RoadLegQuery | null;
};
export type CoursePin<P> = LatLng & {
  id: string;
  day: number;
  /** 그날 몇 번째(1부터) */
  order: number;
  color: string;
  place: P;
};
export type CourseStayPin<P> = LatLng & {
  /** 그날(체크인) 1부터 */
  day: number;
  color: string;
  stay: Extract<NightStay<P>, { kind: "picked" | "sample" }>;
};
export type CourseOverlay<P> = {
  /** 구간 선(날짜 · 순서대로) */
  legs: CourseLeg[];
  pins: CoursePin<P>[];
  stays: CourseStayPin<P>[];
  /** 화면을 맞출 점(경유지 + 숙소) */
  points: LatLng[];
};

/** legQuery: 구간의 도로 경로 조회(roadLegQuery 등). 없으면 모든 구간이 직선 점선 */
export function courseOverlay<P extends LegPoint & { id: string }>(
  days: readonly { day: number; stops: readonly { place: P }[] }[],
  stayPlaces: readonly P[],
  samples: readonly StaySample[],
  legQuery: (p: P, q: P) => RoadLegQuery | null = () => null,
): CourseOverlay<P> {
  const legs: CourseLeg[] = [];
  const pins: CoursePin<P>[] = [];
  const stays: CourseStayPin<P>[] = [];
  const queries = courseRoadQueries(
    days.map((d) => d.stops.map((s) => s.place)),
    legQuery,
  );
  days.forEach((d, i) => {
    const color = dayColor(d.day);
    d.stops.forEach(({ place }, k) => {
      if (k === 0) return;
      const prev = d.stops[k - 1].place;
      legs.push({
        day: d.day,
        color,
        from: { lat: prev.lat, lng: prev.lng },
        to: { lat: place.lat, lng: place.lng },
        query: queries[i][k],
      });
    });
    d.stops.forEach(({ place }, k) =>
      pins.push({
        id: place.id,
        day: d.day,
        order: k + 1,
        color,
        lat: place.lat,
        lng: place.lng,
        place,
      }),
    );
  });
  for (let i = 0; i < days.length - 1; i++) {
    const stay = pickNightStay(nightAnchor(days, i), stayPlaces, samples, i);
    if (!stay || stay.kind === "generic") continue;
    const at = stay.kind === "picked" ? stay.place : stay.sample;
    stays.push({
      day: days[i].day,
      color: dayColor(days[i].day),
      lat: at.lat,
      lng: at.lng,
      stay,
    });
  }
  return {
    legs,
    pins,
    stays,
    points: [...pins, ...stays].map(({ lat, lng }) => ({ lat, lng })),
  };
}
