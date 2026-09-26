import {
  type Answers,
  QUESTION_BY_ID,
  QUESTION_IDS,
  type QuestionId,
} from "./questions";

// 답을 URL 쿼리 값 한 줄로 바꾼다. 예: q1.20s~q2.couple~q4.drama,night
// 문항 사이는 "~", 문항 id와 보기 사이는 ".", 보기 사이는 ","
export function encodeAnswers(answers: Answers): string {
  return QUESTION_IDS.flatMap((id) => {
    const picked = answers[id];
    return picked && picked.length > 0 ? [`${id}.${picked.join(",")}`] : [];
  }).join("~");
}

// URL 쿼리 값을 답으로 되돌린다. 모르는 문항·보기는 버리고, 개수 제한을 넘는 보기도 버린다
export function decodeAnswers(value: string | null | undefined): Answers {
  const answers: Answers = {};
  if (!value) return answers;

  for (const part of value.split("~")) {
    const dot = part.indexOf(".");
    if (dot < 0) continue;
    const id = part.slice(0, dot);
    if (!isQuestionId(id)) continue;

    const question = QUESTION_BY_ID[id];
    const limit = question.multiple ? (question.max ?? Infinity) : 1;
    const picked = [
      ...new Set(
        part
          .slice(dot + 1)
          .split(",")
          .filter((option) => question.options.includes(option)),
      ),
    ].slice(0, limit);

    if (picked.length > 0) answers[id] = picked;
  }
  return answers;
}

function isQuestionId(id: string): id is QuestionId {
  return (QUESTION_IDS as readonly string[]).includes(id);
}
