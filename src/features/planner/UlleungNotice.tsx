"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { formatDuration } from "@/features/course/format-duration";
import { ulleungPorts, ulleungSailMin } from "./island";
import { PLANNER_ORIGINS } from "./regions";

// 울릉을 고를 때 한 번 띄우는 안내(PoC ulNotice*). 울릉 항로 네 항구와 소요(승선 수속 40분 + 항해 시간).
// ConfirmDialog와 같은 규칙: showModal()이 초점을 안에 가두고, Esc · 바깥 누르기 · 닫기 · 확인으로 닫힌다.
// 닫히면 브라우저가 초점을 열기 전 자리로 돌려준다
export function UlleungNotice({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Planner.course.ulleung");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto max-h-[calc(100dvh-2.5rem)] w-[calc(100%-2.5rem)] max-w-sm overflow-y-auto rounded-card bg-surface p-0 text-fg backdrop:bg-fg/40"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-2.5 text-caption font-semibold text-primary">
            {t("kicker")}
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
          {t("title")}
        </h2>
        <p id={bodyId} className="mt-2 text-body text-fg-muted">
          {t("body")}
        </p>
        <h3 className="mt-5 text-caption font-semibold text-fg-muted">
          {t("portsLabel")}
        </h3>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {ulleungPorts().map((k) => {
            const o = PLANNER_ORIGINS[k];
            // 「(울릉 항로)」 같은 괄호 꼬리는 뺀다(PoC ulNoticePorts)
            const name = (locale === "ko" ? o.ko : o.en || o.ko).replace(
              /\s*\([^)]*\)\s*$/,
              "",
            );
            return (
              <li
                key={k}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span className="min-w-0 text-body font-semibold">{name}</span>
                <span className="shrink-0 text-label font-semibold text-primary tabular-nums">
                  {formatDuration(tc, ulleungSailMin(o))}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-caption text-fg-muted">{t("foot")}</p>
        <Button
          size="md"
          block
          className="mt-5"
          onClick={() => ref.current?.close()}
        >
          {t("ok")}
        </Button>
      </div>
    </dialog>
  );
}
