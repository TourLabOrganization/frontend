import { ExternalLink, TrainFront } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/ui/Button";
import type { BookingLink } from "./data/booking";

type CourseAccessLegProps = {
  direction: "out" | "back";
  from: string;
  to: string;
  /** 광역 교통 이름(KTX · 고속버스 · 항공 …) */
  mode: string;
  /** 「약 2시간 8분」의 시간 부분 */
  duration: string;
  /** 수단에 맞는 예매 링크(PoC transBtns). 자가용은 없다 */
  link: BookingLink | null;
};

// 일자별 일정의 광역 구간. 첫날 위에 가는 길(출발지 → 관문), 마지막 날 아래에 돌아오는 길(관문 → 출발지).
// 예매 버튼은 그 구간 수단에 맞는 링크 하나(새 창)
export function CourseAccessLeg({
  direction,
  from,
  to,
  mode,
  duration,
  link,
}: CourseAccessLegProps) {
  const t = useTranslations("Planner.course");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-fill p-4">
      <div className="flex min-w-48 flex-1 items-start gap-3">
        <TrainFront
          size={20}
          aria-hidden
          className="mt-0.5 shrink-0 text-fg-muted"
        />
        <p className="min-w-0 text-label">
          <span className="block text-caption font-semibold text-fg-muted">
            {t(`legs.${direction}`)}
          </span>
          <span className="block font-semibold text-fg">
            {t("legs.route", { from, to })}
          </span>
          <span className="block text-fg-muted">
            {t("legs.access", { mode, duration })}
          </span>
        </p>
      </div>
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonClassName({ variant: "secondary", size: "md" })} shrink-0 bg-surface active:bg-line`}
        >
          {t(`booking.${link.label}`)}
          <ExternalLink size={16} className="shrink-0" aria-hidden />
          <span className="sr-only">{t("booking.newWindow")}</span>
        </a>
      )}
    </div>
  );
}
