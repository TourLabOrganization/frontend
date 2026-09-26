import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/LogoMark";
import { Screen } from "@/components/ui/Screen";

// 없는 주소 · 없는 테마(notFound())의 화면. 기본 404 대신 앱 모양과 화면 언어로 보이고 홈으로 돌아가는 길을 둔다
export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <Screen>
      <main className="flex flex-1 flex-col justify-center px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <LogoMark size={48} className="text-primary" />
        <p className="mt-6 text-label font-semibold text-fg-subtle tabular-nums">
          404
        </p>
        <h1 className="mt-1 text-title font-bold">{t("title")}</h1>
        <p className="mt-2 text-body text-fg-muted">{t("description")}</p>
        <ButtonLink href="/" block className="mt-8">
          {t("home")}
        </ButtonLink>
      </main>
    </Screen>
  );
}
