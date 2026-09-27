import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  busanLineLabel,
  isBusanLine,
  lineColor,
  lineStations,
  metroLines,
  namedLineLabel,
  stationLabel,
} from "./metro";

const SELECT =
  "h-12 w-full min-w-0 appearance-none rounded-xl bg-fill pr-10 pl-4 text-body text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright";
const FIELD_LABEL = "text-caption text-fg-muted";
const CARD = "rounded-card p-4 ring-1 ring-line";

/** 광역시 호선 이름의 도시 key(PoC metroLineLabel) */
const LINE_CITY = {
  인천: "incheon",
  부산: "busan",
  대구: "daegu",
  대전: "daejeon",
  광주: "gwangju",
} as const;

/** 선택 상자 + 펼침 화살표 */
function Select({
  id,
  value,
  onChange,
  children,
  describedBy,
  className = "",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  describedBy?: string;
  className?: string;
}) {
  return (
    <div className="relative mt-1">
      <select
        id={id}
        value={value}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={`${SELECT} ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={20}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted"
      />
    </div>
  );
}

type MetroPick = {
  line: string;
  station: string;
  onLine: (line: string) => void;
  onStation: (station: string) => void;
};

type CourseOriginsProps = {
  /** 출발지 · 귀가지 보기(wide-chain.ts originOptions). 지금 값이 목록에 없으면 맨 앞에 더해 보인다 */
  originKeys: readonly string[];
  origin: string;
  /** 귀가지. null이면 출발지와 같음 */
  originEnd: string | null;
  originName: (key: string) => string;
  onOrigin: (key: string) => void;
  onOriginEnd: (key: string | null) => void;
  /** 출발지 · 귀가지 선택 상자를 보일지. 광역 교통이 지하철이면 호선 → 역으로 고른다(PoC ownSelShow) */
  showOriginSelect: boolean;
  depTime: string;
  retTime: string;
  depTimes: readonly string[];
  retTimes: readonly string[];
  onDepTime: (v: string) => void;
  onRetTime: (v: string) => void;
  /**
   * 지하철 출발역(PoC metroOriginShow). "wide" 광역 교통이 지하철(출발 · 귀가역을 모두 고른다),
   * "city" 도착 도시가 전철권(출발 전철역 하나, 광역전철 구간). 없으면 null
   */
  metroKind: "wide" | "city" | null;
  metroStart: MetroPick;
  metroEnd: MetroPick;
};

// 코스 탭 출발지 · 귀가지 · 시각(PoC 출발지 · 출발 시각 / 지하철 호선 → 역 / 귀가지 · 여행지 출발 시각 / 귀가역).
// 광역 교통(01)을 먼저 고르고 그 수단의 관문 중에서 고른다
export function CourseOrigins({
  originKeys,
  origin,
  originEnd,
  originName,
  onOrigin,
  onOriginEnd,
  showOriginSelect,
  depTime,
  retTime,
  depTimes,
  retTimes,
  onDepTime,
  onRetTime,
  metroKind,
  metroStart,
  metroEnd,
}: CourseOriginsProps) {
  const t = useTranslations("Planner.course");
  const id = useId();
  const retHintId = `${id}-ret-hint`;
  const keysWith = (key: string | null) =>
    key && !originKeys.includes(key) ? [key, ...originKeys] : originKeys;

  const timeSelect = (
    key: "dep" | "ret",
    value: string,
    options: readonly string[],
    onChange: (v: string) => void,
  ) => (
    <div className="min-w-0">
      <label htmlFor={`${id}-${key}`} className={FIELD_LABEL}>
        {t(key === "dep" ? "trip.depTime" : "trip.retTime")}
      </label>
      <Select
        id={`${id}-${key}`}
        value={value}
        onChange={onChange}
        describedBy={key === "ret" ? retHintId : undefined}
        className="tabular-nums"
      >
        {options.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>
    </div>
  );

  return (
    <fieldset className={`${CARD} mt-6`}>
      <legend className="sr-only">{t("trip.heading")}</legend>
      <span aria-hidden className="text-label font-semibold text-fg-muted">
        {t("trip.heading")}
      </span>
      <div
        className={`mt-3 grid gap-2 ${showOriginSelect ? "grid-cols-[minmax(0,1fr)_7.5rem]" : "grid-cols-1"}`}
      >
        {showOriginSelect && (
          <div className="min-w-0">
            <label htmlFor={`${id}-origin`} className={FIELD_LABEL}>
              {t("trip.origin")}
            </label>
            <Select id={`${id}-origin`} value={origin} onChange={onOrigin}>
              {keysWith(origin).map((key) => (
                <option key={key} value={key}>
                  {originName(key)}
                </option>
              ))}
            </Select>
          </div>
        )}
        {timeSelect("dep", depTime, depTimes, onDepTime)}
      </div>
      {metroKind && (
        <MetroPicker
          label={t(metroKind === "wide" ? "metro.start" : "metro.city")}
          pick={metroStart}
          stationPlaceholder={t("metro.stationPlaceholder")}
        />
      )}
      <div
        className={`mt-3 grid gap-2 ${showOriginSelect ? "grid-cols-[minmax(0,1fr)_7.5rem]" : "grid-cols-1"}`}
      >
        {showOriginSelect && (
          <div className="min-w-0">
            <label htmlFor={`${id}-origin-end`} className={FIELD_LABEL}>
              {t("trip.originEnd")}
            </label>
            <Select
              id={`${id}-origin-end`}
              value={originEnd ?? ""}
              onChange={(v) => onOriginEnd(v === "" ? null : v)}
            >
              <option value="">{t("trip.originSame")}</option>
              {keysWith(originEnd).map((key) => (
                <option key={key} value={key}>
                  {originName(key)}
                </option>
              ))}
            </Select>
          </div>
        )}
        {timeSelect("ret", retTime, retTimes, onRetTime)}
      </div>
      {metroKind === "wide" && (
        <MetroPicker
          label={t("metro.end")}
          pick={metroEnd}
          stationPlaceholder={t("metro.endPlaceholder")}
        />
      )}
      <p id={retHintId} className="mt-2 text-caption text-fg-muted">
        {t("trip.retHint")}
      </p>
    </fieldset>
  );
}

/** 호선 → 역명 두 단계(PoC metroLineOptions · metroOriginOptions). 호선을 바꾸면 역 선택이 비워진다 */
function MetroPicker({
  label,
  pick,
  stationPlaceholder,
}: {
  label: string;
  pick: MetroPick;
  stationPlaceholder: string;
}) {
  const t = useTranslations("Planner.course");
  const locale = useLocale();
  const id = useId();
  const [notice, setNotice] = useState("");
  const lineLabel = (l: string) => {
    if (isBusanLine(l)) return busanLineLabel(l, locale);
    if (/^\d$/.test(l)) return t("metro.lineNo", { n: l });
    const m = l.match(/^(인천|부산|대구|대전|광주)(\d)$/);
    if (m)
      return t("metro.cityLineNo", {
        city: t(`metro.cities.${LINE_CITY[m[1] as keyof typeof LINE_CITY]}`),
        n: m[2],
      });
    return locale === "ko" ? l : (namedLineLabel(l, locale) ?? l);
  };
  const color = pick.line ? lineColor(pick.line) : null;
  const stations = lineStations(pick.line, locale);

  return (
    <fieldset className="mt-3">
      <legend className="text-caption font-semibold text-primary">
        {label}
      </legend>
      <div className="mt-1 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
        <div className="min-w-0">
          <label
            htmlFor={`${id}-line`}
            className={`${FIELD_LABEL} flex h-5 items-center gap-1.5`}
          >
            {color && (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
            )}
            {t("metro.line")}
          </label>
          <Select
            id={`${id}-line`}
            value={pick.line}
            onChange={(v) => {
              pick.onLine(v);
              setNotice(pick.station ? t("metro.lineChanged") : "");
            }}
          >
            <option value="">{t("metro.linePlaceholder")}</option>
            {metroLines().map((l) => (
              <option key={l} value={l}>
                {lineLabel(l)}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <label
            htmlFor={`${id}-station`}
            className={`${FIELD_LABEL} flex h-5 items-center`}
          >
            {t("metro.station")}
          </label>
          <Select
            id={`${id}-station`}
            value={pick.station}
            onChange={(v) => {
              pick.onStation(v);
              setNotice("");
            }}
          >
            <option value="">{stationPlaceholder}</option>
            {stations.map((s) => (
              <option key={s.ko} value={s.ko}>
                {stationLabel(s, locale)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p aria-live="polite" className="mt-1 text-caption text-fg-muted">
        {notice}
      </p>
    </fieldset>
  );
}
