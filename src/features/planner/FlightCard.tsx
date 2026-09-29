"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Plane } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { buttonClassName } from "@/components/ui/Button";
import { useTourApi } from "@/components/ui/tour-api-context";
import {
  AIRPORT_PROCESS_REVALIDATE_SECONDS,
  AIRPORT_PROCESS_TIMEOUT_MS,
  airportLeadMin,
  type AirportProcess,
  type AirportProcessResponse,
  MIN_AIRPORT_LEAD_MIN,
  BOARDING_BUFFER_MIN,
} from "@/lib/airport-process";
import {
  AIRLINE_LINKS,
  type AirlineShare,
  airlineShares,
  type Airport,
  BUSAN_AIRPORTS,
  busanSummary,
  type FlightSummary,
  JEJU_AIRPORTS,
  jejuSummary,
} from "./flights";

const LINK = `${buttonClassName({ variant: "secondary", size: "md" })} shrink-0`;

async function fetchAirportProcess(): Promise<AirportProcessResponse> {
  const res = await fetch("/api/airport/process", {
    signal: AbortSignal.timeout(AIRPORT_PROCESS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`airport ${res.status}`);
  return (await res.json()) as AirportProcessResponse;
}

type FlightCardProps =
  | {
      kind: "jeju";
      /** 처음 고를 제주 노선 공항(flights.ts jejuAirportFor) */
      initialAirport: string;
    }
  | { kind: "busan" };

// 코스 탭 「제주 노선 운항 현황」 · 「김해공항 노선 운항 현황」 카드(PoC flightBoard* · busanAir*).
// 방향 · 공항 고르기 → 편성 요약 표 → 항공사별 운항 개요(비중 막대) → 지금 수속 소요(한국공항공사, 키가 있을 때) → 항공사 공식 시간표.
// 요약은 PoC 하드코딩 참고값이라 「정기 편성 요약 · 시즌·요일에 따라 달라집니다」를 함께 보인다. 값은 flights.ts가 만든다
export function FlightCard(props: FlightCardProps) {
  const t = useTranslations("Planner.course.flights");
  const tb = useTranslations("Planner.course.booking");
  const locale = useLocale();
  const ko = locale === "ko";
  const id = useId();
  const jeju = props.kind === "jeju";
  // 제주 카드: to = 제주 도착(출발 공항 고르기) · from = 제주 출발. 김해 카드: from = 김해 출발(도착 공항) · to = 김해 도착
  const [dir, setDir] = useState<"to" | "from">(jeju ? "to" : "from");
  const [code, setCode] = useState(jeju ? props.initialAirport : "CJU");
  const airports: readonly Airport[] = jeju ? JEJU_AIRPORTS : BUSAN_AIRPORTS;
  const hub = jeju ? "CJU" : "PUS";
  const summary = jeju ? jejuSummary(code, ko) : busanSummary(code, ko);
  const shares = airlineShares(jeju ? `${code}-CJU` : `PUS-${code}`, ko);
  const name = (a: Airport) => (ko ? a.ko : a.en);
  const label = (a: Airport) =>
    dir === "to"
      ? `${name(a)} (${a.code}) → ${hub}`
      : `${hub} → ${name(a)} (${a.code})`;
  // 수속 소요를 볼 공항: 이 노선에서 지금 출발하는 공항
  const departing = jeju
    ? dir === "to"
      ? code
      : "CJU"
    : dir === "from"
      ? "PUS"
      : code;

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mt-6 rounded-card p-4 ring-1 ring-line"
    >
      <h3
        id={`${id}-title`}
        className="flex items-center gap-2 text-body-lg font-bold"
      >
        <Plane size={20} aria-hidden className="shrink-0 text-primary" />
        {t(`title.${props.kind}`)}
      </h3>

      <div className="mt-3 flex flex-col gap-3">
        <Select
          id={`${id}-dir`}
          label={t("direction")}
          value={dir}
          onChange={(v) => setDir(v as "to" | "from")}
          options={(jeju
            ? (["to", "from"] as const)
            : (["from", "to"] as const)
          ).map((d) => ({ value: d, label: t(`dir.${props.kind}.${d}`) }))}
        />
        <Select
          id={`${id}-airport`}
          label={t(dir === "to" ? "fromAirport" : "toAirport")}
          value={code}
          onChange={setCode}
          options={airports.map((a) => ({ value: a.code, label: label(a) }))}
        />
      </div>

      {summary && <SummaryTable summary={summary} />}
      <p className="mt-2 text-caption text-fg-muted">{t("note")}</p>

      {shares.length > 0 && <AirlineShares shares={shares} />}

      <ProcessTime code={departing} airports={airports} />

      <div className="mt-4">
        <p className="text-caption text-fg-muted">{t("links")}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {AIRLINE_LINKS.map((a) => (
            <li key={a.url}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK}
              >
                {ko ? a.ko : a.en}
                <ExternalLink size={14} className="shrink-0" aria-hidden />
                <span className="sr-only">{tb("newWindow")}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      {!jeju && (
        <p className="mt-3 text-caption text-fg-muted">{t("busanNote")}</p>
      )}
    </section>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-caption text-fg-muted">
        {label}
      </label>
      <div className="relative mt-1">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full min-w-0 appearance-none rounded-xl bg-fill pr-10 pl-4 text-body text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={20}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted"
        />
      </div>
    </div>
  );
}

function useCount() {
  const t = useTranslations("Planner.course.flights");
  return (c: FlightSummary["count"], total = false) =>
    c === null
      ? "–"
      : t(c.weekly ? "count.weekly" : total ? "count.total" : "count.daily", {
          lo: c.lo,
          hi: c.hi,
          same: c.lo === c.hi ? "yes" : "no",
        });
}

function SummaryTable({ summary }: { summary: FlightSummary }) {
  const t = useTranslations("Planner.course.flights");
  const count = useCount();
  const airlines = summary.special
    ? t(`special.${summary.special}`)
    : summary.fromTable
      ? t("airlinesCount", {
          count: summary.airlines.length,
          names: summary.airlines.slice(0, 3).join(", "),
          more: summary.airlines.length > 3 ? "yes" : "no",
        })
      : summary.airlines.join(" · ");
  const rows: ["airlines" | "daily" | "first" | "last" | "duration", string][] =
    [
      ["airlines", airlines],
      ["daily", count(summary.count, summary.fromTable)],
      ["first", summary.first ?? "–"],
      ["last", summary.last ?? "–"],
      [
        "duration",
        summary.minutes === null ? "–" : t("minutes", { n: summary.minutes }),
      ],
    ];
  return (
    <dl className="mt-3 divide-y divide-line border-y border-line">
      {rows.map(([key, value]) => (
        <div
          key={key}
          className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-2 text-label"
        >
          <dt className="text-fg-muted">{t(`rows.${key}`)}</dt>
          <dd className="min-w-0 text-fg tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AirlineShares({ shares }: { shares: readonly AirlineShare[] }) {
  const t = useTranslations("Planner.course.flights");
  const count = useCount();
  return (
    <div className="mt-4 border-t border-line pt-4">
      <h4 className="text-label font-semibold">{t("byAirline")}</h4>
      <ul className="mt-2 flex flex-col gap-2">
        {shares.map((a) => (
          <li key={a.name} className="text-label">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-semibold">{a.name}</span>
              <span className="shrink-0 text-caption text-fg-muted tabular-nums">
                {count(a.count)} · {a.window}
              </span>
            </div>
            <div
              aria-hidden
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill"
            >
              <div
                className="h-full rounded-full bg-primary-bright"
                style={{ width: `${a.share}%` }}
              />
            </div>
            <span className="sr-only">{t("share", { pct: a.share })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEPS = ["a", "b", "c", "d"] as const;

/** 지금 수속 소요(한국공항공사, 5개 공항만). 서버에 키가 없거나 실패 · 그 공항 값이 없으면 숨긴다 */
function ProcessTime({
  code,
  airports,
}: {
  code: string;
  airports: readonly Airport[];
}) {
  const t = useTranslations("Planner.course.flights.process");
  const locale = useLocale();
  const enabled = useTourApi();
  const query = useQuery({
    queryKey: ["airport-process"],
    queryFn: fetchAirportProcess,
    staleTime: AIRPORT_PROCESS_REVALIDATE_SECONDS * 1000,
    retry: false,
    enabled,
  });
  const p: AirportProcess | undefined = query.data?.[code];
  if (!p || p.all <= 0) return null;
  const hub = {
    CJU: { ko: "제주", en: "Jeju" },
    PUS: { ko: "김해", en: "Gimhae" },
  };
  const a =
    airports.find((x) => x.code === code) ??
    (code in hub ? { code, ...hub[code as keyof typeof hub] } : null);
  const airportName = a
    ? locale === "ko"
      ? a.ko.replace(/\(.*?\)/g, "")
      : a.en
    : code;
  const max = Math.max(1, p.a, p.b, p.c, p.d);
  const lead = airportLeadMin(p);
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h4 className="text-label font-semibold">
          {t("title", { airport: airportName })}
        </h4>
        {p.at && (
          <span className="text-caption text-fg-muted tabular-nums">
            {t("at", { at: p.at })}
          </span>
        )}
      </div>
      <p className="mt-1 text-headline font-bold text-primary tabular-nums">
        {t("minutes", { n: p.all })}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {STEPS.map((k) => (
          <li
            key={k}
            className="grid grid-cols-[8.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-caption"
          >
            <span className="text-fg-muted">{t(`steps.${k}`)}</span>
            <span
              aria-hidden
              className="h-1.5 overflow-hidden rounded-full bg-fill"
            >
              <span
                className="block h-full rounded-full bg-primary-bright"
                style={{ width: `${Math.round((p[k] / max) * 100)}%` }}
              />
            </span>
            <span className="text-right tabular-nums">
              {t("minutes", { n: p[k] })}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-caption text-fg-muted">
        {t("note", {
          all: p.all,
          buffer: BOARDING_BUFFER_MIN,
          min: MIN_AIRPORT_LEAD_MIN,
          lead,
          floor:
            p.all + BOARDING_BUFFER_MIN < MIN_AIRPORT_LEAD_MIN ? "yes" : "no",
        })}
      </p>
    </div>
  );
}
