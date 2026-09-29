import type { CityTour } from "./citytour";
import toursData from "./data/citytour.json";

/**
 * 시티투어 데이터 요약(노선 수 · 지역 수 · 가장 최근 기준일). 머리줄 알림이 쓴다.
 * 서버 컴포넌트에서만 import한다. 클라이언트 번들에 노선 280개를 싣지 않으려고 요약만 props로 넘긴다
 */
export const CITYTOUR_SUMMARY = (() => {
  const tours = toursData as CityTour[];
  return {
    tours: tours.length,
    regions: new Set(tours.map((t) => t.region)).size,
    date: tours.reduce((max, t) => (t.date > max ? t.date : max), ""),
  };
})();
