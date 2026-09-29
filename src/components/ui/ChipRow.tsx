"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * 칩 줄(테마 지도 도시 · 분류, 투어 플래너 분류 · 배지). 가로 스크롤 · 스크롤 막대를 두지 않는다(대표 결정 2026-09-30).
 * 접었을 때는 첫 줄에 들어가는 칩만 보이고 「더보기」를 마지막 칩 바로 옆에 둔다. 펼치면 칩을 모두 보이고 「접기」는 마지막 칩 뒤에 온다.
 * 첫 줄에 들어가는 칩 수는 칩을 모두 그린 뒤 재서 정하고(그리기 전에 재어 깜빡이지 않는다), 칸 폭이 바뀌면 다시 잰다.
 * 가려진 칩은 숨겨(display: none) 키보드 초점이 가지 않고, 잴 때 고른 칩(aria-pressed)이 가려질 자리면 저절로 펼친다
 */
export function ChipRow({
  items,
  groupLabel,
  className = "",
}: {
  /** 칩(버튼) 목록 */
  items: readonly ReactNode[];
  /** 있으면 칩 상자를 이 이름의 묶음(role=group)으로 읽힌다 */
  groupLabel?: string;
  className?: string;
}) {
  const t = useTranslations("Common");
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const boxId = useId();
  const count = items.length;
  // 잰 결과(그때의 칩 수와 첫 줄에 보이는 칩 수). 칩 수가 바뀌거나 칸 폭이 바뀌면(null) 다시 잰다
  const [measured, setMeasured] = useState<{
    count: number;
    fit: number;
  } | null>(null);
  const fit = measured && measured.count === count ? measured.fit : null;

  // 칸 폭이 바뀌면 다시 잰다
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let width = box.clientWidth;
    const observer = new ResizeObserver(() => {
      if (box.clientWidth !== width) {
        width = box.clientWidth;
        setMeasured(null);
      }
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (fit !== null) return;
    const box = boxRef.current;
    if (!box) return;
    const chips = [
      ...box.querySelectorAll<HTMLElement>(":scope > [data-chip]"),
    ];
    const toggle = box.querySelector<HTMLElement>(
      ":scope > [data-chip-toggle]",
    );
    if (chips.length === 0) {
      setMeasured({ count: 0, fit: 0 });
      return;
    }
    const top = chips[0].getBoundingClientRect().top;
    let n = chips.filter(
      (c) => Math.abs(c.getBoundingClientRect().top - top) < 2,
    ).length;
    if (n < chips.length) {
      // 첫 줄 끝(오른쪽 안쪽 여백 앞)에 「더보기」 자리를 낸다
      const style = getComputedStyle(box);
      const gap = parseFloat(style.columnGap) || 0;
      const limit =
        box.getBoundingClientRect().right -
        parseFloat(style.paddingRight) -
        (toggle?.getBoundingClientRect().width ?? 0) -
        gap;
      while (n > 1 && chips[n - 1].getBoundingClientRect().right > limit)
        n -= 1;
    }
    setMeasured({ count: chips.length, fit: n });
    // 고른 칩이 가려질 자리면 펼친다. 잴 때만 보므로, 펼친 뒤 사용자가 「접기」를 누르면 그대로 접혀 있다
    const pressed = chips.findIndex((c) =>
      c.querySelector("[aria-pressed='true']"),
    );
    if (pressed >= n) setOpen(true);
  }, [fit]);

  const measuring = fit === null;
  const hiddenFrom = open || measuring ? count : fit;
  const hasMore = measuring || fit < count;

  return (
    <div
      ref={boxRef}
      id={boxId}
      role={groupLabel ? "group" : undefined}
      aria-label={groupLabel}
      // 재는 동안에는 첫 줄만 보이게 잘라 둔다(서버 HTML에서 여러 줄이 잠깐 보이지 않게)
      className={`flex flex-wrap items-center gap-2 ${
        measuring && !open ? "max-h-11 overflow-hidden" : ""
      } ${className}`}
    >
      {items.map((item, i) => (
        <div key={i} data-chip hidden={i >= hiddenFrom} className="flex">
          {item}
        </div>
      ))}
      {hasMore && (
        <button
          type="button"
          data-chip-toggle
          aria-expanded={open}
          aria-controls={boxId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-3 text-label font-semibold text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
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
