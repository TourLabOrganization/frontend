import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ko from "../../../messages/ko.json";
import { QUESTIONS, type Answers } from "./questions";
import { getRecommendation } from "./recommend";
import { classify, CLUSTER_IDS, SCORE_TABLE } from "./scoring";
import {
  CATEGORY_IDS,
  profileFromAnswers,
  rankThemes,
  themeScore,
  THEMES,
} from "./themes";

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

describe("rankThemes", () => {
  it("문서 예시는 C4 기준 최종 점수 순서로 테마를 매긴다", () => {
    const { themes } = getRecommendation(DOC_EXAMPLE, "ko");
    const profile = profileFromAnswers(DOC_EXAMPLE);
    const expected = [...THEMES]
      .sort(
        (a, b) =>
          themeScore(b, "C4", profile).total -
          themeScore(a, "C4", profile).total,
      )
      .map((t) => t.slug);
    expect(themes.map((t) => t.slug)).toEqual(expected);
    expect(themes[0].evidence.fitClusters).toEqual(["C4"]);
    expect(themes[0].evidence.rank).toBe(1);
  });

  it("섞을 때는 두 군집의 최종 점수를 확률로 가중 평균한다", () => {
    const clusters = [
      { id: "C1" as const, score: 2, probability: 0.4 },
      { id: "C2" as const, score: 1, probability: 0.4 },
    ];
    const profile = { interests: [], night: false, ageIndex: null };
    const ranked = rankThemes(clusters, true, THEMES, profile);
    for (const t of ranked) {
      const theme = THEMES.find((s) => s.slug === t.slug)!;
      expect(t.score).toBeCloseTo((theme.fit.C1 + theme.fit.C2) / 2, 10);
    }
    expect(ranked[0].evidence.fitClusters).toEqual(["C1", "C2"]);
  });

  it("관심사에 맞는 분류가 있으면 그 분류 구성비를 근거로 보인다", () => {
    const { themes } = getRecommendation(DOC_EXAMPLE, "ko");
    for (const t of themes) {
      const source = THEMES.find((s) => s.slug === t.slug)!;
      // 역사(0) · 자연(1) 중 이 테마 구성비가 더 큰 쪽
      const best = source.share[1] > source.share[0] ? 1 : 0;
      expect(t.evidence.category).toEqual({
        id: CATEGORY_IDS[best],
        share: source.share[best],
        matched: true,
      });
    }
  });

  it("야경 배지는 야경을 고른 사람에게만, 야경 장소가 있는 테마에 붙는다", () => {
    for (const t of getRecommendation(DOC_EXAMPLE, "ko").themes)
      expect(t.evidence.night).toBeNull();

    const nightLover = { ...DOC_EXAMPLE, q4: ["history", "night"] };
    for (const t of getRecommendation(nightLover, "ko").themes) {
      const source = THEMES.find((s) => s.slug === t.slug)!;
      expect(t.evidence.night).toBe(source.night > 0 ? source.night : null);
    }
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

  it("모든 문항·보기에 ko·en 문구가 있다", () => {
    for (const messages of [ko, en]) {
      const questions = messages.Recommend.questions as Record<
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
