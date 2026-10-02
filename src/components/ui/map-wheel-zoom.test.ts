import { describe, expect, it } from "vitest";
import {
  accumulateZoom,
  settleZoom,
  wheelLevelDelta,
  zoomScale,
} from "./map-wheel-zoom";

describe("휠 → 소수 레벨", () => {
  it("마우스 휠 한 칸(100px 위로)이 한 레벨 확대, 아래로는 축소", () => {
    expect(
      wheelLevelDelta({ deltaY: -100, deltaMode: 0, ctrlKey: false }),
    ).toBe(1);
    expect(wheelLevelDelta({ deltaY: 100, deltaMode: 0, ctrlKey: false })).toBe(
      -1,
    );
    expect(wheelLevelDelta({ deltaY: -25, deltaMode: 0, ctrlKey: false })).toBe(
      0.25,
    );
  });

  it("줄 · 쪽 단위 휠과 트랙패드 핀치(ctrlKey)를 환산하고 한 레벨을 넘지 않는다", () => {
    expect(wheelLevelDelta({ deltaY: -3, deltaMode: 1, ctrlKey: false })).toBe(
      0.48,
    );
    expect(wheelLevelDelta({ deltaY: -1, deltaMode: 2, ctrlKey: false })).toBe(
      1,
    );
    expect(wheelLevelDelta({ deltaY: -10, deltaMode: 0, ctrlKey: true })).toBe(
      0.3,
    );
    expect(
      wheelLevelDelta({ deltaY: 5000, deltaMode: 0, ctrlKey: false }),
    ).toBe(-1);
  });

  it("배율은 한 레벨에 2배", () => {
    expect(zoomScale(0)).toBe(1);
    expect(zoomScale(1)).toBe(2);
    expect(zoomScale(-1)).toBe(0.5);
    expect(zoomScale(0.5)).toBeCloseTo(1.414, 3);
  });
});

describe("모으기와 맞추기", () => {
  it("한 레벨이 차면 카카오 레벨을 바꾸고 나머지만 남긴다(확대는 레벨 감소)", () => {
    expect(accumulateZoom(0.7, 0.5, 5, 1, 14)).toEqual({
      fraction: expect.closeTo(0.2, 10),
      levelDelta: -1,
    });
    expect(accumulateZoom(-0.6, -0.6, 5, 1, 14)).toEqual({
      fraction: expect.closeTo(-0.2, 10),
      levelDelta: 1,
    });
    expect(accumulateZoom(0.2, 0.3, 5, 1, 14)).toEqual({
      fraction: 0.5,
      levelDelta: 0,
    });
  });

  it("레벨 끝에서는 그쪽으로 더 모으지 않는다", () => {
    expect(accumulateZoom(0, 0.4, 1, 1, 14)).toEqual({
      fraction: 0,
      levelDelta: 0,
    });
    expect(accumulateZoom(0, -0.4, 14, 1, 14)).toEqual({
      fraction: 0,
      levelDelta: 0,
    });
    expect(accumulateZoom(0, -0.4, 1, 1, 14)).toEqual({
      fraction: -0.4,
      levelDelta: 0,
    });
  });

  it("쉬면 가장 가까운 레벨로", () => {
    expect(settleZoom(0.3)).toEqual({ levelDelta: 0 });
    expect(settleZoom(0.5)).toEqual({ levelDelta: -1 });
    expect(settleZoom(-0.7)).toEqual({ levelDelta: 1 });
  });
});
