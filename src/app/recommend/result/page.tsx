import { Database, RotateCw, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { TfiBars } from "@/components/TfiBars";
import { BottomBar } from "@/components/ui/BottomBar";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Screen } from "@/components/ui/Screen";
import { LocaleSwitch } from "@/components/ui/LocaleSwitch";
import { TopBar } from "@/components/ui/TopBar";
import {
  buildRecommendRequest,
  fetchRecommendation,
  SOURCE_KEYS,
  type ThemeCardData,
  toThemeCards,
} from "@/features/recommend/api";
import { decodeAnswers, encodeAnswers } from "@/features/recommend/answers";
import {
  type Answers,
  hasRequiredAnswers,
  QUESTIONS,
} from "@/features/recommend/questions";
import { RememberRecommendation } from "@/features/recommend/RememberRecommendation";
import { classify } from "@/features/recommend/scoring";
import { ThemeCard } from "@/features/recommend/ThemeCard";
import { findTheme } from "@/features/recommend/themes";
import { themeBackdrop } from "@/features/recommend/works";
import { datalabRegionId, getTfi, tfiBars } from "@/lib/api/datalab";

const percent = (value: number) => Math.round(value * 100);

// 추천 결과. 유형(군집) 판정은 프론트(classify)에서, 테마 순위는 백엔드 POST /api/v1/recommend 결과를 그대로 쓴다.
// 공개 API라 서버 컴포넌트에서 부른다(docs/api.md). 실패하면 테마 목록 자리에 다시 시도 링크를 둔다
export default async function RecommendResultPage({
  searchParams,
}: PageProps<"/recommend/result">) {
  const { a } = await searchParams;
  const answers = decodeAnswers(typeof a === "string" ? a : undefined);
  if (!hasRequiredAnswers(answers)) redirect("/recommend");

  const locale = await getLocale();
  const { clusters, mixed } = classify(answers, locale);
  const types = clusters.slice(0, mixed ? 2 : 1);
  const [primary] = types;

  // 두 유형이 섞인 사용자도 API는 1순위 유형 하나로 계산한다
  const request = buildRecommendRequest(answers, primary.id);
  const [result, tfi] = await Promise.all([
    fetchRecommendation(request),
    request.region ? getTfi().catch(() => null) : Promise.resolve(null),
  ]);

  const t = await getTranslations("Result");
  const tc = await getTranslations("Clusters");
  const tt = await getTranslations("Themes");
  const tr = await getTranslations("Regions");
  const tdl = await getTranslations("Datalab");
  const common = await getTranslations("Common");

  const a0 = encodeAnswers(answers);
  const cards = result.ok ? toThemeCards(result.data, request.interests) : [];
  const [top, ...rest] = cards;
  const regionApplied = result.ok && result.data.regionApplied;
  const appliedRegion = result.ok ? (result.data.region ?? "") : "";
  const regionId = datalabRegionId(appliedRegion);
  const regionLabel = regionId ? tdl(`regions.${regionId}`) : appliedRegion;
  const bars = regionApplied && tfi ? tfiBars(tfi, appliedRegion) : null;

  // Q10~Q14 필터만 코스 화면으로 넘긴다
  const filterAnswers: Answers = Object.fromEntries(
    QUESTIONS.filter((q) => q.filter && answers[q.id]).map((q) => [
      q.id,
      answers[q.id],
    ]),
  );
  const filterQuery = encodeAnswers(filterAnswers);
  const themeHref = (slug: string) =>
    `/themes/${slug}?tab=course${filterQuery ? `&a=${filterQuery}` : ""}`;

  // 순위 · 분류 비중은 추천 API 결과(순서 · share), 야경 비율은 테마 메타데이터(theme-fit.json)에서 나온다
  function badges(card: ThemeCardData, featured: boolean): string[] {
    const list = [
      featured
        ? t("fitRankType", { type: tc(`${primary.id}.name`), rank: card.rank })
        : t("fitRank", { rank: card.rank }),
    ];
    if (card.category) {
      list.push(
        t("categoryShare", {
          category: t(`categories.${card.category.id}`),
          percent: percent(card.category.share),
        }),
      );
    }
    const night = findTheme(card.slug)?.night ?? 0;
    if (request.night && night > 0) {
      list.push(t("night", { percent: percent(night) }));
    }
    return list;
  }

  const card = (item: ThemeCardData, featured: boolean) => (
    <ThemeCard
      key={item.slug}
      href={themeHref(item.slug)}
      name={tt(`${item.slug}.name`)}
      regionLabel={item.regions.map((r) => tr(r)).join(" · ")}
      badges={badges(item, featured)}
      featured={featured}
      backdrop={themeBackdrop(item.slug)}
    />
  );

  return (
    <Screen>
      <RememberRecommendation a={a0} topTheme={top?.slug ?? null} />
      <TopBar right={<LocaleSwitch />} />
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

        <section className="mt-10 px-5" aria-labelledby="themes-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="themes-heading" className="text-headline font-bold">
              {t("recommendedThemes")}
            </h2>
            {top && (
              <span className="text-caption text-fg-subtle">
                {t("evidenceLabel")}
              </span>
            )}
          </div>

          {!result.ok ? (
            <div className="mt-4 rounded-card p-5 ring-1 ring-line">
              <p role="alert" className="text-body text-fg-muted">
                {t("loadFailed")}
              </p>
              <ButtonLink
                href={`/recommend/result?a=${a0}`}
                prefetch={false}
                variant="secondary"
                size="md"
                className="mt-4"
              >
                <RotateCw size={18} aria-hidden />
                {t("retry")}
              </ButtonLink>
            </div>
          ) : (
            <>
              <p className="mt-1 text-caption text-fg-subtle">
                {t("rankBasis", { type: tc(`${primary.id}.name`) })}
              </p>

              {regionApplied ? (
                <div className="mt-4 rounded-card bg-surface p-5 ring-1 ring-line">
                  <p className="flex items-center gap-1.5 text-caption font-semibold text-primary">
                    <Database size={16} aria-hidden />
                    {t("datalabHeading", { region: regionLabel })}
                  </p>
                  <p className="mt-1 text-body text-fg-muted">
                    {t("datalabAdjusted")}
                  </p>
                  {bars && (
                    <div className="mt-4">
                      <TfiBars bars={bars} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 flex items-start gap-1.5 text-caption text-fg-muted">
                  <Database size={16} className="mt-0.5 shrink-0" aria-hidden />
                  {t("regionHint")}
                </p>
              )}

              {top && <div className="mt-6">{card(top, true)}</div>}
              {rest.length > 0 && (
                <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6">
                  {rest.map((item) => card(item, false))}
                </div>
              )}
              {result.data.sources.length > 0 && (
                <p className="mt-6 text-micro text-fg-subtle">
                  {t("sources", {
                    sources: result.data.sources
                      .map((name) =>
                        SOURCE_KEYS[name]
                          ? tdl(`sources.${SOURCE_KEYS[name]}`)
                          : name,
                      )
                      .join(" · "),
                  })}
                </p>
              )}
              <p className="mt-1 text-micro text-fg-subtle">
                {common("tmdbCredit")}
              </p>
            </>
          )}
        </section>
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
