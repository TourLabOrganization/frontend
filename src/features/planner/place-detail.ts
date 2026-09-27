// 장소 시트에서만 쓰는 무거운 필드. data/place-details.json(scripts/build-planner.mjs)의 값 모양이다.
// 클라이언트 번들에 넣지 않고 Route Handler(app/api/planner/places/[id]/route.ts)가 한 곳씩 돌려준다.

export type PlannerPlaceDetail = {
  /** 장소 설명 (Tour Planner.dc.html bKo · bEn) */
  desc?: { ko?: string; en?: string };
  /** 사진 주소 (Wikimedia, 폭 960) */
  img?: string;
  imgCredit?: string;
  /** 중문 · 일문 장소명 (파생 데이터/장소.csv. 한자 · 가나가 있을 때만) */
  zh?: string;
  ja?: string;
  /** 좌표 근거 (srcKo · srcEn) */
  src?: { ko?: string; en?: string };
  /** 카카오맵 장소 페이지 */
  url?: string;
  /** 시티투어 경유지로 추가된 장소 */
  ct?: true;
  /** 한국관광공사 연관 관광지에서 추가된 장소 */
  rs?: true;
};

/** 장소 한 곳의 무거운 필드 주소 */
export function placeDetailPath(id: string): string {
  return `/api/planner/places/${encodeURIComponent(id)}`;
}
