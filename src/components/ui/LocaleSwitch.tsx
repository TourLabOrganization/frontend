"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { defaultLocale, locales } from "@/i18n/locales";

// 언어 전환 버튼. 다른 언어 이름을 그 언어로 보여 주고(한국어 화면에서는 "English"),
// 누르면 지금 화면을 그 언어로 다시 그린다. 언어가 둘이라 누를 때마다 서로 바뀐다
export function LocaleSwitch() {
  const locale = useLocale();
  const t = useTranslations("Common");
  const [pending, startTransition] = useTransition();
  const next = locales.find((l) => l !== locale) ?? defaultLocale;

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await setLocale(next);
          // 구글 지도 스크립트는 처음 불러온 언어로 굳어서, 지도가 있는 화면은 새로고침해 새 언어로 다시 불러온다
          if ("google" in window) window.location.reload();
        })
      }
      disabled={pending}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-label font-semibold text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill disabled:opacity-50 motion-reduce:transition-none"
    >
      <Languages size={20} aria-hidden />
      <span lang={next}>{t("localeSwitch")}</span>
    </button>
  );
}
