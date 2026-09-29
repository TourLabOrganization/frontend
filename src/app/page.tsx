import { ArrowRight, Plus } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { HeaderActions } from "@/components/HeaderActions";
import { BottomNav } from "@/components/ui/BottomNav";
import { LogoMark } from "@/components/ui/LogoMark";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  buildScenario,
  type PlanId,
  tripFromAnswers,
} from "@/features/course/scenarios";
import { decodeTrip } from "@/features/course/trip";
import { CityTourSection } from "@/features/home/CityTourSection";
import { HeroCarousel } from "@/features/home/HeroCarousel";
import { PopularAttractions } from "@/features/home/PopularAttractions";
import { Splash } from "@/features/home/Splash";
import { SPLASH_COOKIE } from "@/features/home/splash-cookie";
import { ThemeTile } from "@/features/home/ThemeTile";
import { MAX_QUESTIONS, MIN_QUESTIONS } from "@/features/recommend/survey";
import { HOME_THEME_ORDER } from "@/features/home/theme-order";
import { cityName } from "@/features/planner/regions";
import type { ThemeSlug } from "@/features/recommend/themes";
import { themePoster } from "@/features/recommend/works";
import type { AppLocale } from "@/i18n/locales";
import { loadNameTable } from "@/features/names/server";
import toursData from "@/features/home/data/citytour.json";
import { cityTourText } from "@/features/translations/text";

// 지금 인기 코스 2장(목업 「UNESCO 경주 2박 3일」 · 「COAST 거제 1박 2일」). 인기 데이터가 아직 없어 목업 카드의 조건
// (기간 · 이동수단)을 고정했고, 지역 · 촬영지 수 · 광역 수단은 buildScenario로 계산한다.
// 경주 카드는 정석(경주에서 시작), 거제 카드는 거제에서 시작하는 트렌드 안이다. RESCENE 코스는 경주 · 거제를 함께 지나서
// 제목에는 코스가 지나는 도시를 모두 적는다
const POPULAR: readonly {
  key: "gyeongju" | "geoje";
  slug: ThemeSlug;
  a: string;
  plan: PlanId;
}[] = [
  {
    key: "gyeongju",
    slug: "rescene-route",
    a: "q11.2-nights-plus~q12.public-transit",
    plan: "classic",
  },
  {
    key: "geoje",
    slug: "rescene-route",
    a: "q11.1-night~q12.car",
    plan: "trend",
  },
];

