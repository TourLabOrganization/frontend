import { ChevronDown, CircleAlert, ExternalLink, Ship } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { buttonClassName } from "@/components/ui/Button";
import {
  FERRY_BOOK_URL,
  FERRY_ROUTES,
  type FerryLevel,
  ferryOperatorUrl,
  ferryPortLabel,
  ferryRoute,
  ferryRows,
  ferryStatRoute,
  ferryStatView,
} from "./ferry";
import type { Island } from "./island";

const LINK = `${buttonClassName({ variant: "secondary", size: "md" })} shrink-0`;
const LEVEL_TEXT: Record<FerryLevel, string> = {
  normal: "text-fg",
  warn: "text-warning",
  bad: "text-danger",
};
const LEVEL_BAR: Record<FerryLevel, string> = {
  normal: "bg-fg-disabled",
  warn: "bg-warning",
  bad: "bg-danger",
};

type FerryCardProps = {
  island: Island;
  /** 고른 출발 항구(FERRY_ROUTES k). 없으면 첫 항구 */
  port: string | undefined;
  onPort: (k: string) => void;
  /** 출발일(여행월). 고르지 않았으면 null — 가장 궂은 달을 보인다 */
  startDate: string | null;
};

// 코스 탭 「배편 시간표」(PoC ferryVals). 출발 항구 고르기 · 표 · 안내 · 운항 실적(막대 · 경고 · 출처) · 예매 · 선사 시간표 검색.
// 값은 ferry.ts가 만들고 여기서는 언어에 맞춰 그리기만 한다. 숫자 · 월은 Intl로 쓴다
export function FerryCard({ island, port, onPort, startDate }: FerryCardProps) {
  const t = useTranslations("Planner.course.ferry");
  const tb = useTranslations("Planner.course.booking");
  const locale = useLocale();
  const id = useId();
  const ko = locale === "ko";
  const route = ferryRoute(island, port);
  const rows = ferryRows(route, island, ko);
  const view = ferryStatView(route.k, startDate);

  const pct = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(v / 100);
  const monthName = (m: number) =>
    new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
      Date.UTC(2020, m - 1, 1),
    );
  const ym = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  const monthPct = (m: number, v: number) =>
    t("stat.monthPct", { month: m, monthName: monthName(m), pct: pct(v) });

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mt-6 rounded-card p-4 ring-1 ring-line"
    >
      <h3
        id={`${id}-title`}
        className="flex items-center gap-2 text-body-lg font-bold"
      >
        <Ship size={20} aria-hidden className="shrink-0 text-primary" />
        {t(`title.${island}`)}
      </h3>

      <label
        htmlFor={`${id}-port`}
        className="mt-3 block text-caption text-fg-muted"
      >
        {t("port")}
      </label>
      <div className="relative mt-1">
        <select
          id={`${id}-port`}
          value={route.k}
          onChange={(e) => onPort(e.target.value)}
          className="h-12 w-full min-w-0 appearance-none rounded-xl bg-fill pr-10 pl-4 text-body text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
        >
          {FERRY_ROUTES[island].map((r) => (
            <option key={r.k} value={r.k}>
              {ferryPortLabel(r, island, ko)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={20}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted"
        />
      </div>

      <dl className="mt-3 divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <div
            key={r.key}
            className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-2 text-label"
          >
            <dt className="text-fg-muted">{t(`rows.${r.key}`)}</dt>
            <dd className="min-w-0 text-fg tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-caption text-fg-muted">{t("note")}</p>

      {view && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h4 className="text-label font-semibold">
              {t("stat.label", {
                route: ferryStatRoute(view.stats.route, route, island, ko),
              })}
            </h4>
            <p className="text-caption text-fg-muted tabular-nums">
              {t("stat.range", {
                from: ym(view.stats.from),
                to: ym(view.stats.to),
                n: new Intl.NumberFormat(locale).format(view.stats.n),
              })}
            </p>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-xl bg-fill px-3 py-2">
              <dt className="text-caption text-fg-muted">{t("stat.yearly")}</dt>
              <dd
                className={`text-headline font-bold tabular-nums ${LEVEL_TEXT[view.yearLevel]}`}
              >
                {pct(view.stats.ctrl)}
              </dd>
            </div>
            <div className="min-w-0 rounded-xl bg-fill px-3 py-2">
              <dt className="text-caption text-fg-muted">
                {view.month
                  ? t("stat.tripMonth", {
                      month: view.month,
                      monthName: monthName(view.month),
                    })
                  : t("stat.worst")}
              </dt>
              <dd
                className={`text-headline font-bold tabular-nums ${LEVEL_TEXT[view.level]}`}
              >
                {view.tripPct !== null
                  ? pct(view.tripPct)
                  : monthPct(view.worst.month, view.worst.pct)}
              </dd>
            </div>
          </dl>

          <figure className="mt-3" aria-labelledby={`${id}-bars`}>
            <figcaption
              id={`${id}-bars`}
              className="text-caption text-fg-muted"
            >
              {t("stat.bars")}
            </figcaption>
            {/* 막대는 눈으로 보는 요약이고, 화면 읽기 프로그램은 아래 목록으로 달마다 숫자를 읽는다 */}
            <div aria-hidden className="mt-2 grid grid-cols-12 items-end gap-1">
              {view.bars.map((b) => (
                <div key={b.month} className="flex flex-col items-stretch">
                  <div className="flex h-[26px] items-end">
                    <div
                      className={`w-full rounded-t-sm ${b.trip ? "bg-primary" : LEVEL_BAR[b.level]}`}
                      style={{ height: `${b.px}px` }}
                    />
                  </div>
                  <span
                    className={`mt-1 text-center text-micro tabular-nums ${b.trip ? "font-bold text-primary" : "text-fg-muted"}`}
                  >
                    {new Intl.NumberFormat(locale).format(b.month)}
                  </span>
                </div>
              ))}
            </div>
            <ul className="sr-only">
              {view.bars.map((b) => {
                const label = monthPct(b.month, b.pct);
                return (
                  <li key={b.month}>
                    {b.trip ? t("stat.barTrip", { label }) : label}
                  </li>
                );
              })}
            </ul>
          </figure>

          {view.stats.times.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-caption text-fg-muted">
                {t("stat.times")}
              </span>
              <ul className="contents">
                {view.stats.times.map((x) => (
                  <li
                    key={x}
                    className="rounded-lg bg-fill px-2 py-0.5 text-caption font-semibold tabular-nums"
                  >
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view.warn && view.month !== null && view.tripPct !== null && (
            <p className="mt-3 flex items-start gap-1.5 text-label font-semibold text-warning">
              <CircleAlert size={16} className="mt-1 shrink-0" aria-hidden />
              {t("stat.warn", {
                month: view.month,
                monthName: monthName(view.month),
                pct: pct(view.tripPct),
              })}
            </p>
          )}
          <p className="mt-3 text-micro text-fg-subtle">
            {t("stat.src", { ships: view.stats.ships.slice(0, 3).join(" · ") })}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={FERRY_BOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          {t("book")}
          <ExternalLink size={16} className="shrink-0" aria-hidden />
          <span className="sr-only">{tb("newWindow")}</span>
        </a>
        <a
          href={ferryOperatorUrl(route, island)}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          {t("operator")}
          <ExternalLink size={16} className="shrink-0" aria-hidden />
          <span className="sr-only">{tb("newWindow")}</span>
        </a>
      </div>
    </section>
  );
}
