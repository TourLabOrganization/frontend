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
  INTEREST_PAIRS,
  INTERESTS,
  activeBranches,
  optionsOf,
  parseInterests,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  questionCount,
  questionPath,
  type SurveyResult,
  TYPE_IDS,
  TYPE_MAX_RAW,
  toggleInterest,
  typePercents,
  withAnswer,
} from "./survey";
import { REFERENCE_CASES } from "./data/reference-cases";

// 명세서 §15 · §37 · 설문 문항지 예제: 30대 · 혼자 · 천천히 · 역사·유적과 자연·숲길 · 한적한 곳 · 아침 일찍부터
// + B2 문화유산 산책 · B3 없음 (Data-Analytics reference_calc/demo_answers.json)
const COMMON: Answers = {
  s1: "30s",
  s2: "solo",
  s3: "relaxed",
  s4: "history_nature",
  s5: "quiet",
  s6: "morning",
};
const MIXED: Answers = { ...COMMON, b2: "a", b3: "none", f1: "balanced" };

function complete(answers: Answers): SurveyResult {
  const result = evaluate(answers);
  if (result.status !== "complete") throw new Error(JSON.stringify(result));
  return result;
}

describe("명세서 §37 전체 응답 원장 (설문 6.4, S4 두 가지 · 100점 환산)", () => {
  it("유형별 최대 원점수는 명세서 표와 같다(S4 두 관심사와 그 B 기준)", () => {
    expect(TYPE_MAX_RAW).toEqual({
      C1: 23,
      C2: 19,
      C3: 20,
      C4: 19,
      C5: 22,
      C6: 10,
      C7: 17,
      C8: 11,
      C9: 11,
      C10: 15,
    });
  });

  it("혼합 예제: 최종 점수 · F1 후보 · E · α · R", () => {
    const result = complete(MIXED);
    // 원점수 C4 13 · C5 14에 F1 균형 10점씩: C4 13/19 · C5 14/22 × 100 + 10
    expect(result.scores.C4).toBeCloseTo(78.421053, 5);
    expect(result.scores.C5).toBeCloseTo(73.636364, 5);
    expect(result.scores.C10).toBeCloseTo(33.333333, 5);
    expect(result.scores.C9).toBeCloseTo(18.181818, 5);
    expect(result.f1Candidates).toEqual(["C4", "C5"]);
    expect(result.types).toEqual(["C4", "C5"]);
    expect(result.alpha.C4).toBeCloseTo(0.568657, 5);
    expect(result.alpha.C5).toBeCloseTo(0.431343, 5);
    expect(result.weights.C4).toBeCloseTo(0.509178, 5);
    expect(result.weights.C5).toBeCloseTo(0.386226, 5);
    // R은 10개 전체, α는 E 안에서 나눈 값이라 다르다(§12)
    expect(TYPE_IDS.reduce((sum, c) => sum + result.weights[c], 0)).toBeCloseTo(
      1,
      12,
    );
    expect(result.interests).toEqual(["history", "nature"]);
  });

  it("원장은 문항 순서대로 문항 · 보기 · 원점수 · 100점 척도 기여다. S4는 두 보기 점수의 합이다", () => {
    const ledger = complete(MIXED).ledger;
    expect(ledger.map((e) => [e.question, e.option, e.scores])).toEqual([
      ["s1", "30s", { C2: 2, C5: 1 }],
      ["s2", "solo", { C1: 1, C5: 3, C7: 1, C8: 1 }],
      ["s3", "relaxed", { C4: 2, C5: 3 }],
      ["s4", "history_nature", { C3: 1, C4: 5, C5: 3, C9: 2, C10: 4 }],
      ["s5", "quiet", { C4: 1, C5: 3, C6: 1 }],
      ["s6", "morning", { C4: 2, C5: 1 }],
      ["b2", "a", { C4: 3, C10: 1 }],
      ["b3", "none", {}],
      ["f1", "balanced", { C4: 10, C5: 10 }],
    ]);
    // 원점수 1점 = 100 / 최대 원점수. F1은 처음부터 100점 척도라 그대로다
    expect(ledger[0].points.C2).toBeCloseTo(200 / 19, 10);
    expect(ledger[8].points).toEqual({ C4: 10, C5: 10 });
  });

  it("B2 A · B3 없음까지 C4 68.4 · C5 63.6(차 4.8 ≤ 12)이라 F1을 묻는다", () => {
    const answers = { ...COMMON, b2: "a", b3: "none" };
    expect(evaluate(answers)).toEqual({ status: "incomplete", next: "f1" });
    expect(f1Candidates(answers)).toEqual(["C4", "C5"]);
  });

  it("B2 없음 · B3 한적한 곳: C5 81.8 · C4 52.6 · C10 26.7, F1 없이 C5 단일형", () => {
    const result = complete({ ...COMMON, b2: "none", b3: "a" });
    expect(result.scores.C5).toBeCloseTo(81.818182, 5);
    expect(result.scores.C4).toBeCloseTo(52.631579, 5);
    expect(result.scores.C10).toBeCloseTo(26.666667, 5);
    expect(result.f1Candidates).toEqual([]);
    expect(result.types).toEqual(["C5"]);
    expect(result.alpha).toEqual({ C5: 1 });
    expect(result.ledger.at(-2)).toEqual({
      question: "b2",
      option: "none",
      scores: {},
      points: {},
    });
  });

  it("F1에서 유형을 고르면 그 유형만 +20 (C5 83.6 · C4 68.4, 차 15.2라 C5 단일형)", () => {
    const result = complete({ ...COMMON, b2: "a", b3: "none", f1: "C5" });
    expect(result.scores.C5).toBeCloseTo(83.636364, 5);
    expect(result.scores.C4).toBeCloseTo(68.421053, 5);
    expect(result.f1Candidates).toEqual(["C4", "C5"]);
    expect(result.types).toEqual(["C5"]);
    expect(result.alpha).toEqual({ C5: 1 });
  });

  it("S4 바다는 C2 +1 · C3 +1 · C9 +4다 (6.2). 두 보기는 같은 유형끼리 더한다", () => {
    const result = complete({
      ...COMMON,
      s4: "nature_sea",
      b3: "none",
      f1: "balanced",
    });
    expect(result.ledger[3]).toEqual({
      question: "s4",
      option: "nature_sea",
      scores: { C2: 1, C3: 1, C4: 2, C5: 3, C9: 6, C10: 1 },
      points: {
        C2: 100 / 19,
        C3: 100 / 20,
        C4: 200 / 19,
        C5: 300 / 22,
        C9: 600 / 11,
        C10: 100 / 15,
      },
    });
    // 자연과 바다는 같은 B3라 B 문항이 하나다
    expect(result.ledger.map((e) => e.question)).toEqual([
      ...COMMON_IDS,
      "b3",
      "f1",
    ]);
  });

  it("복합형은 점수 내림차순, 같으면 C 번호 순이고 α는 12점 차에 2배다", () => {
    // 10대 · 혼자 · 빡빡하게 · 바다와 야경 · 핫플 · 낮 시간 · B3 동행 사진 · B6 조용한 야간 산책
    const answers: Answers = {
      s1: "teens",
      s2: "solo",
      s3: "packed",
      s4: "sea_night",
      s5: "trending",
      s6: "daytime",
      b3: "c",
      b6: "c",
    };
    // C1 9/23 · C7 6/17 · C9 5/11 → 39.1 · 35.3 · 45.5, F1 후보 C1 · C7 · C9(C 번호 순)
    expect(f1Candidates(answers)).toEqual(["C1", "C7", "C9"]);
    const picked = complete({ ...answers, f1: "C7" });
    expect(picked.scores.C7).toBeCloseTo(55.294118, 5);
    expect(picked.types).toEqual(["C7", "C9"]);
    expect(picked.alpha.C7! / picked.alpha.C9!).toBeCloseTo(
      2 ** ((55.294118 - 45.454545) / 12),
      5,
    );
    expect(complete({ ...answers, f1: "C9" }).types).toEqual(["C9"]);
    const balanced = complete({ ...answers, f1: "balanced" });
    expect(balanced.types).toEqual(["C9", "C1", "C7"]);
    expect(balanced.alpha.C9! / balanced.alpha.C1!).toBeCloseTo(
      2 ** ((52.121212 - 45.797101) / 12),
      5,
    );
  });

  it("복합형 비중 칩: 같은 비중은 같은 숫자로, 합은 되도록 100에 맞춘다", () => {
    expect(typePercents(complete(MIXED))).toEqual([57, 43]);
    const balanced = complete({
      s1: "teens",
      s2: "solo",
      s3: "packed",
      s4: "sea_night",
      s5: "trending",
      s6: "daytime",
      b3: "c",
      b6: "c",
      f1: "balanced",
    });
    const percents = typePercents(balanced);
    expect(percents.reduce((a, b) => a + b, 0)).toBe(100);
    expect(percents[0]).toBeGreaterThan(percents[1]);
    expect(percents[1]).toBeGreaterThan(percents[2]);
  });
});

