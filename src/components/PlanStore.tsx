"use client";

import { ChevronDown, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

export type PlanStoreItem = {
  id: string;
  name: string;
  /** 이름 아래 한 줄(도시 · 기간 · 장소 수, 테마는 안 이름 · 저장일) */
  sub: string;
  /** 지금 불러와 보고 있는 플랜 */
  current: boolean;
};

type PlanStoreProps = {
  items: readonly PlanStoreItem[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  /** 삭제한 뒤 초점을 돌려받을 목록 머리(summary) */
  summaryRef?: React.Ref<HTMLElement>;
};

// 「내 플랜」의 저장소 목록(PoC 저장소 보기 · 불러오기 · 삭제). 투어 플래너 코스 탭과 테마 코스 탭이 함께 쓴다.
// 접이식(details/summary)이고, 행마다 불러오기 · 삭제. 삭제는 쓰는 쪽이 확인 창으로 묻는다
export function PlanStore({
  items,
  onLoad,
  onDelete,
  summaryRef,
}: PlanStoreProps) {
  const t = useTranslations("Plans");
  return (
    <details className="group mt-3">
      <summary
        ref={summaryRef}
        className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg text-label font-semibold text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright [&::-webkit-details-marker]:hidden"
      >
        {t("store", { count: items.length })}
        <ChevronDown
          size={16}
          aria-hidden
          className="shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      {items.length === 0 ? (
        <p className="mt-1 text-label text-fg-muted">{t("storeEmpty")}</p>
      ) : (
        <ul className="mt-1 flex flex-col divide-y divide-line">
          {items.map((p) => (
            <li
              key={p.id}
              aria-current={p.current || undefined}
              className="flex items-center gap-2 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold break-words">{p.name}</p>
                <p className="text-caption text-fg-subtle">{p.sub}</p>
                {p.current && (
                  <div className="mt-1">
                    <Chip tone="primary">{t("current")}</Chip>
                  </div>
                )}
              </div>
              <Button
                variant="secondary"
                size="md"
                aria-label={t("loadLabel", { name: p.name })}
                onClick={() => onLoad(p.id)}
                className="shrink-0"
              >
                {t("load")}
              </Button>
              <button
                type="button"
                aria-label={t("deleteLabel", { name: p.name })}
                onClick={() => onDelete(p.id)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
              >
                <Trash2 size={20} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
