import { describe, expect, it } from "vitest";
import { decodeAnswers, encodeAnswers } from "./answers";
import type { Answers } from "./questions";

describe("answers ↔ URL", () => {
  it("답 → URL → 답 왕복이 같다", () => {
    const answers: Answers = {
      q1: ["60s"],
      q2: ["spouse"],
      q3: ["relaxed"],
      q4: ["history", "nature"],
      q6: ["overseas"],
      q7: ["usd-100-300"],
      q11: ["1-night"],
      q14: ["pet", "accessible", "indoor-rain"],
    };
    expect(decodeAnswers(encodeAnswers(answers))).toEqual(answers);
  });

  it("문항 순서대로 한 줄로 만든다", () => {
    expect(
      encodeAnswers({ q4: ["drama", "night"], q2: ["couple"], q1: ["20s"] }),
    ).toBe("q1.20s~q2.couple~q4.drama,night");
  });

  it("모르는 문항·보기는 버린다", () => {
    expect(
      decodeAnswers("q1.20s~q99.foo~q2.alien~q3.packed,unknown~bad"),
    ).toEqual({ q1: ["20s"], q3: ["packed"] });
  });

  it("개수 제한을 넘는 보기는 버린다", () => {
    expect(decodeAnswers("q1.20s,30s~q4.drama,night,sea")).toEqual({
      q1: ["20s"],
      q4: ["drama", "night"],
    });
  });

  it("빈 값은 빈 답이다", () => {
    expect(decodeAnswers(undefined)).toEqual({});
    expect(decodeAnswers("")).toEqual({});
    expect(encodeAnswers({})).toBe("");
  });
});