describe("Python 참조 계산과 같은 값 (Data-Analytics score_survey.py · recommend_reference.py)", () => {
  for (const [n, c] of REFERENCE_CASES.entries()) {
    it(`사례 ${n + 1}: 점수 · E · α`, () => {
      const result = complete(c.answers);
      for (const type of TYPE_IDS)
        expect(result.scores[type], type).toBeCloseTo(c.scores[type], 9);
      expect(result.types).toEqual(c.types);
      for (const type of c.types)
        expect(result.alpha[type], type).toBeCloseTo(c.alpha[type]!, 9);
    });
  }
});

describe("입력 상태 (명세서 §11)", () => {
  it("빠진 필수 문항이면 다음에 물을 문항을 돌려준다", () => {
    expect(evaluate({})).toEqual({ status: "incomplete", next: "s1" });
    expect(evaluate({ ...COMMON, s6: undefined })).toEqual({
      status: "incomplete",
      next: "s6",
    });
    expect(evaluate(COMMON)).toEqual({ status: "incomplete", next: "b2" });
    expect(evaluate({ ...COMMON, b2: "a" })).toEqual({
      status: "incomplete",
      next: "b3",
    });
  });

  it("S4를 하나만 골랐으면 아직 S4를 답하지 않은 것이다", () => {
    expect(evaluate({ ...COMMON, s4: "history" })).toEqual({
      status: "incomplete",
      next: "s4",
    });
    expect(questionPath({ ...COMMON, s4: "history" })).toEqual([...COMMON_IDS]);
  });

  it("S4 값은 서로 다른 관심사 두 개를 INTERESTS 순서로 적은 것만 받는다", () => {
    expect(parseInterests("history_nature")).toEqual(["history", "nature"]);
    expect(parseInterests("nature_history")).toBeNull();
    expect(parseInterests("history_history")).toBeNull();
    expect(parseInterests("history_nature_sea")).toBeNull();
    expect(parseInterests("history_mountain")).toBeNull();
    expect(evaluate({ ...COMMON, s4: "nature_history" })).toEqual({
      status: "invalid",
    });
    expect(evaluate({ ...COMMON, s4: "history_nature_sea" })).toEqual({
      status: "invalid",
    });
  });

  it("비활성 분기의 B 답은 오류다", () => {
    expect(evaluate({ ...MIXED, b4: "a" })).toEqual({ status: "invalid" });
    expect(evaluate({ ...COMMON, b6: "a" })).toEqual({ status: "invalid" });
  });

  it("F1이 필요 없는데 F1 답이 있으면 오류다", () => {
    const single = { ...COMMON, b2: "none", b3: "a" };
    expect(evaluate({ ...single, f1: "balanced" })).toEqual({
      status: "invalid",
    });
    expect(evaluate({ ...single, f1: "C5" })).toEqual({ status: "invalid" });
  });

  it("F1 값이 후보 E₀ 밖이면 오류다", () => {
    expect(evaluate({ ...MIXED, f1: "C10" })).toEqual({ status: "invalid" });
  });

  it("모르는 보기는 오류다", () => {
    expect(evaluate({ ...COMMON, s1: "90s" })).toEqual({ status: "invalid" });
    expect(evaluate({ ...COMMON, b2: "d" })).toEqual({ status: "invalid" });
    expect(evaluate({ ...MIXED, f1: "C11" })).toEqual({ status: "invalid" });
  });
});

