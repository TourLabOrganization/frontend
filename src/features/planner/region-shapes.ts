import shapesData from "./data/region-shapes.json";
import type { RegionKey } from "./regions";

// 투어 플래너 전국 지도의 권역 면. 통계청 2018 시도 경계를 권역(수도권 · 강원권 …)으로 합쳐 단순화한 것(scripts/build-region-shapes.mjs).
// 고리는 [위도, 경도] 목록(바깥 경계만). 전국 지도에서 권역을 면으로 칠하고, 누르면 그 권역 도시 묶음으로 들어간다.

export type Ring = readonly (readonly [number, number])[];

export const REGION_SHAPES = shapesData as unknown as Readonly<
  Record<RegionKey, readonly Ring[]>
>;

/** 권역 면 색(카카오 지도 도형은 #rrggbb만 받는다). 옆 권역끼리 구별되는 색 */
export const REGION_COLORS: Readonly<Record<RegionKey, string>> = {
  capital: "#3b82f6",
  gangwon: "#16a34a",
  chungcheong: "#f59e0b",
  daegyeong: "#ef4444",
  dongnam: "#8b5cf6",
  honam: "#0891b2",
  jeju: "#ec4899",
};
