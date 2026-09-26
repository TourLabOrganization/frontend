import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { BottomBar } from "@/components/ui/BottomBar";
import { ButtonLink } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { themePlaceStats } from "@/features/course/places";
import { ThemeTile } from "@/features/home/ThemeTile";
import { THEMES, type ThemeSlug } from "@/features/recommend/themes";

// 홈. 테마 추천(주요 버튼)과 테마 5개로 바로 가는 타일.
// 타일의 숫자는 features/course/data/places.json에서 센 값이다
export default function HomePage() {
  const t = useTranslations("Home");
  const common = useTranslations("Common");
  const tt = useTranslations("Themes");
  const tr = useTranslations("Regions");

  return (
    <Screen>
      <main className="flex flex-1 flex-col pt-16">
        <section className="px-6">
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
              const slug = theme.slug as ThemeSlug;
              return (
                <li key={slug}>
                  <ThemeTile
                    slug={slug}
                    href={`/themes/${slug}`}
                    name={tt(`${slug}.name`)}
                    regionLabel={theme.regions.map((r) => tr(r)).join(" · ")}
                    stats={t("placeStats", themePlaceStats(slug))}
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-6 px-1 text-micro text-fg-subtle">{t("source")}</p>
        </section>
      </main>
      <BottomBar>
        <ButtonLink href="/recommend" block>
          {t("cta")}
          <ArrowRight size={18} aria-hidden />
        </ButtonLink>
      </BottomBar>
    </Screen>
  );
}
