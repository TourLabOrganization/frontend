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
  /** ?locale=로 부르면 그 언어의 표시 값 */
  view?: PlannerPlaceView;
};

/**
 * 화면 언어로 옮긴 표시 값. Route Handler가 ?locale=로 받은 언어에 맞춰 만든다(번역 표는 서버에서만 읽는다).
 * 외국어 화면에서 옮기지 못한 값은 비운다(한국어 원문을 보이지 않는다)
 */
export type PlannerPlaceView = {
  /** 설명(한국어뿐인 설명은 앱이 옮긴 영어) */
  desc?: string;
  /** 운영시간 */
  hours?: string;
  /** 좌표 기준(외국어 화면은 한국어 주소를 뺀 출처 종류). 없으면 줄을 숨긴다 */
  source?: string;
  /** 앱이 옮긴 이름 · 설명이 보이는지(장소 시트 안내 한 줄) */
  appTranslated: boolean;
};

/** 장소 한 곳의 무거운 필드 주소. locale을 주면 그 언어의 표시 값(view)도 받는다 */
export function placeDetailPath(id: string, locale?: string): string {
  const path = `/api/planner/places/${encodeURIComponent(id)}`;
  return locale ? `${path}?locale=${encodeURIComponent(locale)}` : path;
}
