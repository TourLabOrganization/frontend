import { describe, expect, it } from "vitest";
import { cardIndex, stepCard } from "./audio-cards";

describe("해설 카드 번호", () => {
  it("스크롤 양을 카드 너비로 나눠 가장 가까운 카드로", () => {
    expect(cardIndex(0, 300, 3)).toBe(0);
    expect(cardIndex(160, 300, 3)).toBe(1);
    expect(cardIndex(590, 300, 3)).toBe(2);
  });

  it("끝을 넘지 않고, 너비가 없으면 첫 카드", () => {
    expect(cardIndex(2000, 300, 3)).toBe(2);
    expect(cardIndex(-50, 300, 3)).toBe(0);
    expect(cardIndex(100, 0, 3)).toBe(0);
    expect(cardIndex(100, 300, 0)).toBe(0);
  });

  it("이전 · 다음은 끝에서 멈춘다", () => {
    expect(stepCard(0, 1, 3)).toBe(1);
    expect(stepCard(2, 1, 3)).toBe(2);
    expect(stepCard(0, -1, 3)).toBe(0);
    expect(stepCard(2, -1, 3)).toBe(1);
  });
});
