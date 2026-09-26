import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { findTheme, type ThemeSlug } from "@/features/recommend/themes";

// 자리표시. 코스 3안 비교 화면은 다음 작업에서 만든다
export default async function ThemePage({
  params,
}: PageProps<"/themes/[themeId]">) {
  const { themeId } = await params;
  const theme = findTheme(themeId);
  if (!theme) notFound();

  const t = await getTranslations("Themes");

  return (
    <Screen>
      <TopBar />
      <main className="flex flex-1 flex-col px-6 pt-2">
        <h1 className="text-title font-bold">
          {t(`${theme.slug as ThemeSlug}.name`)}
        </h1>
        <p className="mt-2 text-body text-fg-muted">{t("preparing")}</p>
      </main>
    </Screen>
  );
}
