import { describe, expect, it } from "vitest";
import { type BubbleBox, visibleBubbleIds } from "./bubble-overlap";

function box(
  id: string,
  count: number,
  left: number,
  top: number,
  width = 40,
  height = 40,
): BubbleBox {
  return { id, count, left, top, width, height };
}

describe("visibleBubbleIds", () => {
  it("겹치지 않으면 모두 보인다", () => {
    const ids = visibleBubbleIds([box("a", 3, 0, 0), box("b", 1, 100, 0)]);
    expect(ids).toEqual(new Set(["a", "b"]));
  });

  it("겹치면 장소가 적은 쪽을 숨긴다 (목록 순서와 무관)", () => {
    const ids = visibleBubbleIds([
      box("small", 2, 10, 10),
      box("big", 9, 0, 0),
    ]);
    expect(ids).toEqual(new Set(["big"]));
  });

  it("숨긴 묶음과만 겹치는 묶음은 보인다", () => {
    // a(10)와 b(5)가 겹치고, b와 c(1)가 겹치지만 a와 c는 떨어져 있다
    const ids = visibleBubbleIds([
      box("a", 10, 0, 0),
      box("b", 5, 30, 0),
      box("c", 1, 60, 0),
    ]);
    expect(ids).toEqual(new Set(["a", "c"]));
  });

  it("가장자리만 맞닿으면 겹친 것이 아니다", () => {
    const ids = visibleBubbleIds([box("a", 2, 0, 0), box("b", 1, 40, 0)]);
    expect(ids).toEqual(new Set(["a", "b"]));
  });

  it("빈 목록이면 빈 집합", () => {
    expect(visibleBubbleIds([])).toEqual(new Set());
  });
});
