import { Info, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BottomBar } from "@/components/ui/BottomBar";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Screen } from "@/components/ui/Screen";
import { LocaleSwitch } from "@/components/ui/LocaleSwitch";
import { TopBar } from "@/components/ui/TopBar";
import { decodeAnswers, encodeAnswers } from "@/features/recommend/answers";
import { RememberRecommendation } from "@/features/recommend/RememberRecommendation";
import { evaluate } from "@/features/recommend/survey";
import {
  featuredCategory,
  INTEREST_TERM,
  rankThemes,
  type ThemeScore,
} from "@/features/recommend/theme-index";
import { ThemeCard } from "@/features/recommend/ThemeCard";
import { findTheme } from "@/features/recommend/themes";
import { themeBackdrop } from "@/features/recommend/works";

const percent = (value: number) => Math.round(value * 100);
/** 보여 줄 추천 테마 수(명세서 §14 상위 3개) */
const TOP_THEMES = 3;
/** 복합형 제목에 이름을 모두 적는 유형 수. 넘으면 앞 2개 + 「외 n개 유형」 */
const NAMED_TYPES = 3;

// 추천 결과. 설문 6.1로 유형을 정하고(survey.ts evaluate) 추천 6.2로 테마 적합도 지수를 계산해(theme-index.ts) 네트워크 없이 보인다.
// 명세서 §01에 따라 새 유형 점수를 기존 백엔드 추천(POST /api/v1/recommend)에 넘기지 않는다.
// data-server가 6.2 API를 내면 그 API를 부르도록 바꿀 임시본이다(docs/api.md). 완료된 응답이 아니면 설문으로 돌려보낸다
export default async function RecommendResultPage({
  searchParams,
}: PageProps<"/recommend/result">) {
  const { a } = await searchParams;
  const answers = decodeAnswers(typeof a === "string" ? a : undefined);
  const result = evaluate(answers);
  if (result.status !== "complete") redirect("/recommend");

  const locale = await getLocale();
  const t = await getTranslations("Result");
  const tc = await getTranslations("Clusters");
  const tt = await getTranslations("Themes");
  const tr = await getTranslations("Regions");
  const tq = await getTranslations("Recommend.questions");
  const tcat = await getTranslations("Course.categories");
  const common = await getTranslations("Common");

  const a0 = encodeAnswers(answers);
  const { types, alpha, interest } = result;
  const [primary] = types;
  const mixed = types.length > 1;
  const names = types.map((c) => tc(`${c}.name`));
  const heading =
    names.length <= NAMED_TYPES
      ? names.join(" · ")
      : `${names.slice(0, 2).join(" · ")} ${t("moreTypes", { count: names.length - 2 })}`;

  // 관심사 항: 분류 · 야경이면 지수에 더하고, 드라마 · 공연 · 쇼핑은 자료가 없어 더하지 않는다(null)
  const term = INTEREST_TERM[interest];
  const [top, ...rest] = rankThemes(result).slice(0, TOP_THEMES);
  // 지수 · 기여는 소수 첫째 자리까지(확률 · 퍼센트로 보이지 않는다, 명세서 §15)
  const decimal = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  // 설문에 여행 조건 문항이 없어 코스 화면에 조건(?a=)을 넘기지 않는다
  const themeHref = (slug: string) => `/themes/${slug}?tab=course`;

  function badges(theme: ThemeScore): string[] {
    const type = decimal.format(theme.typePart);
    const list = [
      t("themeIndex", { value: decimal.format(theme.index) }),
      term === null
        ? t("typeOnly", { type })
        : t("typeAndInterest", {
            type,
            interest: decimal.format(theme.interestPart),
          }),
    ];
    const { category, share } = featuredCategory(theme, interest);
    list.push(
      t("categoryShare", {
        category: tcat(category),
        percent: percent(share),
      }),
    );
    if (term === "night") {
      list.push(t("night", { percent: percent(theme.night) }));
    }
    return list;
  }

  const card = (theme: ThemeScore, featured: boolean) => (
    <ThemeCard
      key={theme.slug}
      href={themeHref(theme.slug)}
      name={tt(`${theme.slug}.name`)}
      regionLabel={(findTheme(theme.slug)?.regions ?? [])
        .map((r) => tr(r))
        .join(" · ")}
      badges={badges(theme)}
      featured={featured}
      backdrop={themeBackdrop(theme.slug)}
    />
  );

  return (
    <Screen>
      <RememberRecommendation a={a0} topTheme={top.slug} />
      <TopBar right={<LocaleSwitch />} />
      <main className="flex flex-1 flex-col">
        <section className="px-6 pt-2">
          <Chip tone="primary" icon={<Sparkles size={16} aria-hidden />}>
            {t("badge")}
          </Chip>
          <h1 className="mt-4 text-display font-bold">
            <span className="block">
              {mixed
                ? t("mixedTagline", { count: types.length })
                : tc(`${primary}.tagline`)}
            </span>
            <span className="block text-primary">{heading}</span>
          </h1>
          {mixed ? (
            <>
              {types.map((c) => (
                <p key={c} className="mt-3 text-body text-fg-muted">
                  <span className="font-semibold text-fg">
                    {tc(`${c}.name`)}
                  </span>{" "}
                  {tc(`${c}.description`)}
                </p>
              ))}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {types.map((c) => (
                  <Chip key={c}>
                    {t("typeShare", {
                      name: tc(`${c}.name`),
                      percent: percent(alpha[c] ?? 0),
                    })}
                  </Chip>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-body text-fg-muted">
              {tc(`${primary}.description`)}
            </p>
          )}
        </section>

        <section className="mt-10 px-5" aria-labelledby="themes-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="themes-heading" className="text-headline font-bold">
              {t("recommendedThemes")}
            </h2>
            <span className="text-caption text-fg-subtle">
              {t("evidenceLabel")}
            </span>
          </div>
          <p className="mt-1 text-caption text-fg-subtle">{t("indexNote")}</p>
          {term === null && (
            <p className="mt-3 flex items-start gap-1.5 text-caption text-fg-muted">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
              {t("interestMissing", {
                interest: tq(`s4.options.${interest}`),
              })}
            </p>
          )}

          <div className="mt-6">{card(top, true)}</div>
          {rest.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6">
              {rest.map((theme) => card(theme, false))}
            </div>
          )}
          <p className="mt-6 text-micro text-fg-subtle">{t("basis")}</p>
          <p className="mt-1 text-micro text-fg-subtle">
            {common("tmdbCredit")}
          </p>
        </section>
      </main>
      <BottomBar>
        <ButtonLink href={themeHref(top.slug)} block>
          {t("compareCourses")}
        </ButtonLink>
      </BottomBar>
    </Screen>
  );
}
