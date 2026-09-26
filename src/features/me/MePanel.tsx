"use client";

import { ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { isPlanId } from "@/features/course/scenarios";
import { decodeAnswers } from "@/features/recommend/answers";
import { hasRequiredAnswers, QUESTIONS } from "@/features/recommend/questions";
import { getRecommendation } from "@/features/recommend/recommend";
import { findTheme } from "@/features/recommend/themes";
import {
  LAST_RECOMMENDATION_KEY,
  parseSavedPlans,
  SAVED_PLANS_KEY,
  samePlan,
  useLocalValue,
  writeSavedPlans,
} from "@/lib/local-store";

// ME 화면 본문. 추천받은 나의 테마(마지막 추천 결과)와 저장된 플랜을 localStorage에서 읽는다.
// 서버 렌더와 하이드레이션 중에는 저장된 값이 없는 것으로 그리고, 그 뒤 저장된 값으로 다시 그린다
export function MePanel() {
  const t = useTranslations("Me");
  const tt = useTranslations("Themes");
  const tc = useTranslations("Clusters");
  const tp = useTranslations("Course.plans");
  const locale = useLocale();

  const lastA = useLocalValue(LAST_RECOMMENDATION_KEY);
  const lastAnswers = lastA ? decodeAnswers(lastA) : null;
  const last =
    lastA && lastAnswers && hasRequiredAnswers(lastAnswers)
      ? getRecommendation(lastAnswers, locale)
      : null;
  const lastType = last?.clusters[0];
  const lastTheme = last?.themes[0] ? findTheme(last.themes[0].slug) : null;

  // 모르는 테마 · 안은 버린다(데이터가 바뀌었을 때)
  const plans = parseSavedPlans(useLocalValue(SAVED_PLANS_KEY)).flatMap((p) => {
    const theme = findTheme(p.slug);
    return theme && isPlanId(p.plan)
      ? [{ ...p, slug: theme.slug, plan: p.plan }]
      : [];
  });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <>
      <section className="px-5 pt-2" aria-labelledby="me-recommended">
        <h2 id="me-recommended" className="text-headline font-bold">
          {t("recommendedHeading")}
        </h2>
        {lastA && lastType && lastTheme ? (
          <Link
            href={`/recommend/result?a=${lastA}`}
            className="mt-4 flex items-center gap-3 rounded-card bg-surface p-5 ring-1 ring-line transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:scale-[0.99] active:bg-fill motion-reduce:transition-none"
          >
            <span className="flex flex-1 flex-col">
              <span className="text-caption font-semibold text-primary">
                {t("lastType", { type: tc(`${lastType.id}.name`) })}
              </span>
              <span className="mt-1 text-body-lg font-bold">
                {t("lastTheme", { theme: tt(`${lastTheme.slug}.name`) })}
              </span>
              <span className="mt-1 text-caption text-fg-subtle">
                {t("lastAction")}
              </span>
            </span>
            <ArrowRight size={20} className="shrink-0" aria-hidden />
          </Link>
        ) : (
          <Link
            href="/recommend"
            className="mt-4 flex items-center gap-3 rounded-card bg-fg p-5 text-white transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:scale-[0.99] motion-reduce:transition-none"
          >
            <span className="flex flex-1 flex-col">
              <span className="text-body-lg font-bold">{t("emptyTitle")}</span>
              <span className="mt-1 text-caption text-white/70">
                {t("emptyMeta", { total: QUESTIONS.length })}
              </span>
            </span>
            <ArrowRight size={20} className="shrink-0" aria-hidden />
          </Link>
        )}
      </section>

      <section className="mt-10 px-5" aria-labelledby="me-saved">
        <div className="flex items-baseline justify-between">
          <h2 id="me-saved" className="text-headline font-bold">
            {t("savedHeading")}
          </h2>
          <span className="text-caption font-semibold text-fg-subtle">
            {t("savedCount", { count: plans.length })}
          </span>
        </div>
        {plans.length === 0 ? (
          <div className="mt-4">
            <p className="text-body text-fg-muted">{t("savedEmpty")}</p>
            <ButtonLink
              href="/planner"
              variant="secondary"
              size="md"
              className="mt-4"
            >
              {t("openPlanner")}
            </ButtonLink>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {plans.map((p) => {
              const name = tt(`${p.slug}.name`);
              const planName = tp(`${p.plan}.name`);
              const href = `/themes/${p.slug}?${p.a ? `a=${p.a}&` : ""}plan=${p.plan}`;
              return (
                <li
                  key={`${p.slug}|${p.a}|${p.plan}`}
                  className="flex items-center gap-2 rounded-card ring-1 ring-line"
                >
                  <Link
                    href={href}
                    className="flex min-h-16 flex-1 flex-col justify-center rounded-card py-3 pl-4 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
                  >
                    <span className="text-body-lg font-bold">{name}</span>
                    <span className="mt-0.5 text-caption text-fg-subtle">
                      {planName} ·{" "}
                      {t("savedAt", { date: dateFormat.format(p.savedAt) })}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={t("remove", { name: `${name} ${planName}` })}
                    onClick={() =>
                      writeSavedPlans(plans.filter((q) => !samePlan(q, p)))
                    }
                    className="mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
                  >
                    <Trash2 size={20} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
