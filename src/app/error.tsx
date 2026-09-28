"use client";

import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/LogoMark";
import { Screen } from "@/components/ui/Screen";

// 화면을 그리다 예기치 못한 오류가 났을 때의 안전망. 백엔드 응답 모양은 fetch 함수에서 먼저 검사하지만
// (lib/api/datalab.ts), 그래도 새는 오류가 페이지 전체를 기본 500 화면으로 만들지 않게 한다.
// 「다시 시도」는 retry(Next 16.3): 서버 컴포넌트를 다시 받아 그린다(reset은 다시 받지 않아 서버 오류면 그대로다)
export default function ErrorPage({
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  const t = useTranslations("Error");

  return (
    <Screen>
      <main className="flex flex-1 flex-col justify-center px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <LogoMark variant="badge" size={48} className="text-primary" />
        <h1 className="mt-6 text-title font-bold">{t("title")}</h1>
        <p className="mt-2 text-body text-fg-muted">{t("description")}</p>
        <Button block className="mt-8" onClick={() => retry()}>
          <RotateCw size={18} aria-hidden />
          {t("retry")}
        </Button>
        <ButtonLink href="/" variant="ghost" block className="mt-2">
          {t("home")}
        </ButtonLink>
      </main>
    </Screen>
  );
}
