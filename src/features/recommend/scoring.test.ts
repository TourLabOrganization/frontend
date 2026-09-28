import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ko from "../../../messages/ko.json";
import { QUESTIONS, type Answers } from "./questions";
import { classify, CLUSTER_IDS, SCORE_TABLE } from "./scoring";
import { THEMES } from "./themes";

// 문서(01_고도화_전략.md 107행)의 예시
// 60대 / 배우자 / 천천히 / 역사·유적 + 자연·숲길 / 한적한 곳 / 국내 / 7만~15만 / 아침 일찍 / 가 본 경험
const DOC_EXAMPLE: Answers = {
  q1: ["60s"],
  q2: ["spouse"],
  q3: ["relaxed"],
  q4: ["history", "nature"],
  q5: ["quiet"],
  q6: ["domestic"],
  q7: ["70k-150k"],
  q8: ["morning"],
  q9: ["been-before"],
};

describe("classify", () => {
  it("문서 예시를 재현한다: C4 15점(약 82%), C5 10점(약 15%)", () => {
    const { clusters, mixed } = classify(DOC_EXAMPLE, "ko");
    const [first, second] = clusters;

    expect(first.id).toBe("C4");
    expect(first.score).toBe(15);
    expect(Math.round(first.probability * 100)).toBe(82);
    expect(second.id).toBe("C5");
    expect(second.score).toBe(10);
    expect(Math.round(second.probability * 100)).toBe(15);
    expect(mixed).toBe(false);
  });

  it("국내 거주면 외래객 군집(C7~C10)을 뺀다", () => {
    const ids = classify(DOC_EXAMPLE, "ko").clusters.map((c) => c.id);
    expect(ids).not.toContain("C7");
    expect(ids).not.toContain("C8");
    expect(ids).not.toContain("C9");
    expect(ids).not.toContain("C10");
  });

  it("해외·영어 사용자는 C10에 해외 +2와 언어 +2를 받는다", () => {
    const answers: Answers = {
      q1: ["60s"],
      q2: ["spouse"],
      q3: ["relaxed"],
      q6: ["overseas"],
    };
    const score = (locale: string) =>
      classify(answers, locale).clusters.find((c) => c.id === "C10")?.score;

    // 표 점수: 60대 C10 1 + 배우자 C10 1 = 2
    expect(score("ko")).toBe(2 + 2);
    expect(score("en")).toBe(2 + 2 + 2);
  });

  it("앱 언어가 ko가 아니면 Q6을 답하지 않아도 해외로 본다", () => {
    const answers: Answers = { q1: ["20s"], q2: ["solo"], q3: ["packed"] };
    const ids = classify(answers, "en").clusters.map((c) => c.id);
    expect(ids).toContain("C7");
    expect(classify(answers, "ko").clusters.map((c) => c.id)).not.toContain(
      "C7",
    );
  });

  it("zh는 C7·C9 +1, ja는 C8 +1", () => {
    const answers: Answers = {
      q1: ["20s"],
      q2: ["solo"],
      q3: ["packed"],
      q6: ["overseas"],
    };
    const scores = (locale: string) =>
      Object.fromEntries(
        classify(answers, locale).clusters.map((c) => [c.id, c.score]),
      );
    const base = scores("ko");
    expect(scores("zh").C7).toBe(base.C7 + 1);
    expect(scores("zh").C9).toBe(base.C9 + 1);
    expect(scores("ja").C8).toBe(base.C8 + 1);
  });

  it("필수 문항만 답해도 계산된다", () => {
    const { clusters } = classify(
      { q1: ["40s"], q2: ["kids-family"], q3: ["moderate"] },
      "ko",
    );
    expect(clusters[0].id).toBe("C3");
    const total = clusters.reduce((a, c) => a + c.probability, 0);
    expect(total).toBeCloseTo(1);
  });

  it("1위 확률이 50% 미만이면 섞는다", () => {
    // 20대 C1 2·C2 3, 친구 C1 3, 적당히 C2 1 → C1 5, C2 4
    const { clusters, mixed } = classify(
      { q1: ["20s"], q2: ["friends"], q3: ["moderate"] },
      "ko",
    );
    expect(clusters[0].probability).toBeLessThan(0.5);
    expect(mixed).toBe(true);
  });
});

describe("데이터·문구", () => {
  it("점수표는 보기마다 10칸이고 문항에 있는 보기만 쓴다", () => {
    for (const [qid, table] of Object.entries(SCORE_TABLE)) {
      const question = QUESTIONS.find((q) => q.id === qid)!;
      for (const [option, row] of Object.entries(table)) {
        expect(question.options).toContain(option);
        expect(row).toHaveLength(CLUSTER_IDS.length);
      }
    }
  });

  it("모든 문항·보기에 ko·en 문구가 있다 (Q10~Q14는 Trip)", () => {
    for (const messages of [ko, en]) {
      const questions = {
        ...messages.Recommend.questions,
        ...messages.Trip,
      } as Record<
        string,
        { title: string; help: string; options: Record<string, string> }
      >;
      for (const q of QUESTIONS) {
        expect(questions[q.id]?.title).toBeTruthy();
        for (const option of q.options) {
          expect(questions[q.id].options[option]).toBeTruthy();
        }
      }
    }
  });

  it("모든 군집·테마에 ko·en 문구가 있다", () => {
    for (const messages of [ko, en]) {
      for (const c of CLUSTER_IDS) {
        expect(messages.Clusters[c].name).toBeTruthy();
      }
      for (const t of THEMES) {
        expect(
          (messages.Themes as unknown as Record<string, { name: string }>)[
            t.slug
          ]?.name,
        ).toBeTruthy();
      }
    }
  });
});
