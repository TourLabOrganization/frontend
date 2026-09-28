// 테마 코스 탭의 여행 조건(예전 테마 추천 설문의 Q10~Q14): 출발 시기 · 일정 · 이동수단 · 하루 걷기 · 필요한 조건.
// 주소 ?a= 형식은 예전 설문 답과 같다(q11.1-night~q12.car). 홈 「지금 인기 코스」 · 저장한 코스 링크가 이 형식을 쓴다.
// 보기 id는 주소에서 쓰는 바뀌지 않는 값이다. 화면 문구는 messages의 Trip에 있다.
// 조건이 코스에 어떻게 반영되는지는 scenarios.ts의 tripFromAnswers에 있다.

export const TRIP_QUESTION_IDS = ["q10", "q11", "q12", "q13", "q14"] as const;

export type TripQuestionId = (typeof TRIP_QUESTION_IDS)[number];

/** 조건별로 고른 보기 id. 고르지 않은 조건은 키가 없다 */
export type TripAnswers = Partial<Record<TripQuestionId, string[]>>;

export type TripQuestion = {
  id: TripQuestionId;
  /** 여러 개 고르기(Q14 필요한 조건) */
  multiple: boolean;
  /** 이 조건이 받을 수 있는 모든 보기 id */
  options: readonly string[];
};

export const TRIP_QUESTIONS: readonly TripQuestion[] = [
  {
    id: "q10",
    multiple: false,
    options: ["this-weekend", "this-month", "later"],
  },
  {
    id: "q11",
    multiple: false,
    options: ["day-trip", "1-night", "2-nights-plus"],
  },
  {
    id: "q12",
    multiple: false,
    options: ["car", "public-transit", "flight", "tour-bus"],
  },
  {
    id: "q13",
    multiple: false,
    options: ["under-1h", "1-3h", "over-3h"],
  },
  {
    id: "q14",
    multiple: true,
    options: ["pet", "accessible", "indoor-rain"],
  },
];

const TRIP_QUESTION_BY_ID = Object.fromEntries(
  TRIP_QUESTIONS.map((q) => [q.id, q]),
) as Record<TripQuestionId, TripQuestion>;

// 조건을 URL 쿼리 값 한 줄로 바꾼다. 예: q11.1-night~q12.car~q14.pet,accessible
// 조건 사이는 "~", 조건 id와 보기 사이는 ".", 보기 사이는 ","
export function encodeTrip(answers: TripAnswers): string {
  return TRIP_QUESTION_IDS.flatMap((id) => {
    const picked = answers[id];
    return picked && picked.length > 0 ? [`${id}.${picked.join(",")}`] : [];
  }).join("~");
}

// URL 쿼리 값을 조건으로 되돌린다. 모르는 조건 · 보기는 버리고, 하나만 고르는 조건의 두 번째 보기부터도 버린다
export function decodeTrip(value: string | null | undefined): TripAnswers {
  const answers: TripAnswers = {};
  if (!value) return answers;

  for (const part of value.split("~")) {
    const dot = part.indexOf(".");
    if (dot < 0) continue;
    const id = part.slice(0, dot);
    if (!isTripQuestionId(id)) continue;

    const question = TRIP_QUESTION_BY_ID[id];
    const picked = [
      ...new Set(
        part
          .slice(dot + 1)
          .split(",")
          .filter((option) => question.options.includes(option)),
      ),
    ].slice(0, question.multiple ? Infinity : 1);

    if (picked.length > 0) answers[id] = picked;
  }
  return answers;
}

function isTripQuestionId(id: string): id is TripQuestionId {
  return (TRIP_QUESTION_IDS as readonly string[]).includes(id);
}
