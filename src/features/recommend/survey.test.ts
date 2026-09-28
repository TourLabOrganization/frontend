import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";
import zh from "../../../messages/zh.json";
import {
  type Answers,
  BALANCED,
  BRANCH_BY_INTEREST,
  BRANCH_IDS,
  BRANCH_OPTIONS,
  COMMON_IDS,
  COMMON_OPTIONS,
  evaluate,
  f1Candidates,
  type Interest,
  INTERESTS,
  optionsOf,
  questionPath,
  type SurveyResult,
  TYPE_IDS,
  withAnswer,
} from "./survey";

// 명세서 §15 · §37 예제: 30대 · 혼자 · 천천히 · 역사·유적 · 한적한 곳 · 아침 일찍부터 + B2 문화유산 산책
const COMMON: Answers = {
  s1: "30s",
  s2: "solo",
  s3: "relaxed",
  s4: "history",
  s5: "quiet",
  s6: "morning",
};
const MIXED: Answers = { ...COMMON, b2: "a", f1: "balanced" };

function complete(answers: Answers): SurveyResult {
  const result = evaluate(answers);
  if (result.status !== "complete") throw new Error(JSON.stringify(result));
  return result;
}

describe("명세서 §37 전체 응답 원장", () => {
  it("혼합 예제: 최종 원점수 · F1 후보 · E · α · R", () => {
    const result = complete(MIXED);
    expect(result.scores).toEqual({
      C1: 1,
      C2: 2,
      C3: 1,
      C4: 13,
      C5: 13,
      C6: 1,
      C7: 1,
      C8: 1,
      C9: 0,
      C10: 4,
    });
    expect(result.f1Candidates).toEqual(["C4", "C5"]);
    expect(result.types).toEqual(["C4", "C5"]);
    expect(result.alpha.C4).toBeCloseTo(0.5, 10);
    expect(result.alpha.C5).toBeCloseTo(0.5, 10);
    expect(result.weights.C4).toBeCloseTo(0.46394, 5);
    expect(result.weights.C5).toBeCloseTo(0.46394, 5);
    // R은 10개 전체, α는 E 안에서 나눈 값이라 다르다(§12)
    expect(TYPE_IDS.reduce((sum, c) => sum + result.weights[c], 0)).toBeCloseTo(
      1,
      12,
    );
    expect(result.interest).toBe("history");
  });

  it("원장은 문항 순서대로 문항 · 보기 · 가산이다", () => {
    expect(complete(MIXED).ledger).toEqual([
      { question: "s1", option: "30s", scores: { C2: 2, C5: 1 } },
      {
        question: "s2",
        option: "solo",
        scores: { C1: 1, C5: 3, C7: 1, C8: 1 },
      },
      { question: "s3", option: "relaxed", scores: { C4: 2, C5: 3 } },
      { question: "s4", option: "history", scores: { C3: 1, C4: 3, C10: 3 } },
      { question: "s5", option: "quiet", scores: { C4: 1, C5: 3, C6: 1 } },
      { question: "s6", option: "morning", scores: { C4: 2, C5: 1 } },
      { question: "b2", option: "a", scores: { C4: 3, C10: 1 } },
      { question: "f1", option: "balanced", scores: { C4: 2, C5: 2 } },
    ]);
  });

  it("B2 A까지 C4 11 · C5 11이라 F1을 묻는다", () => {
    const answers = { ...COMMON, b2: "a" };
    expect(evaluate(answers)).toEqual({ status: "incomplete", next: "f1" });
    expect(f1Candidates(answers)).toEqual(["C4", "C5"]);
  });

  it("같은 공통 응답에서 B2 없음: C4 8 · C5 11 · C10 3, F1 없이 C5 단일형", () => {
    const result = complete({ ...COMMON, b2: "none" });
    expect(result.scores.C4).toBe(8);
    expect(result.scores.C5).toBe(11);
    expect(result.scores.C10).toBe(3);
    expect(result.f1Candidates).toEqual([]);
    expect(result.types).toEqual(["C5"]);
    expect(result.alpha).toEqual({ C5: 1 });
    expect(result.ledger.at(-1)).toEqual({
      question: "b2",
      option: "none",
      scores: {},
    });
  });

  it("F1에서 유형을 고르면 그 유형만 +4 (C5 15 · C4 11, 차 4라 C5 단일형)", () => {
    const result = complete({ ...COMMON, b2: "a", f1: "C5" });
    expect(result.scores.C5).toBe(15);
    expect(result.scores.C4).toBe(11);
    expect(result.f1Candidates).toEqual(["C4", "C5"]);
    expect(result.types).toEqual(["C5"]);
    expect(result.alpha).toEqual({ C5: 1 });
  });

  it("복합형은 점수 내림차순, 같으면 C 번호 순이고 α는 2점 차에 2배다", () => {
    // 20대(C2 3) · 친구와(C1 3) · 적당히 · 바다(C2 2) · 핫플(C1 3) · 저녁(C1 2 · C2 2) · B3 동행 사진(C2 3 · C9 1)
    const answers: Answers = {
      s1: "20s",
      s2: "friends",
      s3: "moderate",
      s4: "sea",
      s5: "trending",
      s6: "evening",
      b3: "c",
    };
    // C1 2+3+3+2 = 10, C2 3+1+2+2+3 = 11 → F1 후보 C1 · C2
    expect(f1Candidates(answers)).toEqual(["C1", "C2"]);
    const result = complete({ ...answers, f1: "C1" });
    expect(result.scores.C1).toBe(14);
    expect(result.scores.C2).toBe(11);
    expect(result.types).toEqual(["C1"]);
    const balanced = complete({ ...answers, f1: "balanced" });
    expect(balanced.types).toEqual(["C2", "C1"]);
    expect(balanced.alpha.C2! / balanced.alpha.C1!).toBeCloseTo(Math.SQRT2, 10);
  });
});

