import { Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BottomBar } from "@/components/ui/BottomBar";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { decodeAnswers, encodeAnswers } from "@/features/recommend/answers";
import {
  type Answers,
  hasRequiredAnswers,
  QUESTIONS,
} from "@/features/recommend/questions";
import { getRecommendation } from "@/features/recommend/recommend";
import { ThemeCard } from "@/features/recommend/ThemeCard";
import type { RankedTheme, ThemeSlug } from "@/features/recommend/themes";

const percent = (value: number) => Math.round(value * 100);

export default async function RecommendResultPage({
  searchParams,
}: PageProps<"/recommend/result">) {
  const { a } = await searchParams;
  const answers = decodeAnswers(typeof a === "string" ? a : undefined);
  if (!hasRequiredAnswers(answers)) redirect("/recommend");

  const locale = await getLocale();
  const { clusters, mixed, themes } = getRecommendation(answers, locale);
  const t = await getTranslations("Result");
  const tc = await getTranslations("Clusters");
  const tt = await getTranslations("Themes");
  const tr = await getTranslations("Regions");

  const types = clusters.slice(0, mixed ? 2 : 1);
  const [primary] = types;

  // Q10~Q14 필터만 코스 화면으로 넘긴다
  const filterAnswers: Answers = Object.fromEntries(
    QUESTIONS.filter((q) => q.filter && answers[q.id]).map((q) => [
      q.id,
      answers[q.id],
    ]),
  );
  const filterQuery = encodeAnswers(filterAnswers);
  const themeHref = (slug: string) =>
    `/themes/${slug}${filterQuery ? `?a=${filterQuery}` : ""}`;

  // 화면의 숫자는 모두 theme-fit.json(calc2 발췌)과 계산 결과에서 나온다.
  // 적합도 순위는 calc2.py 최종 점수(fit + 관심사 가산 + 지역보정) 순위다
  function badges(theme: RankedTheme, featured: boolean): string[] {
    const { evidence } = theme;
    const fitClusters = evidence.fitClusters;
    const rank = featured
      ? mixed && fitClusters.length > 1
        ? t("fitRankMixed", { rank: evidence.rank })
        : t("fitRankType", {
            type: tc(`${fitClusters[0]}.name`),
            rank: evidence.rank,
          })
      : t("fitRank", { rank: evidence.rank });
    const list = [
      rank,
      t("categoryShare", {
        category: t(`categories.${evidence.category.id}`),
        percent: percent(evidence.category.share),
      }),
    ];
    if (evidence.night !== null) {
      list.push(t("night", { percent: percent(evidence.night) }));
    }
    return list;
  }

  const card = (theme: RankedTheme, featured: boolean) => (
    <ThemeCard
      key={theme.slug}
      href={themeHref(theme.slug)}
      name={tt(`${theme.slug as ThemeSlug}.name`)}
      regionLabel={theme.regions.map((r) => tr(r)).join(" · ")}
      badges={badges(theme, featured)}
      featured={featured}
    />
  );

  const [top, ...rest] = themes;

  return (
    <Screen>
      <TopBar />
      <main className="flex flex-1 flex-col">
        <section className="px-6 pt-2">
          <Chip tone="primary" icon={<Sparkles size={16} aria-hidden />}>
            {t("badge")}
          </Chip>
          <h1 className="mt-4 text-display font-bold">
            <span className="block">
              {mixed ? t("mixedTagline") : tc(`${primary.id}.tagline`)}
            </span>
            <span className="block text-primary">
              {types.map((c) => tc(`${c.id}.name`)).join(" · ")}
            </span>
          </h1>
          {mixed ? (
            <>
              {types.map((c) => (
                <p key={c.id} className="mt-3 text-body text-fg-muted">
                  <span className="font-semibold text-fg">
                    {tc(`${c.id}.name`)}
                  </span>{" "}
                  {tc(`${c.id}.description`)}
                </p>
              ))}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {types.map((c) => (
                  <Chip key={c.id}>
                    {t("typeShare", {
                      name: tc(`${c.id}.name`),
                      percent: percent(c.probability),
                    })}
                  </Chip>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-body text-fg-muted">
              {tc(`${primary.id}.description`)}
            </p>
          )}
        </section>

        {top && (
          <section className="mt-10 px-5" aria-labelledby="themes-heading">
            <div className="flex items-baseline justify-between">
              <h2 id="themes-heading" className="text-headline font-bold">
                {t("recommendedThemes")}
              </h2>
              <span className="text-caption text-fg-subtle">
                {t("evidenceLabel")}
              </span>
            </div>
            <div className="mt-4">{card(top, true)}</div>
            {rest.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6">
                {rest.map((theme) => card(theme, false))}
              </div>
            )}
            <p className="mt-6 text-micro text-fg-subtle">{t("source")}</p>
          </section>
        )}
      </main>
      {top && (
        <BottomBar>
          <ButtonLink href={themeHref(top.slug)} block>
            {t("compareCourses")}
          </ButtonLink>
        </BottomBar>
      )}
    </Screen>
  );
}
