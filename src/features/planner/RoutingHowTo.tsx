import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

/** PoC howToSteps 순서: 광역교통 → 출발지 · 귀가지 → 경로 선택 → 현지 이동 → 숙소 → 제주 규칙 */
const STEPS = ["wide", "origin", "route", "local", "stay", "jeju"] as const;

// 이동 요령(접이식 6단계). 문구는 PoC Tour Planner.dc.html howToSteps(한 · 영, 중 · 일 · 스페인어는 옮김).
// details/summary라 Enter · Space로 열고 닫고, 열림 상태를 화면 읽기 프로그램이 읽는다.
// 코스 탭과 여행 정보 탭이 함께 쓴다(여행 정보 탭의 짧은 이동 요령 문단을 이것으로 합쳤다)
export function RoutingHowTo({ className = "" }: { className?: string }) {
  const t = useTranslations("Planner.howTo");
  return (
    <details className={`group rounded-card ring-1 ring-line ${className}`}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-card px-4 text-body font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright [&::-webkit-details-marker]:hidden">
        {t("heading")}
        <ChevronDown
          size={20}
          aria-hidden
          className="shrink-0 text-fg-muted transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <ol className="flex flex-col gap-3 border-t border-line px-4 pt-3 pb-4">
        {STEPS.map((key, i) => (
          <li key={key} className="flex gap-3 text-label text-fg-muted">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-weak text-caption font-bold text-primary-strong tabular-nums"
            >
              {i + 1}
            </span>
            <span className="min-w-0">{t(`steps.${key}`)}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
