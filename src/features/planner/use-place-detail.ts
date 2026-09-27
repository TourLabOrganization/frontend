import { useQuery } from "@tanstack/react-query";
import { type PlannerPlaceDetail, placeDetailPath } from "./place-detail";

async function fetchPlaceDetail(id: string): Promise<PlannerPlaceDetail> {
  const res = await fetch(placeDetailPath(id), {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`place detail ${res.status}`);
  return (await res.json()) as PlannerPlaceDetail;
}

/**
 * 장소 시트의 설명 · 사진 등(place-details.json). 시트를 열 때(id가 생길 때) 한 곳만 받는다.
 * 빌드마다 바뀌는 정적 데이터라 한 번 받은 값은 다시 부르지 않는다
 */
export function usePlaceDetail(id: string | null) {
  return useQuery({
    queryKey: ["planner-place-detail", id],
    queryFn: () => fetchPlaceDetail(id!),
    enabled: id !== null,
    staleTime: Infinity,
    retry: 1,
  });
}
