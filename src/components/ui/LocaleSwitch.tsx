"use client";

import { Check, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { LOCALE_NAMES, locales } from "@/i18n/locales";
import { usePopover } from "./use-popover";

// 언어 메뉴(목업 「MULTI LANGUAGE」). 누르면 언어 목록이 펼쳐지고, 고르면 지금 화면을 그 언어로 다시 그린다.
// 목록은 locales(지금 한국어 · English)를 그대로 돌아서 언어가 늘면 저절로 늘어난다. 언어 이름은 그 언어로 쓴다(LOCALE_NAMES).
// 링크 목록에 가까운 펼침 버튼(disclosure)이라 menu 역할은 쓰지 않는다. 대신 ↑ ↓로 항목 사이를 옮길 수 있게 했다.
// Esc · 바깥 누르기 · Tab으로 밖에 나가면 닫힌다(usePopover).
// 「MULTI LANGUAGE」 글자는 440px 이상에서만 보인다. 390px 머리줄(로고 · 검색 · 알림)에 들어가지 않아 그보다 좁으면 아이콘만 보이고 이름은 화면 읽기용으로 남는다
export function LocaleSwitch() {
  const locale = useLocale();
  const t = useTranslations("Common.localeMenu");
  const [pending, startTransition] = useTransition();
  const { open, setOpen, toggle, rootRef, triggerRef, onBlur } = usePopover();
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const focusItem = (index: number) => {
    const items =
      listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [];
    if (items.length === 0) return;
    items[(index + items.length) % items.length]?.focus();
  };
  const currentIndex = Math.max(0, locales.indexOf(locale as never));

  const pick = (next: string) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
    });
  };

  return (
    <div ref={rootRef} onBlur={onBlur} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        disabled={pending}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown") return;
          e.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => focusItem(currentIndex));
        }}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-2 text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill disabled:opacity-50 motion-reduce:transition-none"
      >
        <Languages size={20} aria-hidden className="shrink-0" />
        <span className="hidden flex-col text-left text-micro leading-tight font-bold tracking-wide uppercase min-[440px]:flex">
          <span>{t("first")}</span>
          <span>{t("second")}</span>
        </span>
        <span className="sr-only">
          {t("current", { name: LOCALE_NAMES[locale] ?? locale })}
        </span>
      </button>
      <ul
        ref={listRef}
        id={listId}
        hidden={!open}
        aria-label={t("listLabel")}
        onKeyDown={(e) => {
          const items = [
            ...(listRef.current?.querySelectorAll("button") ?? []),
          ];
          const i = items.indexOf(document.activeElement as HTMLButtonElement);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            focusItem(i + 1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            focusItem(i - 1);
          }
        }}
        className="absolute top-full right-0 z-40 mt-1 w-44 rounded-2xl bg-surface p-1 ring-1 ring-line"
      >
        {locales.map((l) => {
          const current = l === locale;
          return (
            <li key={l}>
              <button
                type="button"
                lang={l}
                aria-current={current ? "true" : undefined}
                onClick={() => pick(l)}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-label transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                  current
                    ? "bg-primary-weak font-semibold text-primary-strong"
                    : "font-medium text-fg active:bg-fill"
                }`}
              >
                {LOCALE_NAMES[l] ?? l}
                {current && <Check size={16} aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
