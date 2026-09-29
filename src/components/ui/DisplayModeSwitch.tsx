"use client";

import { Check, Leaf, Moon, Sun, Sunset } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import {
  applyDisplayMode,
  DISPLAY_MODES,
  type DisplayMode,
} from "@/lib/display-mode";
import { usePopover } from "./use-popover";

const ICON = { light: Sun, dark: Moon, forest: Leaf, sunset: Sunset } as const;

// 머리줄 「화면 모드」 메뉴(언어 메뉴와 같은 펼침 버튼). 기본 · 블랙 · 포레스트 · 선셋 코랄 중에서 고르면 바로 바뀌고 쿠키에 남는다(lib/display-mode.ts).
// 처음 모드는 서버가 쿠키로 정해 넘긴다(initial)
export function DisplayModeSwitch({ initial }: { initial: DisplayMode }) {
  const t = useTranslations("Header.displayMode");
  const [mode, setMode] = useState<DisplayMode>(initial);
  const { open, setOpen, toggle, rootRef, triggerRef, onBlur } = usePopover();
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const Icon = ICON[mode];

  const focusItem = (index: number) => {
    const items =
      listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [];
    if (items.length === 0) return;
    items[(index + items.length) % items.length]?.focus();
  };

  const pick = (next: DisplayMode) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (next === mode) return;
    setMode(next);
    applyDisplayMode(next);
  };

  return (
    <div ref={rootRef} onBlur={onBlur} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t("button", { mode: t(`modes.${mode}`) })}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown") return;
          e.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => focusItem(DISPLAY_MODES.indexOf(mode)));
        }}
        className="flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
      >
        <Icon size={20} aria-hidden />
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
        {DISPLAY_MODES.map((m) => {
          const current = m === mode;
          const ItemIcon = ICON[m];
          return (
            <li key={m}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => pick(m)}
                className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-label transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                  current
                    ? "bg-primary-weak font-semibold text-primary-strong"
                    : "font-medium text-fg active:bg-fill"
                }`}
              >
                <ItemIcon size={16} aria-hidden className="shrink-0" />
                <span className="flex-1">{t(`modes.${m}`)}</span>
                {current && <Check size={16} aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