describe("답 바꾸기 규칙", () => {
  it("S4 보기를 누르면 더하거나 빼고, 두 개면 더 더하지 않는다", () => {
    expect(toggleInterest(undefined, "nature")).toBe("nature");
    expect(toggleInterest("nature", "history")).toBe("history_nature");
    expect(toggleInterest("history_nature", "sea")).toBe("history_nature");
    expect(toggleInterest("history_nature", "history")).toBe("nature");
    expect(toggleInterest("nature", "nature")).toBeUndefined();
  });

  it("S4를 바꾸면 더 이상 묻지 않는 B 답과 F1 답을 지우고, 남는 관심사의 B 답은 둔다", () => {
    const next = withAnswer(MIXED, "s4", "history_sea");
    // B3는 바다가 이어받아 남는다
    expect(next).toEqual({ ...COMMON, s4: "history_sea", b2: "a", b3: "none" });
    const other = withAnswer(MIXED, "s4", "food-market_night");
    expect(other).toEqual({ ...COMMON, s4: "food-market_night" });
    expect(questionPath(other)).toEqual([...COMMON_IDS, "b4", "b6"]);
    // 화면에서는 하나를 빼고(고르는 중) 다른 것을 더한다: 남은 관심사의 B 답은 그 사이에도 남는다
    const partial = withAnswer(MIXED, "s4", "history");
    expect(partial).toEqual({ ...COMMON, s4: "history", b2: "a" });
    const swapped = withAnswer(
      partial,
      "s4",
      toggleInterest(partial.s4, "food-market"),
    );
    expect(swapped).toEqual({ ...COMMON, s4: "history_food-market", b2: "a" });
    expect(evaluate(swapped)).toEqual({ status: "incomplete", next: "b4" });
    expect(withAnswer(MIXED, "s4", undefined)).toEqual({
      ...COMMON,
      s4: undefined,
    });
  });

  it("S1~S6 · B 중 무엇이든 바꾸면 F1 답을 지운다", () => {
    expect(withAnswer(MIXED, "s2", "friends")).toEqual({
      ...COMMON,
      s2: "friends",
      b2: "a",
      b3: "none",
    });
    expect(withAnswer(MIXED, "b2", "b")).toEqual({
      ...COMMON,
      b2: "b",
      b3: "none",
    });
  });

  it("F1을 바꾸면 F1만 바뀌고, 같은 보기를 다시 고르면 그대로다", () => {
    expect(withAnswer(MIXED, "f1", "C4")).toEqual({ ...MIXED, f1: "C4" });
    expect(withAnswer(MIXED, "s2", "solo")).toBe(MIXED);
  });
});

