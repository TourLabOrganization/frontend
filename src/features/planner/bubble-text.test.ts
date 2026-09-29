import { describe, expect, it } from "vitest";
import { bubbleText } from "./bubble-text";

describe("bubbleText (도시 묶음 글자 크기)", () => {
  it("짧은 이름은 기본, 긴 이름일수록 이름 · 수 글자를 줄인다", () => {
    expect(bubbleText("서울")).toEqual({
      name: "text-[0.625rem]",
      count: "text-[0.625rem]",
    });
    expect(bubbleText("Uijeong").name).toBe("text-[0.5625rem]");
    expect(bubbleText("Pyeongchang")).toEqual({
      name: "text-[0.5rem]",
      count: "text-[0.5rem]",
    });
  });

  it("여러 단어는 가장 긴 단어로 정한다(단어 사이에서 줄을 바꾼다)", () => {
    // 「(Gangwon)」 9글자
    expect(bubbleText("Goseong (Gangwon)").name).toBe("text-[0.5rem]");
    expect(bubbleText("Paju (DMZ)").name).toBe("text-[0.625rem]");
  });
});
