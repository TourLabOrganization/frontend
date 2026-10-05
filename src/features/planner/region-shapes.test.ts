import { describe, expect, it } from "vitest";
import { REGION_CENTER } from "./data";
import {
  REGION_LABELS,
  REGION_SHAPES,
  regionLabel,
  type Ring,
} from "./region-shapes";
import { CITY_INFO, REGION_KEYS } from "./regions";

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
  it("권역 7곳 모두 면이 있고, 고리는 한국 범위의 닫힌 도형이다", () => {
    for (const key of REGION_KEYS) {
      const rings = REGION_SHAPES[key];
      expect(rings.length, key).toBeGreaterThan(0);
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

  it("한국어 · 중국어 · 일본어는 수도권 · 강원권 이름표를 장소 좌표 평균 가운데에(예전 자리), 영어 · 스페인어는 펼친다", () => {
    for (const locale of ["ko", "zh", "ja"])
      for (const key of ["capital", "gangwon"] as const)
        expect(regionLabel(key, locale, REGION_CENTER[key])).toEqual({
          ...REGION_CENTER[key],
          anchor: 0.5,
        });
    for (const locale of ["en", "es"])
      expect(regionLabel("capital", locale, REGION_CENTER.capital)).toBe(
        REGION_LABELS.capital,
      );
    expect(regionLabel("honam", "ko", REGION_CENTER.honam)).toBe(
      REGION_LABELS.honam,
    );
  });

  it("울릉도는 경북권 면에 들어 있다", () => {
    expect(
      REGION_SHAPES.daegyeong.some((ring) => inside(37.5, 130.87, ring)),
    ).toBe(true);
  });

  // 백령도(약 51㎢)는 20㎢ 기준을 넘어 수도권 면에 남는다. 연평도(약 7㎢)는 다른 작은 섬처럼 면에서 빠지고 도시 묶음 · 핀만 그린다
  it("백령도는 수도권 면에 들어 있고, 연평도는 작은 섬이라 면에 없다", () => {
    const { lat, lng } = CITY_INFO["백령도"];
    expect(REGION_SHAPES.capital.some((ring) => inside(lat!, lng!, ring))).toBe(
      true,
    );
    const yp = CITY_INFO["연평도"];
    expect(
      REGION_KEYS.some((k) =>
        REGION_SHAPES[k].some((ring) => inside(yp.lat!, yp.lng!, ring)),
      ),
    ).toBe(false);
  });
});
