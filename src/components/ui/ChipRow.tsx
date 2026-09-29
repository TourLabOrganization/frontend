"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type FocusEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

/**
 * 칩 줄(테마 지도 도시 · 분류, 투어 플래너 분류 · 배지). 가로 스크롤 · 스크롤 막대를 두지 않는다(대표 결정 2026-09-30).
 * 처음엔 한 줄만 보이고, 넘치는 칩이 있으면 끝에 「더보기」를 두어 누르면 모두 펼친다.
 * 새로 고른 칩(aria-pressed)이나 키보드 초점이 가려진 줄에 있으면 저절로 펼친다.
 * 한 줄 높이는 칩 min-h-11(2.75rem)에 초점 테두리 여유(p-1)를 더한 3.25rem
 */
export function ChipRow({
  children,
  groupLabel,
  className = "",
}: {
  children: ReactNode;
  /** 있으면 칩 상자를 이 이름의 묶음(role=group)으로 읽힌다 */
  groupLabel?: string;
  className?: string;
}) {
  const t = useTranslations("Common");
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const boxId = useId();
  // 저절로 펼치는 것은 고른 칩이 바뀌었을 때만(사용자가 「접기」를 누르면 그대로 접혀 있게)
  const lastPressed = useRef<HTMLElement | null>(null);

  /** 첫 줄 아래(가려진 줄)에 있는 요소인지 */
  const belowFirstRow = useCallback((el: HTMLElement) => {
    const box = boxRef.current;
    const first = box?.querySelector<HTMLElement>("button");
    if (!box || !first) return false;
    return (
      el.getBoundingClientRect().top > first.getBoundingClientRect().top + 4
    );
  }, []);

  const measure = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    // 펼친 상태에서도 「접기」를 두려면 한 줄을 넘는지 알아야 해서, 첫 칩과 마지막 칩의 줄로 잰다
    const buttons = box.querySelectorAll<HTMLElement>("button");
    const last = buttons[buttons.length - 1];
    setOverflows(last ? belowFirstRow(last) : false);
    const pressed = box.querySelector<HTMLElement>("[aria-pressed='true']");
    if (pressed !== lastPressed.current) {
      lastPressed.current = pressed;
      if (pressed && belowFirstRow(pressed)) setOpen(true);
    }
  }, [belowFirstRow]);

  // 칩이 바뀌면(지역 · 분류) 다시 잰다
  useEffect(() => {
    measure();
  });
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [measure]);

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (!open && e.target instanceof HTMLElement && belowFirstRow(e.target))
      setOpen(true);
  };

  return (
    // 접었을 때는 「더보기」가 첫 줄 오른쪽에, 펼치면 칩이 폭 전체를 쓰고 「접기」는 그 아래 오른쪽에 온다
    <div
      className={`flex gap-2 ${open ? "flex-col" : "items-start"} ${className}`}
    >
      <div
        ref={boxRef}
        id={boxId}
        role={groupLabel ? "group" : undefined}
        aria-label={groupLabel}
        onFocus={onFocus}
        className={`-m-1 flex min-w-0 flex-1 flex-wrap gap-2 p-1 ${
          open ? "" : "max-h-13 overflow-hidden"
        }`}
      >
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={boxId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 shrink-0 items-center gap-1 self-end rounded-xl px-2 text-label font-semibold text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
        >
          {open ? t("chipsLess") : t("chipsMore")}
          <ChevronDown
            size={18}
            aria-hidden
            className={`transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}
