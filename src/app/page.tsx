import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { BottomBar } from "@/components/ui/BottomBar";
import { ButtonLink } from "@/components/ui/Button";
import { LocaleSwitch } from "@/components/ui/LocaleSwitch";
import { Screen } from "@/components/ui/Screen";
import { themePlaceStats } from "@/features/course/places";
import { ThemeTile } from "@/features/home/ThemeTile";
import { THEMES } from "@/features/recommend/themes";
import { themePoster } from "@/features/recommend/works";
import type { AppLocale } from "@/i18n/locales";

// 홈. 테마 추천(주요 버튼)과 테마 5개로 바로 가는 타일.
// 타일의 숫자는 features/course/data/places.json에서 센 값이고, 포스터는 TMDB 이미지다(features/recommend/works.ts)
export default function HomePage() {
  const t = useTranslations("Home");
  const locale = useLocale() as AppLocale;
  const common = useTranslations("Common");
  const tt = useTranslations("Themes");
  const tr = useTranslations("Regions");

  return (
    <Screen>
      <main className="flex flex-1 flex-col">
        <div className="flex justify-end px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <LocaleSwitch />
        </div>
        <section className="px-6 pt-3">
          <p className="text-caption font-semibold tracking-[0.12em] text-primary">
            {common("brand")}
          </p>
          <h1 className="mt-3 text-display font-bold">{t("title")}</h1>
          <p className="mt-2 text-body text-fg-muted">{t("description")}</p>
        </section>

        <section className="mt-12 px-5" aria-labelledby="home-themes">
          <h2 id="home-themes" className="px-1 text-headline font-bold">
            {t("themesHeading")}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6">
            {THEMES.map((theme) => {
              const { slug } = theme;
              const stats = themePlaceStats(slug);
              return (
                <li key={slug}>
                  <ThemeTile
                    slug={slug}
                    href={`/themes/${slug}`}
                    name={tt(`${slug}.name`)}
                    regionLabel={theme.regions.map((r) => tr(r)).join(" · ")}
                    places={t("placeCount", { count: stats.places })}
                    videos={t("videoCount", { count: stats.videos })}
                    poster={themePoster(slug, locale)}
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-6 px-1 text-micro text-fg-subtle">{t("source")}</p>
          <p className="mt-1 px-1 text-micro text-fg-subtle">
            {common("tmdbCredit")}
          </p>
        </section>
      </main>
      <BottomBar>
        <ButtonLink href="/recommend" block>
          {t("cta")}
          <ArrowRight size={20} aria-hidden />
        </ButtonLink>
      </BottomBar>
    </Screen>
  );
}
