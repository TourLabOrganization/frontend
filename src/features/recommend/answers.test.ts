import { describe, expect, it } from "vitest";
import { decodeAnswers, encodeAnswers } from "./answers";
import { type Answers, evaluate } from "./survey";

const MIXED: Answers = {
  s1: "30s",
  s2: "solo",
  s3: "relaxed",
  s4: "history",
  s5: "quiet",
  s6: "morning",
  b2: "a",
  f1: "balanced",
};

describe("answers ↔ URL", () => {
  it("문항 순서대로 한 줄로 만들고, 되돌리면 같은 답이다", () => {
    const a = encodeAnswers(MIXED);
    expect(a).toBe(
      "s1.30s~s2.solo~s3.relaxed~s4.history~s5.quiet~s6.morning~b2.a~f1.balanced",
    );
    expect(decodeAnswers(a)).toEqual(MIXED);
  });

  it("문항 순서가 섞여 있어도 고정 순서로 적는다", () => {
    expect(encodeAnswers({ f1: "C4", b2: "none", s1: "20s" })).toBe(
      "s1.20s~b2.none~f1.C4",
    );
  });

  it("모르는 문항 · 보기는 버리고, 같은 문항은 첫 값만 쓴다", () => {
    expect(
      decodeAnswers("s1.30s~s1.40s~s2.alien~b9.a~b3.d~f1.C11~s3.packed~bad"),
    ).toEqual({ s1: "30s", s3: "packed" });
  });

  it("예전 15문항 형식(q1.…)은 빈 답이라 미완료다", () => {
    const old = decodeAnswers(
      "q1.60s~q2.spouse~q3.relaxed~q4.history,nature~q6.domestic~q11.1-night",
    );
    expect(old).toEqual({});
    expect(evaluate(old)).toEqual({ status: "incomplete", next: "s1" });
  });

  it("빈 값은 빈 답이다", () => {
    expect(decodeAnswers(undefined)).toEqual({});
    expect(decodeAnswers(null)).toEqual({});
    expect(decodeAnswers("")).toEqual({});
    expect(encodeAnswers({})).toBe("");
  });
});