describe("입력 상태 (명세서 §11)", () => {
  it("빠진 필수 문항이면 다음에 물을 문항을 돌려준다", () => {
    expect(evaluate({})).toEqual({ status: "incomplete", next: "s1" });
    expect(evaluate({ ...COMMON, s6: undefined })).toEqual({
      status: "incomplete",
      next: "s6",
    });
    expect(evaluate(COMMON)).toEqual({ status: "incomplete", next: "b2" });
  });

  it("비활성 분기의 B 답은 오류다", () => {
    expect(evaluate({ ...COMMON, b2: "a", b3: "a" })).toEqual({
      status: "invalid",
    });
    expect(evaluate({ ...COMMON, b3: "a" })).toEqual({ status: "invalid" });
  });

  it("F1이 필요 없는데 F1 답이 있으면 오류다", () => {
    expect(evaluate({ ...COMMON, b2: "none", f1: "balanced" })).toEqual({
      status: "invalid",
    });
    expect(evaluate({ ...COMMON, b2: "none", f1: "C5" })).toEqual({
      status: "invalid",
    });
  });

  it("F1 값이 후보 E₀ 밖이면 오류다", () => {
    expect(evaluate({ ...COMMON, b2: "a", f1: "C10" })).toEqual({
      status: "invalid",
    });
  });

  it("모르는 보기는 오류다", () => {
    expect(evaluate({ ...COMMON, s1: "90s" })).toEqual({ status: "invalid" });
    expect(evaluate({ ...COMMON, b2: "d" })).toEqual({ status: "invalid" });
    expect(evaluate({ ...MIXED, f1: "C11" })).toEqual({ status: "invalid" });
  });
});

describe("답 바꾸기 규칙", () => {
  it("S4를 바꾸면 B와 F1 답을 지운다", () => {
    const next = withAnswer(MIXED, "s4", "nature");
    expect(next).toEqual({ ...COMMON, s4: "nature" });
    expect(questionPath(next)).toEqual([...COMMON_IDS, "b3"]);
  });

  it("S1~S6 · B 중 무엇이든 바꾸면 F1 답을 지운다", () => {
    expect(withAnswer(MIXED, "s2", "friends")).toEqual({
      ...COMMON,
      s2: "friends",
      b2: "a",
    });
    expect(withAnswer(MIXED, "b2", "b")).toEqual({ ...COMMON, b2: "b" });
  });

  it("F1을 바꾸면 F1만 바뀌고, 같은 보기를 다시 고르면 그대로다", () => {
    expect(withAnswer(MIXED, "f1", "C4")).toEqual({ ...MIXED, f1: "C4" });
    expect(withAnswer(MIXED, "s2", "solo")).toBe(MIXED);
  });
});

describe("묻는 문항 순서", () => {
  it("S1~S6 → S4가 정한 B → F1(필요할 때만)", () => {
    expect(questionPath({})).toEqual([...COMMON_IDS]);
    expect(questionPath(COMMON)).toEqual([...COMMON_IDS, "b2"]);
    expect(questionPath({ ...COMMON, b2: "a" })).toEqual([
      ...COMMON_IDS,
      "b2",
      "f1",
    ]);
    expect(questionPath({ ...COMMON, b2: "none" })).toEqual([
      ...COMMON_IDS,
      "b2",
    ]);
  });

  it("보기: 공통은 점수표 순서, B는 a · b · c · 없음, F1은 후보(C 번호 순) + 맨 끝 BALANCED", () => {
    expect(optionsOf("s2", {})).toEqual([
      "solo",
      "friends",
      "couple",
      "spouse",
      "kids-family",
      "parents",
      "social-group",
    ]);
    expect(optionsOf("b2", COMMON)).toEqual(["a", "b", "c", "none"]);
    expect(optionsOf("f1", { ...COMMON, b2: "a" })).toEqual([
      "C4",
      "C5",
      "balanced",
    ]);
  });

  it("S4 관심사마다 분기 문항이 정해져 있다 (명세서 §07)", () => {
    expect(BRANCH_BY_INTEREST).toEqual({
      drama: "b1",
      performance: "b1",
      history: "b2",
      nature: "b3",
      sea: "b3",
      "food-market": "b4",
      activity: "b5",
      night: "b6",
      "shopping-beauty": "b7",
    });
    expect(COMMON_OPTIONS.s4).toEqual([...INTERESTS]);
  });
});

