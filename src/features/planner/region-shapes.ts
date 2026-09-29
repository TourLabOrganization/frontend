import shapesData from "./data/region-shapes.json";
import type { RegionKey } from "./regions";

// 투어 플래너 전국 지도의 권역 면. 통계청 2018 시도 경계를 권역(수도권 · 강원권 …)으로 합쳐 단순화한 것(scripts/build-region-shapes.mjs).
// 고리는 [위도, 경도] 목록(바깥 경계만). 전국 지도에서 권역을 면으로 칠하고, 누르면 그 권역 도시 묶음으로 들어간다.

export type Ring = readonly (readonly [number, number])[];

export const REGION_SHAPES = shapesData as unknown as Readonly<
  Record<RegionKey, readonly Ring[]>
>;

/**
 * 권역 이름표 자리 · 펼칠 쪽(xAnchor). 서쪽 권역(수도권 · 충청권 · 전라권)은 이 점에서 서쪽으로, 동쪽 권역(강원권 · 경북권 · 경남권)은 동쪽으로 펼쳐
 * 전국을 작게 볼 때도 영어 · 스페인어처럼 긴 이름(「Área Metropolitana de Seúl」)이 옆 권역 이름표와 겹치지 않는다.
 * 점은 모두 그 권역 면 안이다(region-shapes.test.ts)
 */
export const REGION_LABELS: Readonly<
  Record<RegionKey, { lat: number; lng: number; anchor: 0 | 0.5 | 1 }>
> = {
  capital: { lat: 37.62, lng: 127.4, anchor: 1 },
  chungcheong: { lat: 36.42, lng: 127.6, anchor: 1 },
  honam: { lat: 35.25, lng: 127.3, anchor: 1 },
  gangwon: { lat: 37.75, lng: 128.0, anchor: 0 },
  daegyeong: { lat: 36.3, lng: 128.3, anchor: 0 },
  dongnam: { lat: 35.3, lng: 127.9, anchor: 0 },
  jeju: { lat: 33.38, lng: 126.55, anchor: 0.5 },
};

/**
 * 권역 이름표 자리(화면 언어별). 한국어 · 중국어 · 일본어는 권역 이름이 짧아(수도권 · 首都圏) 수도권 · 강원권을
 * 예전처럼 장소 좌표 평균(center) 가운데에 둔다(대표 요청 2026-09-29). 나머지 권역과 영어 · 스페인어는 REGION_LABELS
 */
export function regionLabel(
  key: RegionKey,
  locale: string,
  center: { lat: number; lng: number },
): { lat: number; lng: number; anchor: 0 | 0.5 | 1 } {
  const short = locale === "ko" || locale === "zh" || locale === "ja";
  if (short && (key === "capital" || key === "gangwon"))
    return { lat: center.lat, lng: center.lng, anchor: 0.5 };
  return REGION_LABELS[key];
}