// 홈. 목업 순서: 머리줄(언어 메뉴 · 검색 · 알림) → 위쪽 탭 → 배너 → 지역 시티투어 → 나의 테마(+ 테마 추가) → 내 코스 고르기
// → 지금 인기 코스 → 지금 인기 관광지(한국관광공사 방문 집중률, 키가 있을 때) → 출처 → 하단 탭.
// 첫 방문(세션 쿠키 없음)이면 로고 시작 화면을 먼저 덮는다. 서버에서 정해서 깜빡이지 않는다.
// 포스터는 TMDB 이미지(features/recommend/works.ts), 숫자는 features/course/data/places.json에서 계산한 값이다
export default async function HomePage() {
  const showSplash = !(await cookies()).has(SPLASH_COOKIE);
  const locale = (await getLocale()) as AppLocale;
  const names = await loadNameTable(locale);
  const t = await getTranslations("Home");
  const common = await getTranslations("Common");
  const tt = await getTranslations("Themes");
  const tc = await getTranslations("Course");

  const courses = POPULAR.map(({ key, slug, a, plan }) => {
    const trip = tripFromAnswers(decodeTrip(a));
    const scenario = buildScenario(slug, plan, trip);
    const stops = scenario.days.flatMap((d) => d.stops);
    const cities = [...new Set(stops.map((s) => s.place.locKo))];
    return {
      key,
      href: `/themes/${slug}?tab=course&a=${a}&plan=${plan}`,
      title: t("courseTitle", {
        region: cities.map((c) => cityName(c, locale, names)).join(" · "),
        duration:
          trip.days === 1
            ? tc("dayTrip")
            : tc("nightsDays", { nights: trip.days - 1, days: trip.days }),
      }),
      meta: t("popularMeta", {
        videos: stops.filter((s) => s.place.yt).length,
        transport: t(`access.${scenario.accessMode}`),
      }),
    };
  });

  return (
    <Screen>
      {showSplash && <Splash />}
      <main className="flex flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between pt-[max(0.5rem,env(safe-area-inset-top))] pr-3 pl-5">
          <h1 className="flex items-center gap-2 text-headline font-bold tracking-tight whitespace-nowrap">
            <LogoMark
              variant="badge"
              size={28}
              className="shrink-0 text-primary"
            />
            {common("brand")}
          </h1>
          <HeaderActions />
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

        <CityTourSection
          texts={
            locale === "ko"
              ? undefined
              : toursData.map((tour) => cityTourText(tour, locale))
          }
        />

        <section className="mt-8 px-5" aria-labelledby="home-themes">
          <h2 id="home-themes" className="text-headline font-bold">
            {t("myThemesHeading")}
          </h2>
          <ul className="mt-4 grid grid-cols-3 gap-x-3 gap-y-5">
            {HOME_THEME_ORDER.map((slug, i) => (
              <li key={slug}>
                <ThemeTile
                  slug={slug}
                  href={`/themes/${slug}`}
                  name={tt(`${slug}.name`)}
                  poster={themePoster(slug, locale)}
                  // 3열 격자의 첫 줄은 390px 첫 화면에 보인다
                  eager={i < 3}
                />
              </li>
            ))}
            <li>
              <Link
                href="/recommend"
                className="flex flex-col rounded-2xl transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-bright active:scale-[0.98] motion-reduce:transition-none"
              >
                <span
                  aria-hidden
                  className="flex aspect-[2/3] items-center justify-center rounded-2xl bg-fill text-primary"
                >
                  <Plus size={24} />
                </span>
                <span className="mt-2 text-label font-semibold">
                  {t("addTheme")}
                </span>
              </Link>
            </li>
          </ul>
        </section>

        <section className="mt-10 px-5" aria-labelledby="home-pick">
          <h2 id="home-pick" className="text-headline font-bold">
            {t("pickCourseHeading")}
          </h2>
          <Link
            href="/recommend"
            className="mt-4 flex items-center gap-3 rounded-card bg-primary p-5 text-white transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:scale-[0.99] active:bg-primary-strong motion-reduce:transition-none"
          >
            <span className="flex flex-1 flex-col">
              <span className="text-body-lg font-bold">
                {t("pickCourseTitle")}
              </span>
              <span className="mt-1 text-caption text-white">
                {t("pickCourseMeta", {
                  min: MIN_QUESTIONS,
                  max: MAX_QUESTIONS,
                })}
              </span>
            </span>
            <ArrowRight size={20} className="shrink-0" aria-hidden />
          </Link>
        </section>

        <section className="mt-10 px-5" aria-labelledby="home-courses">
          <h2 id="home-courses" className="text-headline font-bold">
            {t("popularHeading")}
          </h2>
          <ul className="-mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
            {courses.map((c) => (
              <li key={c.key} className="w-64 shrink-0 snap-start">
                <Link
                  href={c.href}
                  className="flex h-full flex-col rounded-card bg-surface p-4 ring-1 ring-line transition duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:scale-[0.99] active:bg-fill motion-reduce:transition-none"
                >
                  <span className="text-micro font-bold tracking-wide text-primary">
                    {t(`popular.${c.key}`)}
                  </span>
                  <span className="mt-1 text-body-lg font-bold">{c.title}</span>
                  <span className="mt-1 text-caption text-fg-subtle">
                    {c.meta}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <PopularAttractions />

        <section className="px-5">
          <p className="mt-6 text-micro text-fg-subtle">{t("source")}</p>
          <p className="mt-1 text-micro text-fg-subtle">
            {t("bannerPhotoCredit")}
          </p>
          <p className="mt-1 text-micro text-fg-subtle">
            {common("tmdbCredit")}
          </p>
        </section>
      </main>
      <BottomNav />
    </Screen>
  );
}