describe("전수 경로 (명세서 §41)", () => {
  it("공통+분기 47,628경로 · F1 포함 완료 141,833경로 · 최종 E 최대 9개 · C1~C10 모두 단일 결과 도달", () => {
    let branchPaths = 0;
    let completePaths = 0;
    let maxTypes = 0;
    const singles = new Set<string>();
    const combos: Answers[] = [{}];
    for (const id of COMMON_IDS) {
      const next: Answers[] = [];
      for (const partial of combos)
        for (const option of COMMON_OPTIONS[id])
          next.push({ ...partial, [id]: option });
      combos.splice(0, combos.length, ...next);
    }

    const finish = (answers: Answers, count: number) => {
      const result = complete(answers);
      completePaths++;
      // 응답 수는 F1이 없으면 7개, 있으면 8개(없음도 1개로 센다)
      expect(result.ledger).toHaveLength(count);
      maxTypes = Math.max(maxTypes, result.types.length);
      if (result.types.length === 1) singles.add(result.types[0]);
      return result;
    };

    for (const common of combos) {
      const branch = BRANCH_BY_INTEREST[common.s4 as Interest];
      for (const option of BRANCH_OPTIONS) {
        branchPaths++;
        const answers = { ...common, [branch]: option };
        const candidates = f1Candidates(answers);
        if (candidates.length === 0) {
          finish(answers, 7);
          continue;
        }
        for (const pick of candidates) finish({ ...answers, f1: pick }, 8);
        // BALANCED는 후보 모두에 같은 점수를 더하므로 최종 E는 E₀ 그대로다
        const balanced = finish({ ...answers, f1: BALANCED }, 8);
        expect([...balanced.types].sort()).toEqual([...candidates].sort());
      }
    }

    expect(branchPaths).toBe(47628);
    expect(completePaths).toBe(141833);
    expect(maxTypes).toBe(9);
    expect([...singles].sort()).toEqual([...TYPE_IDS].sort());
  }, 60_000);

  it("B의 없음은 모든 유형 0점이라 공통 문항 점수를 그대로 둔다 (D 무변경)", () => {
    for (const interest of INTERESTS) {
      const branch = BRANCH_BY_INTEREST[interest];
      const answers: Answers = { ...COMMON, s4: interest, [branch]: "none" };
      const needsF1 = f1Candidates(answers).length > 0;
      const result = complete(needsF1 ? { ...answers, f1: BALANCED } : answers);
      expect(result.ledger[6]).toEqual({
        question: branch,
        option: "none",
        scores: {},
      });
      if (!needsF1) {
        const common = result.ledger.slice(0, 6);
        for (const c of TYPE_IDS)
          expect(result.scores[c]).toBe(
            common.reduce((sum, e) => sum + (e.scores[c] ?? 0), 0),
          );
      }
    }
  });
});

describe("문구 (5개 언어)", () => {
  type QuestionCopy = { title: string; options: Record<string, string> };
  for (const [locale, messages] of Object.entries({ ko, en, zh, ja, es })) {
    it(`${locale}: 설문 문항 · 보기와 유형 문구가 모두 있다`, () => {
      const questions = messages.Recommend.questions as Record<
        string,
        QuestionCopy
      >;
      for (const id of COMMON_IDS) {
        expect(questions[id]?.title, id).toBeTruthy();
        for (const option of COMMON_OPTIONS[id])
          expect(questions[id].options[option], `${id}.${option}`).toBeTruthy();
      }
      for (const id of BRANCH_IDS) {
        expect(questions[id]?.title, id).toBeTruthy();
        for (const option of BRANCH_OPTIONS)
          expect(questions[id].options[option], `${id}.${option}`).toBeTruthy();
      }
      expect(questions.f1?.title).toBeTruthy();
      expect(questions.f1?.options[BALANCED]).toBeTruthy();

      const types = messages.Clusters as Record<string, Record<string, string>>;
      for (const c of TYPE_IDS)
        for (const key of ["name", "experience", "tagline", "description"])
          expect(types[c]?.[key], `${c}.${key}`).toBeTruthy();
    });
  }
});
