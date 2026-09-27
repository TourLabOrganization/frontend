"use client";

import { ArrowRight, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { isPlanId } from "@/features/course/scenarios";
import { parseSettings } from "@/features/planner/course-store";
import { cityName } from "@/features/planner/regions";
import { tripDays } from "@/features/planner/dates";
import { decodeAnswers } from "@/features/recommend/answers";
import { hasRequiredAnswers, QUESTIONS } from "@/features/recommend/questions";
import { classify } from "@/features/recommend/scoring";
import { findTheme } from "@/features/recommend/themes";
import {
  LAST_RECOMMENDATION_KEY,
  LAST_TOP_THEME_KEY,
  parseLastTopTheme,
  type PlannerSavedPlan,
  parsePlannerPlans,
  parseSavedPlans,
  SAVED_PLANS_KEY,
  samePlan,
  useLocalValue,
  writePlannerPlans,
  writeSavedPlans,
} from "@/lib/local-store";

// ME 화면 본문. 나의 여행자 유형(마지막 추천 결과의 유형 · 설명 · 1위 테마)과 저장된 플랜을 localStorage에서 읽는다.
// 1위 테마는 결과 화면이 저장한 추천 API 1위(tn.lastTopTheme)를 읽기만 한다. 없으면(예전 기록 · 추천 실패) 유형만 보인다.
// 저장된 플랜은 테마 코스와 투어 플래너 코스(kind: "planner")가 한 목록에 저장한 순서대로 섞여 있다.
// 서버 렌더와 하이드레이션 중에는 저장된 값이 없는 것으로 그리고, 그 뒤 저장된 값으로 다시 그린다
export function MePanel() {
  const t = useTranslations("Me");
  const tt = useTranslations("Themes");
  const tc = useTranslations("Clusters");
  const tp = useTranslations("Course.plans");
  const td = useTranslations("Planner.course.dates");
  const tn = useTranslations("Planner");
  const locale = useLocale();

  const lastA = useLocalValue(LAST_RECOMMENDATION_KEY);
  const lastAnswers = lastA ? decodeAnswers(lastA) : null;
  const lastType =
    lastAnswers && hasRequiredAnswers(lastAnswers)
      ? classify(lastAnswers, locale).clusters[0]
      : undefined;
  const topSlug = parseLastTopTheme(useLocalValue(LAST_TOP_THEME_KEY), lastA);
  const lastTheme = topSlug ? findTheme(topSlug) : undefined;

  const raw = useLocalValue(SAVED_PLANS_KEY);
  // 모르는 테마 · 안은 버린다(데이터가 바뀌었을 때)
  const themePlans = parseSavedPlans(raw).flatMap((p) => {
    const theme = findTheme(p.slug);
    return theme && isPlanId(p.plan)
      ? [{ ...p, slug: theme.slug, plan: p.plan }]
      : [];
  });
  const plans: (
    | { kind: "theme"; plan: (typeof themePlans)[number] }
    | { kind: "planner"; plan: PlannerSavedPlan }
  )[] = [
    ...themePlans.map((plan) => ({ kind: "theme" as const, plan })),
    ...parsePlannerPlans(raw).map((plan) => ({
      kind: "planner" as const,
      plan,
    })),
  ].sort((a, b) => a.plan.savedAt - b.plan.savedAt);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <>
      <section className="px-5 pt-2" aria-labelledby="me-type">
        <h2 id="me-type" className="text-headline font-bold">
          {t("typeHeading")}
        </h2>
        {lastA && lastType ? (
          <div className="mt-4 rounded-card p-5 ring-1 ring-line">
            <p className="text-display font-bold">
              {t("typeName", { type: tc(`${lastType.id}.name`) })}
            </p>
            <p className="mt-2 text-body text-fg-muted">
              {tc(`${lastType.id}.description`)}
            </p>
            <Link
              href={`/recommend/result?a=${lastA}`}
              className="-mx-2 mt-3 flex min-h-11 items-center gap-2 rounded-xl px-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
            >
              <span className="flex flex-1 flex-col">
                {lastTheme && (
                  <span className="text-label font-semibold">
                    {t("lastTheme", { theme: tt(`${lastTheme.slug}.name`) })}
                  </span>
                )}
                <span className="text-caption text-fg-subtle">
                  {t("lastAction")}
                </span>
              </span>
              <ArrowRight size={20} className="shrink-0" aria-hidden />
            </Link>
            <ButtonLink
              href="/recommend"
              variant="secondary"
              size="md"
              block
              className="mt-3"
            >
              <RotateCcw size={20} aria-hidden />
              {t("retry")}
            </ButtonLink>
          </div>
        ) : (
          <Link
            href="/recommend"
            className="mt-4 flex items-center gap-3 rounded-card bg-primary p-5 text-white transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:scale-[0.99] active:bg-primary-strong motion-reduce:transition-none"
          >
            <span className="flex flex-1 flex-col">
              <span className="text-body-lg font-bold">{t("emptyTitle")}</span>
              <span className="mt-1 text-caption text-white">
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
          <span className="text-caption font-semibold text-fg-subtle tabular-nums">
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
            {plans.map((entry) => {
              if (entry.kind === "planner") {
                const p = entry.plan;
                const settings = parseSettings(p.settings);
                const days = tripDays(settings.startDate, settings.endDate);
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-card ring-1 ring-line"
                  >
                    <Link
                      href={`/planner?tab=course&plan=${encodeURIComponent(p.id)}`}
                      className="flex min-h-16 min-w-0 flex-1 flex-col justify-center rounded-card py-3 pl-4 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
                    >
                      <span className="text-caption font-semibold text-primary">
                        {tn("title")}
                      </span>
                      <span className="text-body-lg font-bold">{p.name}</span>
                      <span className="mt-0.5 text-caption text-fg-subtle">
                        {t("plannerMeta", {
                          city: p.city
                            ? cityName(p.city, locale)
                            : tn("nation"),
                          duration:
                            days === 1
                              ? td("dayTrip")
                              : td("nights", { nights: days - 1, days }),
                          count: p.placeIds.length,
                        })}{" "}
                        · {t("savedAt", { date: dateFormat.format(p.savedAt) })}
                      </span>
                    </Link>
                    <button
                      type="button"
                      aria-label={t("remove", { name: p.name })}
                      onClick={() =>
                        writePlannerPlans(
                          parsePlannerPlans(raw).filter((q) => q.id !== p.id),
                        )
                      }
                      className="mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
                    >
                      <Trash2 size={20} aria-hidden />
                    </button>
                  </li>
                );
              }
              const p = entry.plan;
              const name = tt(`${p.slug}.name`);
              const planName = tp(`${p.plan}.name`);
              const href = `/themes/${p.slug}?tab=course&${p.a ? `a=${p.a}&` : ""}plan=${p.plan}`;
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
                      writeSavedPlans(themePlans.filter((q) => !samePlan(q, p)))
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
