import type { PlannerPlace } from "./data";

// 앱 장소 데이터(places.json)에 없는 한국관광공사 관광지(「신규 관광지」). 홈 「지금 인기 관광지」가 이름 · 위치로도 앱 장소를 못 찾으면
// 한국관광공사 국문 관광정보(KorService2)의 콘텐츠 id로 id를 만든다(kto:<contentid>).
// 서버(lib/tour-api.ts resolveTourPlace)가 이 id를 공공데이터포털에서 풀어 장소 시트의 칸(사진 · 날씨 · 미세먼지 · 오디오 가이드 · 연관 관광지 ·
// 방문 집중률)과 설명을 앱 장소와 같게 돌려주고, 브라우저는 받은 장소를 기억해 두어(extra-places.ts) 지도 · 코스에 앱 장소처럼 넣는다.
// 이 파일은 클라이언트 · 서버가 함께 쓴다(데이터 JSON을 import하지 않는다).

export const KTO_PREFIX = "kto:";

/** kto:<숫자 콘텐츠 id> 모양인가 */
export function isKtoId(id: string): boolean {
  return /^kto:\d{1,12}$/.test(id);
}

/** 콘텐츠 id → 장소 id. 숫자가 아니면 null */
export function ktoId(contentid: unknown): string | null {
  const id = `${KTO_PREFIX}${String(contentid ?? "").trim()}`;
  return isKtoId(id) ? id : null;
}

/** 신규 관광지. 앱 장소와 같은 필드에 한국관광공사 대표 사진 · 주소를 더한다 */
export type KtoPlace = PlannerPlace & {
  /** 한국관광공사 대표 이미지(https). 없으면 빈 값 */
  photo?: string;
  /** 주소(addr1) */
  addr?: string;
};

/** 신규 관광지 한 곳을 받는 주소(지도 링크로 바로 열었을 때) */
export function spotPath(id: string): string {
  return `/api/tour/spot?id=${encodeURIComponent(id)}`;
}
