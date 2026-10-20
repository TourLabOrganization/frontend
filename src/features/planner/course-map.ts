import {
  type LatLng,
  type LegPoint,
  straightKm,
  type TravelMode,
} from "../course/schedule";
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
// 부르지 않는 구간(roadLegQuery null · 상한 넘음)이나 받기 전 · 경로 없음 · 실패면 두 장소를 잇는 직선 점선. 일정 시각은 바꾸지 않는다

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

/** 도로 경로 조회(GET /api/route). 좌표는 소수 5자리, by "distance"면 최단 거리(없으면 카카오 추천 경로) */
export type RoadLegQuery = { from: LatLng; to: LatLng; by?: "distance" };

/** 한 코스에서 부르는 도로 경로 수 상한(같은 조회는 한 번). 넘는 구간은 직선 점선 */
export const ROAD_LEG_CAP = 80;
/** 이보다 가까운 구간(직선 km)은 부르지 않는다(서버 ROUTE_MIN_M 20m와 같다) */
const ROAD_MIN_KM = 0.02;

/** 소수 5자리(약 1m). 같은 구간이 같은 캐시를 쓴다 */
const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

/** 일정이 쓰는 두 점(소수 5자리). 20m 안이면 null */
function legEnds(p: LatLng, q: LatLng): { from: LatLng; to: LatLng } | null {
  const from = { lat: round5(p.lat), lng: round5(p.lng) };
  const to = { lat: round5(q.lat), lng: round5(q.lng) };
  return straightKm(from, to) < ROAD_MIN_KM ? null : { from, to };
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

/**
 * 테마 코스 탭 구간의 도로 경로 조회. 20m 안만 빼고 모두 부른다.
 * 도시가 같거나 한쪽 도시를 모르면 최단 거리(by=distance), 도시가 다르면 추천 경로
 */
export function themeRoadLegQuery(
  p: LegPoint,
  q: LegPoint,
): RoadLegQuery | null {
  const ends = legEnds(p, q);
  if (!ends) return null;
  return p.locKo && q.locKo && p.locKo !== q.locKo
    ? ends
    : { ...ends, by: "distance" };
}

/** 조회 하나를 가리키는 글자(같은 구간 = 같은 글자). 도로 경로 캐시 · 지도 · 코스 탭이 함께 쓴다 */
export function roadLegKey(q: RoadLegQuery): string {
  return `${q.from.lat},${q.from.lng}|${q.to.lat},${q.to.lng}|${q.by ?? ""}`;
}

/** 브라우저가 부르는 우리 주소 */
export function roadRoutePath(q: RoadLegQuery): string {
  const base = `/api/route?from=${q.from.lat},${q.from.lng}&to=${q.to.lat},${q.to.lng}`;
  return q.by ? `${base}&by=${q.by}` : base;
}

/**
 * 일자별 구간 조회. 결과[날][k]는 그날 k−1번째 → k번째 장소(k = 0은 늘 null).
 * 앞 날 · 앞 구간부터 ROAD_LEG_CAP개(같은 조회는 한 번 센다)까지만 두고, 넘는 새 구간은 null(직선 점선)
 */
export function courseRoadQueries<P extends LegPoint>(
  days: readonly (readonly P[])[],
  legQuery: (p: P, q: P) => RoadLegQuery | null,
): (RoadLegQuery | null)[][] {
  const seen = new Set<string>();
  return days.map((stops) =>
    stops.map((s, k) => {
      if (k === 0) return null;
      const q = legQuery(stops[k - 1], s);
      if (!q) return null;
      const key = roadLegKey(q);
      if (!seen.has(key)) {
        if (seen.size >= ROAD_LEG_CAP) return null;
        seen.add(key);
      }
      return q;
    }),
  );
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
