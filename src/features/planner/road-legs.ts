import { type LatLng, type LegPoint, straightKm } from "../course/schedule";

// 코스 구간 도로 경로(GET /api/route, lib/road-route.ts)를 부를 조회 · 키 · 주소(2026-10-20). 순수 함수만 둔다.
// 테마 화면 지도(theme/ThemeMap)와 브라우저 호출(use-road-legs.ts)이 쓰므로 장소 · 일정 데이터(places.json · stays.json · regions.json · wide.json)를
// import하지 않는다(course/schedule.ts straightKm만, theme/map-bundle.test.ts가 확인). 투어 플래너 구간 규칙 roadLegQuery는 광역 수단(planner/schedule.ts
// wideLegMode)이 필요해 course-map.ts에 둔다

/** 도로 경로 조회(GET /api/route). 좌표는 소수 5자리, by "distance"면 최단 거리(없으면 카카오 추천 경로) */
export type RoadLegQuery = { from: LatLng; to: LatLng; by?: "distance" };

/** 한 코스에서 부르는 도로 경로 수 상한(같은 조회는 한 번). 넘는 구간은 직선 점선 */
export const ROAD_LEG_CAP = 80;
/** 이보다 가까운 구간(직선 km)은 부르지 않는다(서버 ROUTE_MIN_M 20m와 같다) */
const ROAD_MIN_KM = 0.02;

/** 소수 5자리(약 1m). 같은 구간이 같은 캐시를 쓴다 */
const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

/** 일정이 쓰는 두 점(소수 5자리). 20m 안이면 null */
export function legEnds(
  p: LatLng,
  q: LatLng,
): { from: LatLng; to: LatLng } | null {
  const from = { lat: round5(p.lat), lng: round5(p.lng) };
  const to = { lat: round5(q.lat), lng: round5(q.lng) };
  return straightKm(from, to) < ROAD_MIN_KM ? null : { from, to };
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
