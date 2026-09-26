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
      onClick={() => startTransition(() => setLocale(next))}
      disabled={pending}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-label font-semibold text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill disabled:opacity-50 motion-reduce:transition-none"
    >
      <Languages size={20} aria-hidden />
      <span lang={next}>{t("localeSwitch")}</span>
    </button>
  );
}
