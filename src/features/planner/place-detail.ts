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
  /**
   * 한국관광 100선 선정 정보(scripts/apply-badge-lists.mjs, 명단 scripts/data/k100-list.csv).
   * edition = 선정 판(2025~2026), entry = 명단 이름, places = 그 건이 묶은 장소 수(5대 고궁이면 5)
   */
  k100?: { edition: string; entry: string; places: number };
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

/**
 * 한국관광 100선 선정 문장(설명 끝에 붙인다). 한 건이 여러 장소를 묶으면(5대 고궁 …) 한국어는 명단 이름을 함께 적는다.
 * 외국어 설명은 영어라(placeDescEn) 영어 문장을 붙인다
 */
export function k100Sentence(
  k100: NonNullable<PlannerPlaceDetail["k100"]>,
  locale: string,
): string {
  if (locale === "ko")
    return k100.places > 1
      ? `${k100.edition} 한국관광 100선 「${k100.entry}」 선정지.`
      : `${k100.edition} 한국관광 100선 선정지.`;
  return `Selected for the ${k100.edition.replace("~", "–")} Korea Tourism 100.`;
}

/** 설명 뒤에 문장을 붙인다(설명이 없으면 문장만) */
export function withSentence(
  desc: string | undefined,
  sentence: string,
): string {
  return desc ? `${desc.trimEnd()} ${sentence}` : sentence;
}

/** 장소 한 곳의 무거운 필드 주소. locale을 주면 그 언어의 표시 값(view)도 받는다 */
export function placeDetailPath(id: string, locale?: string): string {
  const path = `/api/planner/places/${encodeURIComponent(id)}`;
  return locale ? `${path}?locale=${encodeURIComponent(locale)}` : path;
}
