import { ArrowRight } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BottomNav } from "@/components/ui/BottomNav";
import { LocaleSwitch } from "@/components/ui/LocaleSwitch";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  buildScenario,
  type PlanId,
  tripFromAnswers,
} from "@/features/course/scenarios";
import { HeroCarousel } from "@/features/home/HeroCarousel";
import { Splash } from "@/features/home/Splash";
import { SPLASH_COOKIE } from "@/features/home/splash-cookie";
import { ThemeTile } from "@/features/home/ThemeTile";
import { decodeAnswers } from "@/features/recommend/answers";
import { QUESTIONS } from "@/features/recommend/questions";
import { HOME_THEME_ORDER } from "@/features/home/theme-order";
import { findTheme, type ThemeSlug } from "@/features/recommend/themes";
import { themePoster } from "@/features/recommend/works";
import type { AppLocale } from "@/i18n/locales";

// 추천 코스 2장. 인기 데이터가 아직 없어 고정한 조건이고, 숫자는 buildScenario로 계산한다
const SUGGESTED: readonly { slug: ThemeSlug; a: string; plan: PlanId }[] = [
  {
    slug: "rescene-route",
    a: "q11.2-nights-plus~q12.public-transit",
    plan: "classic",
  },
  { slug: "jeju-k-drama", a: "q11.1-night~q12.car", plan: "classic" },
];

// 홈. 목업 순서: 머리줄 → 위쪽 탭 → 배너 → 나의 테마 → 내 코스 고르기 → 추천 코스 → 출처 → 하단 탭.
// 첫 방문(세션 쿠키 없음)이면 로고 시작 화면을 먼저 덮는다. 서버에서 정해서 깜빡이지 않는다.
// 포스터는 TMDB 이미지(features/recommend/works.ts), 숫자는 features/course/data/places.json에서 계산한 값이다
export default async function HomePage() {
  const showSplash = !(await cookies()).has(SPLASH_COOKIE);
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Home");
  const common = await getTranslations("Common");
  const tt = await getTranslations("Themes");
  const tr = await getTranslations("Regions");
  const tc = await getTranslations("Course");
  const tq = await getTranslations("Recommend.questions");

  const questionTotal = QUESTIONS.length;
  const requiredTotal = QUESTIONS.filter((q) => q.required).length;

  const courses = SUGGESTED.map(({ slug, a, plan }) => {
    const theme = findTheme(slug)!;
    const trip = tripFromAnswers(decodeAnswers(a));
    const scenario = buildScenario(slug, plan, trip);
    const videos = scenario.days
      .flatMap((d) => d.stops)
      .filter((s) => s.place.yt).length;
    return {
      slug,
      href: `/themes/${slug}?a=${a}&plan=${plan}`,
      title: t("courseTitle", {
        region: theme.regions.map((r) => tr(r)).join(" · "),
        duration:
          trip.days === 1
            ? tc("dayTrip")
            : tc("nightsDays", { nights: trip.days - 1, days: trip.days }),
      }),
      meta: t("courseMeta", {
        places: scenario.placeCount,
        videos,
        transport: tq(`q12.options.${trip.transport}`),
      }),
    };
  });

  return (
    <Screen>
      {showSplash && <Splash />}
      <main className="flex flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between pt-[max(0.5rem,env(safe-area-inset-top))] pr-3 pl-5">
          <h1 className="text-headline font-bold tracking-tight">
            {common("brand")}
          </h1>
          <LocaleSwitch />
        </header>

        <div className="mt-2 px-5 pb-4">
          <SegmentedControl
            label={t("tabsLabel")}
            items={[
              { href: "/", label: t("tabs.myThemes"), selected: true },
              { href: "/planner", label: t("tabs.planner"), selected: false },
            ]}
          />
        </div>

        <HeroCarousel />

        <section className="mt-8 px-5" aria-labelledby="home-themes">
          <h2 id="home-themes" className="text-headline font-bold">
            {t("myThemesHeading")}
          </h2>
          <ul className="mt-4 grid grid-cols-3 gap-x-3 gap-y-5">
            {HOME_THEME_ORDER.map((slug) => (
              <li key={slug}>
                <ThemeTile
                  slug={slug}
                  href={`/themes/${slug}`}
                  name={tt(`${slug}.name`)}
                  poster={themePoster(slug, locale)}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 px-5" aria-labelledby="home-pick">
          <h2 id="home-pick" className="text-headline font-bold">
            {t("pickCourseHeading")}
          </h2>
          <Link
            href="/recommend"
            className="mt-4 flex items-center gap-3 rounded-card bg-fg p-5 text-white transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:scale-[0.99] motion-reduce:transition-none"
          >
            <span className="flex flex-1 flex-col">
              <span className="text-body-lg font-bold">
                {t("pickCourseTitle")}
              </span>
              <span className="mt-1 text-caption text-white/70">
                {t("pickCourseMeta", {
                  total: questionTotal,
                  required: requiredTotal,
                })}
              </span>
            </span>
            <ArrowRight size={20} className="shrink-0" aria-hidden />
          </Link>
        </section>

        <section className="mt-10 px-5" aria-labelledby="home-courses">
          <h2 id="home-courses" className="text-headline font-bold">
            {t("coursesHeading")}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {courses.map((c) => (
              <li key={c.slug}>
                <Link
                  href={c.href}
                  className="flex h-full flex-col rounded-card bg-surface p-4 ring-1 ring-line transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:scale-[0.99] active:bg-fill motion-reduce:transition-none"
                >
                  <span className="text-micro font-bold tracking-wide text-primary">
                    {tt(`${c.slug}.name`)}
                  </span>
                  <span className="mt-1 text-body-lg font-bold">{c.title}</span>
                  <span className="mt-1 text-caption text-fg-subtle">
                    {c.meta}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-micro text-fg-subtle">{t("source")}</p>
          <p className="mt-1 text-micro text-fg-subtle">
            {common("tmdbCredit")}
          </p>
        </section>
      </main>
      <BottomNav />
    </Screen>
  );
}
