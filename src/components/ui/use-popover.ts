"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 버튼 아래에 펼치는 작은 창(언어 메뉴 · 알림)의 열고 닫기.
 * Esc를 누르면 닫고 초점을 여는 버튼으로 돌려준다. 바깥을 누르거나 초점이 바깥으로 나가면(Tab) 닫는다.
 * rootRef는 여는 버튼과 창을 함께 감싸는 요소에, triggerRef는 여는 버튼에, onBlur는 감싸는 요소에 단다
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return {
    open,
    setOpen,
    toggle: () => setOpen((v) => !v),
    rootRef,
    triggerRef,
    onBlur: (e: React.FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && !rootRef.current?.contains(next)) setOpen(false);
    },
  };
}
