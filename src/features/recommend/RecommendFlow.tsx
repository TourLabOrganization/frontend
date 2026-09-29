"use client";

import { useRouter } from "next/navigation";
import { useMessages, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { OptionItem } from "@/components/ui/OptionItem";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TopBar } from "@/components/ui/TopBar";
import { encodeAnswers } from "./answers";
import {
  type Answers,
  F1,
  isTypeId,
  optionsOf,
  QUESTION_COUNT,
  type QuestionId,
  questionPath,
  withAnswer,
} from "./survey";

type QuestionMessages = Record<
  QuestionId,
  { title: string; help?: string; options: Record<string, string> }
>;

// 설문 6.3 흐름(survey.ts): S1~S6 → S4가 정한 B → (필요하면) F1 → 결과. 한 화면에 한 문항, 모두 필수라 건너뛰기가 없다.
// 끝나면 답을 URL에 담아 결과 화면으로 간다. 앞 문항으로 돌아가 답을 바꾸면 survey.ts withAnswer 규칙대로 뒤 답을 지운다
export function RecommendFlow() {
  const router = useRouter();
  const t = useTranslations("Recommend");
  const tc = useTranslations("Clusters");
  // 문항마다 보기 키가 달라서 묶음째 꺼낸다. 빠진 문구는 survey.test.ts가 잡는다
  const messages = useMessages().Recommend.questions as QuestionMessages;

  const [current, setCurrent] = useState<QuestionId>("s1");
  const [answers, setAnswers] = useState<Answers>({});
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shownQuestion = useRef(current);

  // 문항이 바뀌면 새 질문 제목으로 초점을 옮긴다. 화면 읽기 프로그램이 새 질문부터 읽게 된다.
  // 첫 화면에서는 옮기지 않는다 (개발 모드에서 효과가 두 번 돌아도 문항이 같으면 건너뛴다)
  useEffect(() => {
    if (shownQuestion.current === current) return;
    shownQuestion.current = current;
    titleRef.current?.focus();
  }, [current]);

  const path = questionPath(answers);
  const index = path.indexOf(current);
  // B는 지금 고른 보기로 F1이 필요해지면 다음 문항이 있다
  const isLast = index === path.length - 1;
  const isF1 = current === F1;
  const copy = messages[current];
  const selected = answers[current];
  // B는 도움말이 하나(branchHelp)다
  const help = copy.help ?? t("branchHelp");
  // F1의 유형 보기는 유형 이름이 아니라 경험 설명(종이 설문과 같다). 마지막 보기는 「위 경험들이 비슷하게 중요해요」
  const label = (option: string) =>
    isF1 && isTypeId(option)
      ? tc(`${option}.experience`)
      : copy.options[option];

  function goNext() {
    if (isLast) {
      router.push(`/recommend/result?a=${encodeAnswers(answers)}`);
      return;
    }
    setCurrent(path[index + 1]);
    window.scrollTo({ top: 0 });
  }

  function back() {
    if (index > 0) setCurrent(path[index - 1]);
    // 주소로 바로 들어와 이전 기록이 없으면 사이트 밖으로 나가지 않게 홈으로 보낸다
    else if (window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <>
      <TopBar onBack={back} />
      <main className="flex flex-1 flex-col">
        <div className="px-6 pt-2">
          <ProgressBar
            value={isF1 ? QUESTION_COUNT : index + 1}
            max={QUESTION_COUNT}
            label={t("progressLabel")}
          />
          <p className="mt-6 text-label font-semibold text-primary">
            {isF1
              ? t("extraLabel")
              : t("counter", { current: index + 1, total: QUESTION_COUNT })}
          </p>
          <h1
            id={`${current}-title`}
            ref={titleRef}
            tabIndex={-1}
            className="mt-2 text-title font-bold focus:outline-none"
          >
            {copy.title}
          </h1>
          <p
            id={`${current}-help`}
            aria-live="polite"
            className="mt-2 text-label text-fg-muted"
          >
            {help}
          </p>
        </div>
        <div
          role="radiogroup"
          aria-labelledby={`${current}-title`}
          aria-describedby={`${current}-help`}
          className="mt-6 flex flex-col gap-2 px-5"
        >
          {optionsOf(current, answers).map((option) => (
            <OptionItem
              key={option}
              label={label(option)}
              selected={selected === option}
              onSelect={() =>
                setAnswers((prev) => withAnswer(prev, current, option))
              }
            />
          ))}
        </div>
      </main>
      <BottomBar>
        <Button block disabled={selected === undefined} onClick={goNext}>
          {isLast ? t("seeResult") : t("next")}
        </Button>
      </BottomBar>
    </>
  );
}
