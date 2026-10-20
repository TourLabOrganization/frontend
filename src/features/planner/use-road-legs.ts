import { useQueries } from "@tanstack/react-query";
import type { LatLng } from "@/features/course/schedule";
import type { RoadRouteBody } from "@/lib/road-route";
import { type RoadLegQuery, roadLegKey, roadRoutePath } from "./course-map";

// 코스 구간의 도로 경로(GET /api/route, lib/road-route.ts). 지도 탭 · 코스 탭 · 테마 코스 지도가 같은 queryKey로 부르므로
// 한 구간은 한 번만 받는다. 서버는 결과를 저장하지 않고(카카오 정책) 브라우저가 1시간 들고 있는다.
// 경로 없음 · 오류 · 시간 초과는 null(쓰는 쪽은 직선 점선과 일정의 어림 거리를 그대로 쓴다)

/** 받은 도로 경로. points는 지도 선 */
export type RoadLeg = { km: number; min: number; points: LatLng[] };

/** 브라우저 캐시(ms). 서버 Cache-Control(1시간)과 같다 */
const ROAD_CACHE_MS = 3600 * 1000;
/** 시간 제한(ms). 서버의 카카오 시간 제한(8초)보다 길게 */
const ROAD_TIMEOUT_MS = 10000;

// 서버에 키가 없거나 카카오내비 권한이 없으면(503) 이 화면을 새로 열 때까지 더 부르지 않는다
let notConfigured = false;

async function fetchRoadLeg(q: RoadLegQuery): Promise<RoadLeg | null> {
  if (notConfigured) return null;
  try {
    const res = await fetch(roadRoutePath(q), {
      signal: AbortSignal.timeout(ROAD_TIMEOUT_MS),
    });
    if (res.status === 503) notConfigured = true;
    if (!res.ok) return null;
    const body = (await res.json()) as RoadRouteBody;
    if ("empty" in body || !Array.isArray(body.path) || body.path.length < 2)
      return null;
    return {
      km: body.km,
      min: body.min,
      points: body.path.map(([lat, lng]) => ({ lat, lng })),
    };
  } catch {
    return null;
  }
}

/**
 * 구간 조회들의 도로 경로. 받은 구간만 roadLegKey → 경로로 담는다(받는 중 · 없음 · 실패는 빠진다).
 * null(부르지 않는 구간)과 같은 조회는 한 번만 부른다
 */
export function useRoadLegs(
  queries: readonly (RoadLegQuery | null)[],
): ReadonlyMap<string, RoadLeg> {
  const unique = new Map<string, RoadLegQuery>();
  for (const q of queries) if (q) unique.set(roadLegKey(q), q);
  const list = [...unique.values()];
  return useQueries({
    queries: list.map((q) => ({
      queryKey: [
        "route",
        `${q.from.lat},${q.from.lng}`,
        `${q.to.lat},${q.to.lng}`,
        q.by ?? "",
      ],
      queryFn: () => fetchRoadLeg(q),
      staleTime: ROAD_CACHE_MS,
      gcTime: ROAD_CACHE_MS,
      retry: false,
    })),
    combine: (results) => {
      const out = new Map<string, RoadLeg>();
      results.forEach((r, i) => {
        if (r.data) out.set(roadLegKey(list[i]), r.data);
      });
      return out;
    },
  });
}
