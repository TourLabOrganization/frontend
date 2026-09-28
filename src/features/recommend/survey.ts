// 테마 추천 설문 6.1: 공통 S1~S6 + S4가 정한 관심사 분기 B1~B7 중 1개 + 필요할 때만 확인 문항 F1. 순수 함수만 둔다.
// 정본: 팀 명세서 「Tour Navigator 신규 설문 통합 상세명세서」 integrated 6.2(2026-09-28) §04~§12 · §37 · §41.
// 명세서 §01이 새 유형 이름 · 점수를 기존 recommendV4(백엔드 POST /api/v1/recommend)에 넘기지 않는다고 정해서,
// 명세서의 참조 계산(score_survey.evaluate)을 프론트로 옮겼다. data-server가 6.2 API를 내면 그 API를 부르도록 바꿀 임시본이다(docs/api.md).
// 모든 문항은 한 개 고르기 · 필수이고 건너뛰기가 없다. 국내 · 해외 · 예산 · 정보 경로 · 앱 언어 가산은 없앴다(§04 · §38): 모든 응답자가 C1~C10 후보다.
// 보기 id는 주소(?a=)에 쓰는 바뀌지 않는 값이다. 화면 문구는 messages의 Recommend.questions(문항) · Clusters(유형)에 있다.

/**
 * 여행자 유형 C1~C10. 명세서에서 「유형」이다(응답자 선호를 규칙으로 나눈 것이고 자료 군집이 아니다, §18).
 * 이름 · 경험 설명 · 소개는 messages의 Clusters.<유형>(네임스페이스 이름만 예전 그대로)
 */
