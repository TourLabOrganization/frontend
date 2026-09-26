import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { BottomBar } from "@/components/ui/BottomBar";
import { ButtonLink } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";

// 자리표시 홈. 실제 홈(추천 테마 · 테마 타일)은 테마 추천 흐름 다음에 만든다
export default function HomePage() {
  const t = useTranslations("Home");
  const common = useTranslations("Common");

  return (
    <Screen>
      <main className="flex flex-1 flex-col px-6 pt-16">
        <p className="text-caption font-semibold tracking-[0.12em] text-primary">
          {common("brand")}
        </p>
        <h1 className="mt-3 text-title font-bold">{t("title")}</h1>
        <p className="mt-2 text-body text-fg-muted">{t("description")}</p>
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
