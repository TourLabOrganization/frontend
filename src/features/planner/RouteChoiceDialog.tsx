"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";

export type RouteOption = {
  mode: string;
  /** 「KTX · 환승 1회」 */
  title: string;
  /** 「2시간 48분」 */
  total: string;
  /** 「운길산역 → 서울역 → 신경주역」 */
  path: string;
  /** 「08:00 출발 → 10:48 도착」 */
  times: string;
  current: boolean;
};

type RouteChoiceDialogProps = {
  open: boolean;
  kicker: string;
  title: string;
  options: readonly RouteOption[];
  onPick: (mode: string) => void;
  /** Esc · 바깥 누르기 · 닫기 버튼. 기본 경로(강조된 항목)를 쓴다 */
  onClose: () => void;
};

// 광역 경로 고르기(PoC routeAsk*). ConfirmDialog와 같은 규칙: showModal()이 초점을 안에 가두고,
// Esc · 바깥 누르기로 닫히고, 제목 · 본문을 aria-labelledby · aria-describedby로 잇는다.
// 닫히면 브라우저가 초점을 열기 전 자리로 돌려준다
export function RouteChoiceDialog({
  open,
  kicker,
  title,
  options,
  onPick,
  onClose,
}: RouteChoiceDialogProps) {
  const t = useTranslations("Planner.course.route");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  // 고르기로 닫혔는지. close 이벤트는 어느 쪽으로 닫혀도 오므로 구분한다
  const picked = useRef<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      picked.current = null;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={() => {
        const m = picked.current;
        picked.current = null;
        if (m) onPick(m);
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto max-h-[calc(100dvh-2.5rem)] w-[calc(100%-2.5rem)] max-w-sm overflow-y-auto rounded-card bg-surface p-0 text-fg backdrop:bg-ink/40"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-2.5 text-caption font-semibold text-primary">
            {kicker}
          </p>
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => ref.current?.close()}
            className="-mt-1 -mr-3 flex size-11 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <h2 id={titleId} className="mt-1 text-headline font-bold">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-body text-fg-muted">
          {t("body")}
        </p>
        <ul className="mt-5 flex flex-col gap-2">
          {options.map((o) => (
            <li key={o.mode}>
              <button
                type="button"
                aria-pressed={o.current}
                onClick={() => {
                  picked.current = o.mode;
                  ref.current?.close();
                }}
                className={`flex w-full flex-col gap-1 rounded-2xl p-4 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${o.current ? "bg-primary-weak ring-2 ring-primary ring-inset" : "bg-surface ring-1 ring-line ring-inset active:bg-fill"}`}
              >
                <span className="flex w-full items-baseline justify-between gap-2">
                  <span
                    className={`flex items-center gap-1 text-body font-semibold ${o.current ? "text-primary-strong" : "text-fg"}`}
                  >
                    {o.current && (
                      <Check size={16} className="shrink-0" aria-hidden />
                    )}
                    {o.title}
                  </span>
                  <span className="shrink-0 text-label font-semibold tabular-nums">
                    {o.total}
                  </span>
                </span>
                <span className="text-label text-fg">{o.path}</span>
                <span className="text-caption text-fg-muted tabular-nums">
                  {o.times}
                </span>
                {o.current && <span className="sr-only">{t("current")}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-caption text-fg-muted">{t("foot")}</p>
      </div>
    </dialog>
  );
}
