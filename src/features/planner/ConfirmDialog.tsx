"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** Esc · 바깥 누르기 · 취소 */
  onCancel: () => void;
};

// 되돌리기 어려운 동작을 묻는 모달 dialog. 가운데 뜬다.
// showModal()이 초점을 안에 가두고, 처음 초점은 첫 버튼(취소)이라 Enter를 잘못 눌러도 지워지지 않는다.
// 닫히면 브라우저가 초점을 열기 전 자리(누른 버튼)로 돌려준다
export function ConfirmDialog({
  open,
  title,
  body,
  cancelLabel,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  // 확인으로 닫혔는지. close 이벤트는 어느 쪽으로 닫혀도 오므로 구분한다
  const confirmed = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      confirmed.current = false;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={() => {
        if (confirmed.current) onConfirm();
        else onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto w-[calc(100%-2.5rem)] max-w-sm rounded-card bg-surface p-0 text-fg backdrop:bg-fg/40"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-headline font-bold">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-body text-fg-muted">
          {body}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => ref.current?.close()}
          >
            {cancelLabel}
          </Button>
          <Button
            size="md"
            onClick={() => {
              confirmed.current = true;
              ref.current?.close();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
