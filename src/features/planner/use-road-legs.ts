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
/** 시간 제한(ms). 서버의 카카오 시간 제한(8초)보다 길게. 자리를 받은 뒤부터 잰다 */
const ROAD_TIMEOUT_MS = 10000;
/** 동시에 보내는 요청 수(첫 답을 받은 뒤). 앱 road_route.dart roadRouteParallel과 같다 */
export const ROAD_PARALLEL = 6;

/**
 * 구간 도로 경로를 받는 함수. 앱 road_route.dart RoadRouteGate와 같은 문지기를 둔다:
 * 첫 답을 받기 전에는 하나만, 그 뒤로는 ROAD_PARALLEL개까지 보낸다(코스 하나에 80구간까지라 한꺼번에 보내지 않는다).
 * 시간 제한은 자리를 받은 뒤부터 잰다(기다린 시간은 넣지 않는다).
 * 503(키 없음 · 카카오내비 권한 없음)을 받으면 이 함수는 더 부르지 않는다 — 키가 없는 서버에는 한 번만 묻는다
 */
export function roadLegFetcher(): (q: RoadLegQuery) => Promise<RoadLeg | null> {
  let off = false;
  let answered = false;
  let running = 0;
  const waiting: (() => void)[] = [];
  const limit = () => (answered ? ROAD_PARALLEL : 1);

  async function fetchOne(q: RoadLegQuery): Promise<RoadLeg | null> {
    try {
      const res = await fetch(roadRoutePath(q), {
        signal: AbortSignal.timeout(ROAD_TIMEOUT_MS),
      });
      if (res.status === 503) off = true;
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

  return async (q) => {
    if (running < limit()) running++;
    // 자리를 받고 깨어난다(running은 깨운 쪽이 셌다)
    else await new Promise<void>((wake) => waiting.push(wake));
    try {
      return off ? null : await fetchOne(q);
    } finally {
      answered = true;
      running--;
      while (waiting.length > 0 && running < limit()) {
        running++;
        waiting.shift()!();
      }
    }
  };
}

// 페이지를 새로 고칠 때까지 문지기 하나를 쓴다(App Router 화면 이동은 모듈을 그대로 두므로 503 뒤에는 새로 고칠 때까지 부르지 않는다)
const fetchRoadLeg = roadLegFetcher();

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
