"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type TopBarProps = {
  title?: string;
  /** 없으면 브라우저 뒤로 가기 */
  onBack?: () => void;
  /** 오른쪽 자리 (건너뛰기 버튼 등) */
  right?: React.ReactNode;
};

export function TopBar({ title, onBack, right }: TopBarProps) {
  const router = useRouter();
  const t = useTranslations("Common");

  return (
    <header className="sticky top-0 z-20 grid min-h-14 grid-cols-[1fr_auto_1fr] items-center bg-surface px-2 pt-[env(safe-area-inset-top)]">
      <button
        type="button"
        aria-label={t("back")}
        onClick={onBack ?? (() => router.back())}
        className="flex size-11 items-center justify-center justify-self-start rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill"
      >
        <ChevronLeft size={26} aria-hidden />
      </button>
      {title ? (
        <h1 className="text-body-lg font-semibold">{title}</h1>
      ) : (
        <span />
      )}
      <div className="justify-self-end">{right}</div>
    </header>
  );
}
