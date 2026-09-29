import {
  type Answers,
  isKnownOption,
  QUESTION_IDS,
  type QuestionId,
} from "./survey";

// 설문 답을 URL 쿼리 값 한 줄로 바꾼다. 예: s1.30s~s2.solo~s3.relaxed~s4.history_nature~s5.quiet~s6.morning~b2.a~b3.none~f1.balanced
// 문항 사이는 "~", 문항 id와 보기 사이는 ".". 문항 순서는 고정(S1~S6 → B1~B7 → F1)
export function encodeAnswers(answers: Answers): string {
  return QUESTION_IDS.flatMap((id) => {
    const option = answers[id];
    return option ? [`${id}.${option}`] : [];
  }).join("~");
}

// URL 쿼리 값을 답으로 되돌린다. 모르는 문항 · 보기는 버리고, 같은 문항이 두 번 나오면 첫 값을 쓴다.
// 예전 15문항 형식(q1.20s~…, 이전 방문자의 localStorage tn.lastRecommendation에 남아 있다)은 모두 모르는 문항이라
// 빈 답이 되고, evaluate가 「미완료」로 읽는다(추천 기록 없음처럼 다룬다)
export function decodeAnswers(value: string | null | undefined): Answers {
  const answers: Answers = {};
  if (!value) return answers;

  for (const part of value.split("~")) {
    const dot = part.indexOf(".");
    if (dot < 0) continue;
    const id = part.slice(0, dot);
    const option = part.slice(dot + 1);
    if (!isQuestionId(id) || answers[id] !== undefined) continue;
    if (isKnownOption(id, option)) answers[id] = option;
  }
  return answers;
}

function isQuestionId(id: string): id is QuestionId {
  return (QUESTION_IDS as readonly string[]).includes(id);
}
