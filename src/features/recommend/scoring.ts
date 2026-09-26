import { type Answers, getResidence, type QuestionId } from "./questions";

// 군집 판정. 순수 함수만 둔다.

export const CLUSTER_IDS = [
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "C8",
  "C9",
  "C10",
] as const;

export type ClusterId = (typeof CLUSTER_IDS)[number];

/** 외래객 군집. 국내 거주자에게서는 뺀다 */
const OVERSEAS_CLUSTERS: readonly ClusterId[] = ["C7", "C8", "C9", "C10"];

type Row = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

// 응답별 점수표. 값 순서는 C1, C2, C3, C4, C5, C6, C7, C8, C9, C10.
// 출처: Tour-Navigator-App/테마 추천 알고리즘/docs/01_고도화_전략.md 46~108행
//       "응답별 점수표와 군집 판정" 표(54~99행)를 그대로 옮겼다.
// 점수표의 보기 이름이 문항표와 조금 다른 곳은 보기 id로 맞췄다
//   ("친구와"→friends, "연인과"→couple, "배우자와"→spouse, "체험·액티비티"→activity,
//    "아침 일찍부터"→morning, "낮 시간 위주"→daytime, "지인 추천 · 정보 없이"→word-of-mouth·no-info).
// Q6은 점수표가 아니라 판정 규칙(classify)으로 반영한다. Q10~Q14는 필터라 점수가 없다.
export const SCORE_TABLE: Partial<Record<QuestionId, Record<string, Row>>> = {
  q1: {
    teens: [1, 0, 0, 0, 0, 0, 2, 0, 0, 0],
    "20s": [2, 3, 0, 0, 0, 0, 1, 0, 0, 0],
    "30s": [0, 2, 0, 0, 1, 0, 0, 0, 0, 0],
    "40s": [0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
    "50s": [0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    "60s": [0, 0, 0, 2, 0, 0, 0, 0, 0, 1],
    "70s-plus": [0, 0, 0, 3, 0, 0, 0, 0, 0, 1],
  },
  q2: {
    solo: [1, 0, 0, 0, 3, 0, 1, 1, 0, 0],
    friends: [3, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    couple: [0, 3, 0, 0, 0, 0, 0, 0, 0, 1],
    spouse: [0, 1, 0, 2, 0, 0, 0, 0, 0, 1],
    "kids-family": [0, 0, 3, 0, 0, 0, 0, 0, 1, 0],
    parents: [0, 0, 1, 2, 0, 1, 0, 0, 0, 1],
    "social-group": [0, 0, 0, 3, 0, 1, 0, 0, 0, 0],
  },
  q3: {
    packed: [2, 0, 0, 0, 0, 0, 2, 0, 0, 0],
    moderate: [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    relaxed: [0, 0, 0, 2, 3, 0, 0, 0, 0, 0],
  },
  q4: {
    drama: [2, 1, 0, 0, 0, 0, 3, 0, 0, 0],
    performance: [1, 1, 0, 0, 0, 0, 3, 0, 0, 0],
    history: [0, 0, 1, 3, 0, 0, 0, 0, 0, 3],
    nature: [0, 0, 0, 2, 3, 0, 0, 0, 2, 1],
    sea: [0, 2, 2, 0, 0, 0, 0, 0, 2, 0],
    "food-market": [1, 0, 0, 0, 0, 3, 0, 0, 0, 0],
    activity: [1, 0, 3, 0, 0, 0, 0, 0, 0, 2],
    night: [2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    "shopping-beauty": [0, 0, 0, 0, 0, 0, 0, 3, 0, 0],
  },
  q5: {
    trending: [3, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    landmark: [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
    quiet: [0, 0, 0, 1, 3, 1, 0, 0, 0, 0],
  },
  q7: {
    "under-70k": [2, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    "70k-150k": [0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
    "150k-250k": [0, 1, 0, 0, 0, 2, 0, 0, 0, 0],
    "over-250k": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "usd-under-100": [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    // 문서 99행: 해외 Q7의 나머지 구간($100~300, $300~500)은 모든 군집 0점
    "usd-100-300": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "usd-300-500": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "usd-over-500": [0, 0, 0, 0, 0, 0, 0, 2, 0, 0],
  },
  q8: {
    morning: [0, 0, 0, 2, 1, 0, 0, 0, 0, 0],
    daytime: [0, 0, 2, 1, 0, 0, 0, 1, 0, 0],
    evening: [2, 2, 0, 0, 0, 0, 1, 0, 0, 0],
  },
  q9: {
    "been-before": [0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    internet: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    "social-media": [1, 1, 0, 0, 0, 0, 1, 0, 1, 0],
    "word-of-mouth": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "no-info": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
};

// 판정 규칙 가산점. 출처: 같은 문서 103~107행 "판정 규칙"
/** 해외 방문이면 C7·C8·C9·C10에 각 +2 */
const OVERSEAS_BONUS = 2;
/** 앱 언어별 가산: zh → C7 +1·C9 +1, ja → C8 +1, en·es → C10 +2 */
const LOCALE_BONUS: Record<string, Partial<Record<ClusterId, number>>> = {
  zh: { C7: 1, C9: 1 },
  ja: { C8: 1 },
  en: { C10: 2 },
  es: { C10: 2 },
};

/** 1위 확률이 이 값보다 작으면 상위 두 군집을 섞는다 */
export const MIX_THRESHOLD = 0.5;

export type ClusterResult = {
  id: ClusterId;
  score: number;
  probability: number;
};

/** 점수표만으로 군집별 합계를 낸다 (Q1~Q9, 건너뛴 문항은 0점) */
export function sumTableScores(answers: Answers): Record<ClusterId, number> {
  const totals = Object.fromEntries(CLUSTER_IDS.map((c) => [c, 0])) as Record<
    ClusterId,
    number
  >;
  for (const [questionId, table] of Object.entries(SCORE_TABLE)) {
    for (const option of answers[questionId as QuestionId] ?? []) {
      const row = table[option];
      if (!row) continue;
      CLUSTER_IDS.forEach((c, i) => (totals[c] += row[i]));
    }
  }
  return totals;
}

/**
 * 군집 판정. 합계가 높은 순으로 정렬한 군집 목록과 섞을지 여부를 돌려준다.
 *
 * - Q6이 국내면 외래객 군집(C7~C10)을 후보에서 뺀다. 해외면 C7~C10에 각 +2(C1~C6도 후보 유지).
 *   Q6에 답하지 않았으면 앱 언어가 ko일 때 국내, 아니면 해외로 본다.
 *   (문서는 "국내면 C7·C8 제외"라고 적었지만, 같은 문서의 예시 C4 82%·C5 15%는
 *   C9·C10까지 빼야 나온다. C9·C10도 외래객 군집이라 함께 뺀다.)
 * - 앱 언어 가산: zh → C7 +1·C9 +1, ja → C8 +1, en·es → C10 +2
 * - 확률 = 2^(합계÷2)를 후보 군집끼리 나눈 비율
 * - 1위 확률이 0.5 미만이면 mixed = true (상위 두 군집을 섞는다)
 */
export function classify(
  answers: Answers,
  locale: string,
): { clusters: ClusterResult[]; mixed: boolean } {
  const totals = sumTableScores(answers);
  const residence = getResidence(answers, locale);
  const bonus = LOCALE_BONUS[locale] ?? {};

  const candidates = CLUSTER_IDS.filter(
    (c) => residence === "overseas" || !OVERSEAS_CLUSTERS.includes(c),
  ).map((c) => {
    let score = totals[c] + (bonus[c] ?? 0);
    if (residence === "overseas" && OVERSEAS_CLUSTERS.includes(c)) {
      score += OVERSEAS_BONUS;
    }
    return { id: c, score };
  });

  const weights = candidates.map((c) => 2 ** (c.score / 2));
  const sum = weights.reduce((a, b) => a + b, 0);
  const clusters = candidates
    .map((c, i) => ({ ...c, probability: weights[i] / sum }))
    // 합계가 같으면 C1→C10 순서를 유지한다 (sort는 안정 정렬)
    .sort((a, b) => b.score - a.score);

  return { clusters, mixed: clusters[0].probability < MIX_THRESHOLD };
}
