import type { LatLng } from "../course/schedule";
import {
  type NightStay,
  nightAnchor,
  pickNightStay,
  type StaySample,
} from "./stays";

// 지도 탭의 코스 표시(2026-10-03). 코스 탭이 계산한 일자별 일정(buildPlannerSchedule days)을 지도에 그릴 재료로 바꾼다:
// 날짜마다 색 하나로 경유지 순서 선과 번호 핀, 마지막 날을 뺀 날마다 그날 밤 숙소 핀(코스 탭 「숙박」 카드와 같은 규칙 pickNightStay:
// 담은 숙박 장소 → 숙소 표본, 25km 안에 없으면 핀 없음). 순수 함수만 둔다. 색은 카카오 도형이 CSS 변수를 못 받아 hex다

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

export type CoursePath = { day: number; color: string; points: LatLng[] };
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
  paths: CoursePath[];
  pins: CoursePin<P>[];
  stays: CourseStayPin<P>[];
  /** 화면을 맞출 점(경유지 + 숙소) */
  points: LatLng[];
};

export function courseOverlay<P extends LatLng & { id: string }>(
  days: readonly { day: number; stops: readonly { place: P }[] }[],
  stayPlaces: readonly P[],
  samples: readonly StaySample[],
): CourseOverlay<P> {
  const paths: CoursePath[] = [];
  const pins: CoursePin<P>[] = [];
  const stays: CourseStayPin<P>[] = [];
  for (const d of days) {
    const color = dayColor(d.day);
    const points = d.stops.map(({ place }) => ({
      lat: place.lat,
      lng: place.lng,
    }));
    if (points.length > 1) paths.push({ day: d.day, color, points });
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
  }
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
    paths,
    pins,
    stays,
    points: [...pins, ...stays].map(({ lat, lng }) => ({ lat, lng })),
  };
}
