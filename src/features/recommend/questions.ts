import { DATALAB_REGION_IDS } from "../../lib/api/datalab";

// 테마 추천 선호 문항 Q1~Q15.
// 출처: Tour-Navigator-App/테마 추천 알고리즘/docs/01_고도화_전략.md 15~45행 "테마 추천 플로우와 선호 문항"
// Q15(여행 지역)는 백엔드 추천 API의 region 입력이다. 보기는 /api/v1/tfi 의 regions (lib/api/datalab.ts DATALAB_REGIONS)
// 보기 id는 URL과 점수표에서 쓰는 바뀌지 않는 값이다. 화면 문구는 messages의 Recommend.questions에 있다.

export const QUESTION_IDS = [
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  "q7",
  "q8",
  "q9",
  "q10",
  "q11",
  "q12",
  "q13",
  "q14",
  "q15",
] as const;

export type QuestionId = (typeof QUESTION_IDS)[number];

/** 문항별로 고른 보기 id. 답하지 않은(건너뛴) 문항은 키가 없다 */
export type Answers = Partial<Record<QuestionId, string[]>>;

export type Question = {
  id: QuestionId;
  /** 여러 개 고르기 */
  multiple: boolean;
  /** 여러 개 고르기에서 최대 개수. 없으면 제한 없음 */
  max?: number;
  /** Q1~Q3만 필수. 나머지는 건너뛸 수 있다(0점) */
  required: boolean;
  /** Q10~Q14는 군집 판정이 아니라 코스를 거르는 필터. Q15는 추천 API의 지역 입력이라 필터가 아니다 */
  filter: boolean;
  /** 이 문항이 받을 수 있는 모든 보기 id */
  options: readonly string[];
};

export const Q7_DOMESTIC = [
  "under-70k",
  "70k-150k",
  "150k-250k",
  "over-250k",
] as const;

export const Q7_OVERSEAS = [
  "usd-under-100",
  "usd-100-300",
  "usd-300-500",
  "usd-over-500",
] as const;

export const QUESTIONS: readonly Question[] = [
  {
    id: "q1",
    multiple: false,
    required: true,
    filter: false,
    options: ["teens", "20s", "30s", "40s", "50s", "60s", "70s-plus"],
  },
  {
    id: "q2",
    multiple: false,
    required: true,
    filter: false,
    options: [
      "solo",
      "friends",
      "couple",
      "spouse",
      "kids-family",
      "parents",
      "social-group",
    ],
  },
  {
    id: "q3",
    multiple: false,
    required: true,
    filter: false,
    options: ["packed", "moderate", "relaxed"],
  },
  {
    id: "q4",
    multiple: true,
    max: 2,
    required: false,
    filter: false,
    options: [
      "drama",
      "performance",
      "history",
      "nature",
      "sea",
      "food-market",
      "activity",
      "night",
      "shopping-beauty",
    ],
  },
  {
    id: "q5",
    multiple: false,
    required: false,
    filter: false,
    options: ["trending", "landmark", "quiet"],
  },
  {
    id: "q6",
    multiple: false,
    required: false,
    filter: false,
    options: ["domestic", "overseas"],
  },
  {
    id: "q7",
    multiple: false,
    required: false,
    filter: false,
    options: [...Q7_DOMESTIC, ...Q7_OVERSEAS],
  },
  {
    id: "q8",
    multiple: false,
    required: false,
    filter: false,
    options: ["morning", "daytime", "evening"],
  },
  {
    id: "q9",
    multiple: false,
    required: false,
    filter: false,
    options: [
      "been-before",
      "word-of-mouth",
      "internet",
      "social-media",
      "no-info",
    ],
  },
  {
    id: "q10",
    multiple: false,
    required: false,
    filter: true,
    options: ["this-weekend", "this-month", "later"],
  },
  {
    id: "q11",
    multiple: false,
    required: false,
    filter: true,
    options: ["day-trip", "1-night", "2-nights-plus"],
  },
  {
    id: "q12",
    multiple: false,
    required: false,
    filter: true,
    options: ["car", "public-transit", "flight", "tour-bus"],
  },
  {
    id: "q13",
    multiple: false,
    required: false,
    filter: true,
    options: ["under-1h", "1-3h", "over-3h"],
  },
  {
    id: "q14",
    multiple: true,
    required: false,
    filter: true,
    options: ["pet", "accessible", "indoor-rain"],
  },
  {
    id: "q15",
    multiple: false,
    required: false,
    filter: false,
    options: DATALAB_REGION_IDS,
  },
];

export const QUESTION_BY_ID = Object.fromEntries(
  QUESTIONS.map((q) => [q.id, q]),
) as Record<QuestionId, Question>;

export type Residence = "domestic" | "overseas";

/** Q6 답. 답하지 않았으면 앱 언어가 ko일 때 국내, 아니면 해외로 본다 */
export function getResidence(answers: Answers, locale: string): Residence {
  const answered = answers.q6?.[0];
  if (answered === "domestic" || answered === "overseas") return answered;
  return locale === "ko" ? "domestic" : "overseas";
}

/** 화면에 보일 보기. Q7만 Q6 답에 따라 국내(원화)·해외(1일 USD) 구간으로 바뀐다 */
export function getVisibleOptions(
  question: Question,
  answers: Answers,
  locale: string,
): readonly string[] {
  if (question.id !== "q7") return question.options;
  return getResidence(answers, locale) === "domestic"
    ? Q7_DOMESTIC
    : Q7_OVERSEAS;
}

/** 필수 문항(Q1~Q3)에 모두 답했는지 */
export function hasRequiredAnswers(answers: Answers): boolean {
  return QUESTIONS.every(
    (q) => !q.required || (answers[q.id]?.length ?? 0) > 0,
  );
}
