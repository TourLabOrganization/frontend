// 홈 「지금 인기 관광지」의 수기 목록. 서버에 공공데이터포털 키가 없거나(섹션이 숨던 경우) 집중률 호출이 실패 · 비었을 때 보인다.
// data/popular-fallback.json은 scripts/build-popular-fallback.mjs가 scripts/data/popular-manual.csv(사람이 고른 도시별 10곳,
// 근거: 한국관광 데이터랩 인기 관광지 순위 · 집중률 상위 상례)로 만든다. 손으로 고치지 않는다. 집중률 값은 없어 순위만 보인다
import fallbackData from "./data/popular-fallback.json";

export type PopularFallbackItem = {
  /** 플래너 장소 id(장소 시트를 연다) */
  id: string;
  ko: string;
  en: string;
  /** 근거(한국어, 화면에는 보이지 않는다) */
  evidence: string;
};

export type PopularFallback = {
  /** 수기 조사 기준일(YYYY-MM-DD) */
  date: string;
  cities: Readonly<Record<string, readonly PopularFallbackItem[]>>;
};

export const POPULAR_FALLBACK = fallbackData as PopularFallback;

/** 도시의 수기 목록. 없으면 빈 배열 */
export function popularFallback(city: string): readonly PopularFallbackItem[] {
  return POPULAR_FALLBACK.cities[city] ?? [];
}