export const TYPE_IDS = [
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

export type TypeId = (typeof TYPE_IDS)[number];

/** 유형별 가산. 표에 없는 유형은 0점 */
export type TypeScores = Partial<Record<TypeId, number>>;

export const COMMON_IDS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;
export type CommonId = (typeof COMMON_IDS)[number];

export const BRANCH_IDS = ["b1", "b2", "b3", "b4", "b5", "b6", "b7"] as const;
export type BranchId = (typeof BRANCH_IDS)[number];

/** 확인 문항 F1 */
export const F1 = "f1";

export type QuestionId = CommonId | BranchId | typeof F1;

/** 문항 순서. 주소(?a=)에도 이 순서로 적는다 */
export const QUESTION_IDS: readonly QuestionId[] = [
  ...COMMON_IDS,
  ...BRANCH_IDS,
  F1,
];

/** 문항 수(공통 6 + 관심사 분기 1). F1은 필요할 때만 묻는 추가 문항이라 세지 않는다(§11: 보통 7개, F1이 필요하면 8개) */
export const QUESTION_COUNT = COMMON_IDS.length + 1;

/** 문항별로 고른 보기 id. 답하지 않은 문항은 키가 없다 */
export type Answers = Partial<Record<QuestionId, string>>;

// 공통 문항 점수표(명세서 §05~§06). 보기 순서는 명세서 선택지 A · B · C … 순서다.
// 보기 id는 예전 설문 Q1 · Q2 · Q3 · Q4 · Q5 · Q8의 id를 그대로 쓰고, 값도 예전 scoring.ts SCORE_TABLE의 그 행들과 같다
// (명세서 표와 한 칸씩 대조했다). S4는 이제 한 개만 고른다
const COMMON_SCORES: Readonly<
  Record<CommonId, Readonly<Record<string, TypeScores>>>
> = {
  s1: {
    teens: { C1: 1, C7: 2 },
    "20s": { C1: 2, C2: 3, C7: 1 },
    "30s": { C2: 2, C5: 1 },
    "40s": { C3: 2 },
    "50s": { C4: 1, C10: 1 },
    "60s": { C4: 2, C10: 1 },
    "70s-plus": { C4: 3, C10: 1 },
  },
  s2: {
    solo: { C1: 1, C5: 3, C7: 1, C8: 1 },
    friends: { C1: 3, C6: 1 },
    couple: { C2: 3, C10: 1 },
    spouse: { C2: 1, C4: 2, C10: 1 },
    "kids-family": { C3: 3, C9: 1 },
    parents: { C3: 1, C4: 2, C6: 1, C10: 1 },
    "social-group": { C4: 3, C6: 1 },
  },
  s3: {
    packed: { C1: 2, C7: 2 },
    moderate: { C2: 1, C3: 1, C6: 1, C8: 1 },
    relaxed: { C4: 2, C5: 3 },
  },
  s4: {
    drama: { C1: 2, C2: 1, C7: 3 },
    performance: { C1: 1, C2: 1, C7: 3 },
    history: { C3: 1, C4: 3, C10: 3 },
    nature: { C4: 2, C5: 3, C9: 2, C10: 1 },
    sea: { C2: 2, C3: 2, C9: 2 },
    "food-market": { C1: 1, C6: 3 },
    activity: { C1: 1, C3: 3, C10: 2 },
    night: { C1: 2, C2: 2 },
    "shopping-beauty": { C8: 3 },
  },
  s5: {
    trending: { C1: 3, C7: 1 },
    landmark: { C3: 1, C4: 1, C7: 1, C8: 1 },
    quiet: { C4: 1, C5: 3, C6: 1 },
  },
  s6: {
    morning: { C4: 2, C5: 1 },
    daytime: { C3: 2, C4: 1, C8: 1 },
    evening: { C1: 2, C2: 2, C7: 1 },
  },
};

/** 문항별 보기 id(점수표 순서). 표에 적은 보기 id에 숫자뿐인 키가 없어 적은 순서가 그대로 보기 순서다 */
export const COMMON_OPTIONS: Readonly<Record<CommonId, readonly string[]>> = {
  s1: Object.keys(COMMON_SCORES.s1),
  s2: Object.keys(COMMON_SCORES.s2),
  s3: Object.keys(COMMON_SCORES.s3),
  s4: Object.keys(COMMON_SCORES.s4),
  s5: Object.keys(COMMON_SCORES.s5),
  s6: Object.keys(COMMON_SCORES.s6),
};

/** S4 관심사(가장 하고 싶은 한 가지) */
export const INTERESTS = [
  "drama",
  "performance",
  "history",
  "nature",
  "sea",
  "food-market",
  "activity",
  "night",
  "shopping-beauty",
] as const;
export type Interest = (typeof INTERESTS)[number];

/** S4 관심사 → 분기 문항(명세서 §07) */
export const BRANCH_BY_INTEREST: Readonly<Record<Interest, BranchId>> = {
  drama: "b1",
  performance: "b1",
  history: "b2",
  nature: "b3",
  sea: "b3",
  "food-market": "b4",
  activity: "b5",
  night: "b6",
  "shopping-beauty": "b7",
};

/** 분기 문항 보기. a · b · c는 명세서 A · B · C, none은 D 없음 */
export const BRANCH_OPTIONS = ["a", "b", "c", "none"] as const;
export type BranchOption = (typeof BRANCH_OPTIONS)[number];

// 분기 문항 점수표(명세서 §08~§10). A · B · C는 가산 합계 4점, 없음(D)은 모든 유형 0점이다.
// 없음은 응답 완료이고 결측이 아니다. 앞 점수를 지우거나 빼지 않고, 남은 유형에 4점을 나눠 주지도 않는다(§07)
const BRANCH_SCORES: Readonly<
  Record<BranchId, Readonly<Record<BranchOption, TypeScores>>>
> = {
  b1: { a: { C7: 4 }, b: { C1: 3, C7: 1 }, c: { C2: 3, C7: 1 }, none: {} },
  b2: { a: { C4: 3, C10: 1 }, b: { C10: 4 }, c: { C3: 3, C10: 1 }, none: {} },
  b3: { a: { C5: 4 }, b: { C9: 4 }, c: { C2: 3, C9: 1 }, none: {} },
  b4: { a: { C6: 4 }, b: { C1: 3, C6: 1 }, c: { C2: 3, C6: 1 }, none: {} },
  b5: { a: { C3: 4 }, b: { C1: 4 }, c: { C10: 4 }, none: {} },
  b6: { a: { C1: 4 }, b: { C2: 4 }, c: { C5: 4 }, none: {} },
  b7: { a: { C8: 4 }, b: { C8: 3, C1: 1 }, c: { C5: 3, C8: 1 }, none: {} },
};

/** F1 「위 경험들이 비슷하게 중요해요」(명세서 BALANCED). F1에는 「없음」이 없다(§11) */
export const BALANCED = "balanced";
/** F1에서 고른 유형에 주는 점수. BALANCED면 후보 모두에 이 값을 후보 수로 나눠 준다 */
const F1_POINTS = 4;
/** 후보 경계: 최고점에서 이 점수 이내인 유형(§11 E₀ · §12 E) */
const CANDIDATE_GAP = 2;
/** BALANCED 가산(4 / 후보 수)은 소수라 차가 2를 부동소수 오차만큼 넘을 수 있다. 그만큼의 여유 */
const EPSILON = 1e-9;

/** 원장 한 줄: 문항 · 고른 보기 · 유형별 가산(명세서 §37 전체 응답 원장. 없음은 {}) */
export type LedgerEntry = {
  question: QuestionId;
  option: string;
  scores: TypeScores;
};

/** 완료된 응답의 계산 결과 */
export type SurveyResult = {
  status: "complete";
  /** S4 관심사. 테마 지수의 관심사 항과 시티투어 관심사에 쓴다 */
  interest: Interest;
  /** 유형별 원점수 s(10개). 문항별 가산을 그대로 더한 값이고 총점을 고정 총점으로 바꾸지 않는다 */
  scores: Record<TypeId, number>;
  /** 문항 순서대로의 원장 */
  ledger: LedgerEntry[];
  /** F1 후보 E₀(C 번호 순). F1을 묻지 않았으면 빈 배열 */
  f1Candidates: TypeId[];
  /** 최종 후보 E = {c : smax − s_c ≤ 2}. 점수 내림차순, 같으면 C 번호 오름차순. 1개면 단일형, 2개 이상이면 복합형(자르지 않는다) */
  types: TypeId[];
  /** 혼합 가중치 α_c = 2^((s_c − smax)/2) ÷ E 안의 합(E의 유형만). 테마 · 시티투어 추천에 쓴다 */
  alpha: Partial<Record<TypeId, number>>;
  /** 상대 가중치 R_c = 같은 식을 10개 전체로 나눈 값. α와 같은 값으로 두지 않는다(§12) */
  weights: Record<TypeId, number>;
};

/**
 * 응답 상태(명세서 §11 입력 상태 표).
 * - incomplete: 빠진 필수 문항이 있다. next = 다음에 물을 문항
 * - invalid: 비활성 분기의 B 답 · F1이 필요 없는데 F1 답 · F1 값이 후보 밖 · 모르는 보기
 * - complete: 점수 · 원장 · 유형 결과
 */
export type Evaluation =
  | { status: "incomplete"; next: QuestionId }
  | { status: "invalid" }
  | SurveyResult;

function isInterest(value: unknown): value is Interest {
  return (INTERESTS as readonly unknown[]).includes(value);
}

export function isTypeId(value: unknown): value is TypeId {
  return (TYPE_IDS as readonly unknown[]).includes(value);
}

function isBranchId(id: QuestionId): id is BranchId {
  return (BRANCH_IDS as readonly string[]).includes(id);
}

/** 이 문항이 받을 수 있는 보기인지. F1은 유형 코드 · BALANCED면 알려진 보기다(후보인지는 evaluate가 본다) */
export function isKnownOption(id: QuestionId, option: string): boolean {
  if (id === F1) return option === BALANCED || isTypeId(option);
  if (isBranchId(id))
    return (BRANCH_OPTIONS as readonly string[]).includes(option);
  return COMMON_OPTIONS[id].includes(option);
}

function sumScores(ledger: readonly LedgerEntry[]): Record<TypeId, number> {
  const totals = Object.fromEntries(TYPE_IDS.map((c) => [c, 0])) as Record<
    TypeId,
    number
  >;
  for (const entry of ledger) {
    for (const c of TYPE_IDS) totals[c] += entry.scores[c] ?? 0;
  }
  return totals;
}

/** 최고점에서 2점 이내인 유형(C 번호 순) */
function withinGap(scores: Record<TypeId, number>): TypeId[] {
  const max = Math.max(...TYPE_IDS.map((c) => scores[c]));
  return TYPE_IDS.filter((c) => max - scores[c] <= CANDIDATE_GAP + EPSILON);
}

/** S4 답의 분기 문항. S4가 없거나 모르는 값이면 null */
function activeBranch(answers: Answers): BranchId | null {
  return isInterest(answers.s4) ? BRANCH_BY_INTEREST[answers.s4] : null;
}

type Base =
  | { status: "incomplete"; next: QuestionId }
  | { status: "invalid" }
  | { status: "base"; interest: Interest; ledger: LedgerEntry[] };

/** S1~S6 + 활성 B까지 */
function scoreBase(answers: Answers): Base {
  for (const id of QUESTION_IDS) {
    const option = answers[id];
    if (option !== undefined && !isKnownOption(id, option))
      return { status: "invalid" };
  }

  const ledger: LedgerEntry[] = [];
  for (const id of COMMON_IDS) {
    const option = answers[id];
    if (option === undefined) return { status: "incomplete", next: id };
    ledger.push({ question: id, option, scores: COMMON_SCORES[id][option] });
  }

  const interest = answers.s4 as Interest;
  const branch = BRANCH_BY_INTEREST[interest];
  if (BRANCH_IDS.some((b) => b !== branch && answers[b] !== undefined))
    return { status: "invalid" };
  const option = answers[branch] as BranchOption | undefined;
  if (option === undefined) return { status: "incomplete", next: branch };
  ledger.push({
    question: branch,
    option,
    scores: BRANCH_SCORES[branch][option],
  });
  return { status: "base", interest, ledger };
}

/**
 * F1 후보 E₀ = {c : max(s⁰) − s⁰_c ≤ 2}(s⁰ = S1~S6 + 활성 B 점수). 2개 이상일 때만 F1을 한 번 묻는다(§11).
 * 보기 순서는 종이 설문처럼 C 번호 순이다(점수 순이 아니다). F1이 필요 없거나 아직 정할 수 없으면 빈 배열
 */
export function f1Candidates(answers: Answers): TypeId[] {
  const base = scoreBase(answers);
  if (base.status !== "base") return [];
  const candidates = withinGap(sumScores(base.ledger));
  return candidates.length >= 2 ? candidates : [];
}

/**
 * 문항의 보기 id(화면 순서). F1은 후보 E₀의 유형 코드(C 번호 순, 종이 설문과 같다) + 맨 끝 BALANCED.
 * F1 보기 글자는 유형 이름이 아니라 경험 설명(messages Clusters.<유형>.experience)이다
 */
export function optionsOf(id: QuestionId, answers: Answers): readonly string[] {
  if (id === F1) return [...f1Candidates(answers), BALANCED];
  if (isBranchId(id)) return BRANCH_OPTIONS;
  return COMMON_OPTIONS[id];
}

/** 지금 답으로 묻는 문항 순서: S1~S6 → 활성 B(S4를 답했을 때) → F1(필요할 때) */
export function questionPath(answers: Answers): QuestionId[] {
  const path: QuestionId[] = [...COMMON_IDS];
  const branch = activeBranch(answers);
  if (branch) path.push(branch);
  if (f1Candidates(answers).length > 0) path.push(F1);
  return path;
}

/** 응답을 계산한다(명세서 score_survey.evaluate) */
export function evaluate(answers: Answers): Evaluation {
  const base = scoreBase(answers);
  if (base.status !== "base") return base;
  const { interest } = base;
  const ledger = [...base.ledger];

  const candidates = withinGap(sumScores(ledger));
  const needsF1 = candidates.length >= 2;
  const f1 = answers[F1];
  if (!needsF1) {
    if (f1 !== undefined) return { status: "invalid" };
  } else {
    if (f1 === undefined) return { status: "incomplete", next: F1 };
    if (f1 !== BALANCED && !candidates.includes(f1 as TypeId))
      return { status: "invalid" };
    const scores: TypeScores =
      f1 === BALANCED
        ? Object.fromEntries(
            candidates.map((c) => [c, F1_POINTS / candidates.length]),
          )
        : { [f1]: F1_POINTS };
    ledger.push({ question: F1, option: f1, scores });
  }

  const scores = sumScores(ledger);
  const max = Math.max(...TYPE_IDS.map((c) => scores[c]));
  // 2점 더 높은 유형이 2배 가중치를 받는다(§12, 설계값)
  const weight = (c: TypeId) => 2 ** ((scores[c] - max) / 2);
  const order = (a: TypeId, b: TypeId) => {
    const diff = scores[b] - scores[a];
    return Math.abs(diff) > EPSILON
      ? diff
      : TYPE_IDS.indexOf(a) - TYPE_IDS.indexOf(b);
  };
  const types = withinGap(scores).sort(order);

  const inE = types.reduce((sum, c) => sum + weight(c), 0);
  const all = TYPE_IDS.reduce((sum, c) => sum + weight(c), 0);
  return {
    status: "complete",
    interest,
    scores,
    ledger,
    f1Candidates: needsF1 ? candidates : [],
    types,
    alpha: Object.fromEntries(types.map((c) => [c, weight(c) / inE])),
    weights: Object.fromEntries(
      TYPE_IDS.map((c) => [c, weight(c) / all]),
    ) as Record<TypeId, number>,
  };
}

/**
 * 답을 바꾼다(화면과 테스트가 함께 쓴다). 같은 보기를 다시 고르면 그대로다.
 * - S4를 바꾸면 B와 F1 답을 지운다(분기가 바뀐다, §07)
 * - S1~S6 · B 중 무엇이든 바꾸면 F1 답을 지운다(F1 후보 E₀가 바뀔 수 있다)
 */
export function withAnswer(
  answers: Answers,
  id: QuestionId,
  option: string,
): Answers {
  if (answers[id] === option) return answers;
  const next: Answers = { ...answers, [id]: option };
  if (id === "s4") for (const b of BRANCH_IDS) delete next[b];
  if (id !== F1) delete next[F1];
  return next;
}
