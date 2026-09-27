"use client";

import { useRouter } from "next/navigation";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { OptionItem } from "@/components/ui/OptionItem";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TopBar } from "@/components/ui/TopBar";
import { encodeAnswers } from "./answers";
import {
  type Answers,
  getResidence,
  getVisibleOptions,
  QUESTION_BY_ID,
  QUESTIONS,
  type QuestionId,
} from "./questions";

type QuestionMessages = Record<
  QuestionId,
  {
    title: string;
    help: string;
    helpOverseas?: string;
    options: Record<string, string>;
  }
>;

/** 앱 언어가 ko가 아니면 Q6을 해외로 미리 골라 둔다 (문서 판정 규칙) */
function initialAnswers(locale: string): Answers {
  return locale === "ko" ? {} : { q6: ["overseas"] };
}

// 선호 문항 흐름. 한 화면에 한 문항을 보이고, 끝나면 답을 URL에 담아 결과 화면으로 간다
export function RecommendFlow() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Recommend");
  const common = useTranslations("Common");
  // 보기 문구는 문항마다 키가 달라서 묶음째 꺼낸다. 빠진 문구는 scoring.test.ts가 잡는다
  const messages = useMessages().Recommend.questions as QuestionMessages;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(() => initialAnswers(locale));
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);

  // 문항이 바뀌면 새 질문 제목으로 초점을 옮긴다. 화면 읽기 프로그램이 새 질문부터 읽게 된다.
  // 첫 화면에서는 옮기지 않는다 (개발 모드에서 효과가 두 번 돌아도 번호가 같으면 건너뛴다)
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    titleRef.current?.focus();
  }, [step]);

  const question = QUESTIONS[step];
  const copy = messages[question.id];
  const selected = answers[question.id] ?? [];
  const options = getVisibleOptions(question, answers, locale);
  const isLast = step === QUESTIONS.length - 1;
  const atLimit = question.max !== undefined && selected.length >= question.max;

  const help =
    question.id === "q7" &&
    getResidence(answers, locale) === "overseas" &&
    copy.helpOverseas
      ? copy.helpOverseas
      : atLimit
        ? t("limitReached")
        : copy.help;

  function goNext(next: Answers) {
    if (isLast) {
      router.push(`/recommend/result?a=${encodeAnswers(next)}`);
      return;
    }
    setStep(step + 1);
    window.scrollTo({ top: 0 });
  }

  function select(option: string) {
    setAnswers((prev) => {
      const current = prev[question.id] ?? [];
      let picked: string[];
      if (!question.multiple) {
        picked = [option];
      } else if (current.includes(option)) {
        picked = current.filter((o) => o !== option);
      } else if (question.max !== undefined && current.length >= question.max) {
        return prev; // 최대 개수를 채웠으면 더 고르지 않는다
      } else {
        picked = [...current, option];
      }

      const next: Answers = { ...prev, [question.id]: picked };
      if (picked.length === 0) delete next[question.id];
      // Q6이 바뀌면 Q7 보기 구간(원화·USD)이 바뀌므로, 맞지 않는 Q7 답은 지운다
      if (question.id === "q6" && next.q7) {
        const valid = getVisibleOptions(QUESTION_BY_ID.q7, next, locale);
        if (!next.q7.every((o) => valid.includes(o))) delete next.q7;
      }
      return next;
    });
  }

  function skip() {
    const next = { ...answers };
    delete next[question.id];
    setAnswers(next);
    goNext(next);
  }

  function back() {
    if (step > 0) setStep(step - 1);
    // 주소로 바로 들어와 이전 기록이 없으면 사이트 밖으로 나가지 않게 홈으로 보낸다
    else if (window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <>
      <TopBar
        onBack={back}
        right={
          question.required ? undefined : (
            <button
              type="button"
              onClick={skip}
              className="min-h-11 rounded-xl px-3 text-label text-fg-subtle transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill"
            >
              {common("skip")}
            </button>
          )
        }
      />
      <main className="flex flex-1 flex-col">
        <div className="px-6 pt-2">
          <ProgressBar
            value={step + 1}
            max={QUESTIONS.length}
            label={t("progressLabel")}
          />
          <p className="mt-6 text-label font-semibold text-primary">
            {t("counter", { current: step + 1, total: QUESTIONS.length })}
          </p>
          <h1
            id={`${question.id}-title`}
            ref={titleRef}
            tabIndex={-1}
            className="mt-2 text-title font-bold focus:outline-none"
          >
            {copy.title}
          </h1>
          <p
            id={`${question.id}-help`}
            aria-live="polite"
            className="mt-2 text-label text-fg-muted"
          >
            {help}
          </p>
        </div>
        <div
          role={question.multiple ? "group" : "radiogroup"}
          aria-labelledby={`${question.id}-title`}
          aria-describedby={`${question.id}-help`}
          className="mt-6 flex flex-col gap-2 px-5"
        >
          {options.map((option) => (
            <OptionItem
              key={option}
              label={copy.options[option]}
              multiple={question.multiple}
              selected={selected.includes(option)}
              onSelect={() => select(option)}
            />
          ))}
        </div>
      </main>
      <BottomBar>
        <Button
          block
          disabled={question.required && selected.length === 0}
          onClick={() => goNext(answers)}
        >
          {isLast ? t("seeResult") : t("next")}
        </Button>
      </BottomBar>
    </>
  );
}