describe("묻는 문항 순서", () => {
  it("S1~S6 → S4 두 관심사가 정한 B(B 번호 순, 같은 B는 한 번) → F1(필요할 때만)", () => {
    expect(questionPath({})).toEqual([...COMMON_IDS]);
    expect(questionPath(COMMON)).toEqual([...COMMON_IDS, "b2", "b3"]);
    expect(questionPath({ ...COMMON, b2: "a", b3: "none" })).toEqual([
      ...COMMON_IDS,
      "b2",
      "b3",
      "f1",
    ]);
    expect(questionPath({ ...COMMON, s4: "night_shopping-beauty" })).toEqual([
      ...COMMON_IDS,
      "b6",
      "b7",
    ]);
    expect(questionPath({ ...COMMON, s4: "drama_performance" })).toEqual([
      ...COMMON_IDS,
      "b1",
    ]);
  });

  it("진행 표시 문항 수: 공통 6 + B 1~2(S4 전에는 2)", () => {
    expect([MIN_QUESTIONS, MAX_QUESTIONS]).toEqual([7, 9]);
    expect(questionCount({})).toBe(8);
    expect(questionCount(COMMON)).toBe(8);
    expect(questionCount({ ...COMMON, s4: "nature_sea" })).toBe(7);
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
    expect(optionsOf("f1", { ...COMMON, b2: "a", b3: "none" })).toEqual([
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
    expect(INTEREST_PAIRS).toHaveLength(36);
  });
});

describe("전수 경로 (명세서 §41)", () => {
  it("S4 36조합 · 공통+분기 730,296경로 · F1 포함 완료 1,756,396경로 · 7~9문항 · C1~C10 모두 단일 결과 도달", () => {
    let branchPaths = 0;
    let completePaths = 0;
    let maxTypes = 0;
    const answerCounts = new Map<number, number>();
    const singles = new Set<string>();
    const percentSums = new Set<number>();
    const combos: Answers[] = [{}];
    for (const id of COMMON_IDS) {
      const next: Answers[] = [];
      const options =
        id === "s4"
          ? INTEREST_PAIRS.map((pair) => pair.join("_"))
          : COMMON_OPTIONS[id];
      for (const partial of combos)
        for (const option of options) next.push({ ...partial, [id]: option });
      combos.splice(0, combos.length, ...next);
    }

    const finish = (answers: Answers, count: number) => {
      const result = complete(answers);
      completePaths++;
      // 응답 수: 공통 6 + B 1~2 + F1(없음도 1개로 센다)
      expect(result.ledger.length).toBe(count);
      answerCounts.set(count, (answerCounts.get(count) ?? 0) + 1);
      maxTypes = Math.max(maxTypes, result.types.length);
      if (result.types.length === 1) singles.add(result.types[0]);
      if (result.types.length > 1) {
        // 복합형 비중 칩: 점수가 같으면 같은 숫자, 높은 유형이 더 작은 숫자로 보이지 않는다
        const percents = typePercents(result);
        result.types.slice(1).forEach((c, i) => {
          const prev = result.types[i];
          if (Math.abs(result.scores[prev] - result.scores[c]) < 1e-9)
            expect(percents[i + 1]).toBe(percents[i]);
          else expect(percents[i + 1]).toBeLessThanOrEqual(percents[i]);
        });
        percentSums.add(percents.reduce((a, b) => a + b, 0));
      }
      return result;
    };

    for (const common of combos) {
      const branches = activeBranches(common);
      const choices: Answers[] = [{}];
      for (const branch of branches) {
        const next: Answers[] = [];
        for (const partial of choices)
          for (const option of BRANCH_OPTIONS)
            next.push({ ...partial, [branch]: option });
        choices.splice(0, choices.length, ...next);
      }
      for (const choice of choices) {
        branchPaths++;
        const answers = { ...common, ...choice };
        const base = 6 + branches.length;
        const candidates = f1Candidates(answers);
        if (candidates.length === 0) {
          finish(answers, base);
          continue;
        }
        for (const pick of candidates)
          finish({ ...answers, f1: pick }, base + 1);
        // BALANCED는 후보 모두에 같은 점수를 더하므로 최종 E는 E₀ 그대로다
        const balanced = finish({ ...answers, f1: BALANCED }, base + 1);
        expect([...balanced.types].sort()).toEqual([...candidates].sort());
      }
    }

    expect(branchPaths).toBe(730296);
    expect(completePaths).toBe(1756396);
    expect([...answerCounts.keys()].sort()).toEqual([7, 8, 9]);
    expect(maxTypes).toBe(10);
    expect([...singles].sort()).toEqual([...TYPE_IDS].sort());
    // 비중 합: 같은 비중 묶음을 다 채울 수 없는 경로만 100보다 작게 남는다
    expect(Math.max(...percentSums)).toBe(100);
    expect(Math.min(...percentSums)).toBeGreaterThanOrEqual(90);
  }, 600_000);

  it("B의 없음은 모든 유형 0점이라 앞 점수를 그대로 둔다 (D 무변경)", () => {
    for (const [a, b] of INTEREST_PAIRS) {
      const s4 = `${a}_${b}`;
      const branches = activeBranches({ s4 });
      const answers: Answers = { ...COMMON, s4 };
      for (const branch of branches) answers[branch] = "none";
      const needsF1 = f1Candidates(answers).length > 0;
      const result = complete(needsF1 ? { ...answers, f1: BALANCED } : answers);
      branches.forEach((branch, i) =>
        expect(result.ledger[6 + i]).toEqual({
          question: branch,
          option: "none",
          scores: {},
          points: {},
        }),
      );
      if (!needsF1) {
        const common = result.ledger.slice(0, 6);
        for (const c of TYPE_IDS)
          expect(result.scores[c]).toBe(
            common.reduce((sum, e) => sum + (e.points[c] ?? 0), 0),
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
