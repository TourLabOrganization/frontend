import { describe, expect, it } from "vitest";
import { REGION_CENTER } from "./data";
import {
  REGION_COLORS,
  REGION_LABELS,
  REGION_SHAPES,
  type Ring,
} from "./region-shapes";
import { REGION_KEYS } from "./regions";

/** 점이 고리 안에 있는지(짝홀 규칙) */
function inside(lat: number, lng: number, ring: Ring): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ai, bi] = ring[i];
    const [aj, bj] = ring[j];
    if (
      bi > lng !== bj > lng &&
      lat < ((aj - ai) * (lng - bi)) / (bj - bi) + ai
    )
      hit = !hit;
  }
  return hit;
}

describe("권역 면 (region-shapes.json)", () => {
  it("권역 7곳 모두 면 · 색이 있고, 고리는 한국 범위의 닫힌 도형이다", () => {
    for (const key of REGION_KEYS) {
      const rings = REGION_SHAPES[key];
      expect(rings.length, key).toBeGreaterThan(0);
      expect(REGION_COLORS[key]).toMatch(/^#[0-9a-f]{6}$/);
      for (const ring of rings) {
        expect(ring.length, key).toBeGreaterThanOrEqual(4);
        for (const [lat, lng] of ring) {
          expect(lat).toBeGreaterThan(33);
          expect(lat).toBeLessThan(38.7);
          expect(lng).toBeGreaterThan(124.5);
          expect(lng).toBeLessThan(131);
        }
      }
    }
  });

  it("권역 이름표 자리 · 장소 좌표 평균은 그 권역 면 안에 있다", () => {
    for (const key of REGION_KEYS) {
      for (const { lat, lng } of [REGION_LABELS[key], REGION_CENTER[key]])
        expect(
          REGION_SHAPES[key].some((ring) => inside(lat, lng, ring)),
          key,
        ).toBe(true);
    }
  });

  it("이름표는 서쪽 권역은 서쪽으로 · 동쪽 권역은 동쪽으로 펼쳐, 맞닿은 권역끼리 펼친 방향이 서로 멀어진다", () => {
    const pairs = [
      ["capital", "gangwon"],
      ["chungcheong", "daegyeong"],
      ["honam", "dongnam"],
    ] as const;
    for (const [west, east] of pairs) {
      expect(REGION_LABELS[west].anchor).toBe(1);
      expect(REGION_LABELS[east].anchor).toBe(0);
      expect(REGION_LABELS[west].lng).toBeLessThan(REGION_LABELS[east].lng);
    }
  });

  it("울릉도는 경북권 면에 들어 있다", () => {
    expect(
      REGION_SHAPES.daegyeong.some((ring) => inside(37.5, 130.87, ring)),
    ).toBe(true);
  });
});
