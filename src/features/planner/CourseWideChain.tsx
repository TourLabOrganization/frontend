import {
  Bus,
  Car,
  ChevronDown,
  ExternalLink,
  type LucideIcon,
  MapPin,
  Plane,
  Ship,
  TrainFront,
  TramFront,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { buttonClassName } from "@/components/ui/Button";
import { formatDuration } from "@/features/course/format-duration";
import type { BookingLink } from "./data/booking";
import { directionsBetweenUrl } from "./directions";
import type { ChainSide, HubLeg } from "./schedule";
import { type ChainMode, type ChainPoint, chainPoints } from "./wide-chain";

/** 카드 머리 아이콘. 본 구간 수단을 따른다(카페리는 본 구간이 ship) */
const MODE_ICON: Record<ChainMode, LucideIcon> = {
  metro: TramFront,
  ktx: TrainFront,
  srt: TrainFront,
  bus: Bus,
  air: Plane,
  ship: Ship,
  own: Car,
};

const hmT = (t: number) =>
  `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(((t % 60) + 60) % 60).padStart(2, "0")}`;

const LINK = `${buttonClassName({ variant: "secondary", size: "md" })} shrink-0 bg-surface active:bg-line`;

type CourseWideChainProps = {
  direction: "out" | "back";
  side: ChainSide;
  /** 본 구간 수단에 맞는 예매 링크(PoC transBtns). 자가용은 없다 */
  link: BookingLink | null;
  /** 다른 광역 경로가 있을 때 「경로 변경」(PoC chainIn/OutAlt). 없으면 null */
  onRouteChange: (() => void) | null;
  /** 환승 관문 고르기(PoC chainIn/OutGw). 후보 이름 · 바꾸기 */
  gatewayName: (key: string) => string;
  onGateway: (key: string) => void;
};

// 일자별 일정의 광역 체인(PoC dayPlan chainIn · chainOut). 첫날 위에 가는 길, 마지막 날 아래에 돌아오는 길.
// 시각 · 장소 · 설명 행(출발 / KTX 2시간 8분 후 도착 / 환승 15분 → 10:30 탑승 / 도착 관문), 예매 버튼,
// 다른 경로 n개 · 경로 변경, 환승 관문 고르기, 안내 한 줄. 자가용은 한 구간만(PoC wideChain 자가용 분기)
export function CourseWideChain({
  direction,
  side,
  link,
  onRouteChange,
  gatewayName,
  onGateway,
}: CourseWideChainProps) {
  const t = useTranslations("Planner.course");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const id = useId();
  const out = direction === "back";
  const nm = (p: ChainPoint) => (locale === "ko" ? p.ko : p.en || p.ko);
  const duration = (min: number) => formatDuration(tc, min);
  const { chain, schedule } = side;
  const names = chainPoints(chain, side.origin, out).map(nm);
  const own = chain.mode === "own";
  const headingId = `${id}-heading`;
  const ModeIcon = MODE_ICON[chain.mode];

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-48 flex-1 items-start gap-3">
        <ModeIcon
          size={20}
          aria-hidden
          className="mt-0.5 shrink-0 text-fg-muted"
        />
        <p id={headingId} className="min-w-0 text-label">
          <span className="block text-caption font-semibold text-fg-muted">
            {t(`legs.${direction}`)}
          </span>
          <span className="block font-semibold text-fg">
            {names.join(" → ")}
          </span>
          {own && (
            <span className="block text-fg-muted">
              {t("legs.access", {
                mode: t("chain.modes.own"),
                duration: duration(schedule.end - schedule.steps[0].t),
              })}
            </span>
          )}
        </p>
      </div>
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          {t(`booking.${link.label}`)}
          <ExternalLink size={16} className="shrink-0" aria-hidden />
          <span className="sr-only">{t("booking.newWindow")}</span>
        </a>
      )}
    </div>
  );

  if (own)
    return (
      <section
        aria-labelledby={headingId}
        className="mt-3 rounded-2xl bg-fill p-4"
      >
        {header}
      </section>
    );

  const mode = (m: string) => t(`chain.modes.${m as "bus"}`);
  const n = schedule.steps.length;
  const rows = schedule.steps.map((x, k) => {
    const nx = schedule.steps[k + 1];
    const parts: string[] = [];
    if (x.first) parts.push(t(out ? "chain.leave" : "chain.depart"));
    else if (x.leg)
      parts.push(
        t("chain.ride", {
          mode: mode(x.leg.mode),
          duration: duration(x.leg.min),
        }),
      );
    if (x.wait && nx?.leg && x.depAt !== undefined)
      parts.push(
        t(x.first ? "chain.wait" : "chain.transfer", {
          duration: duration(x.wait),
          time: hmT(x.depAt),
          mode: mode(nx.leg.mode),
        }),
      );
    else if (x.first && nx?.leg)
      parts.push(t("chain.board", { mode: mode(nx.leg.mode) }));
    if (k === n - 1) parts.push(t(out ? "chain.home" : "chain.arrive"));
    return { time: hmT(x.t), place: nm(x.place), note: parts.join(" · ") };
  });
  const gwCur = side.gatewayKey ?? "";

  return (
    <section
      aria-labelledby={headingId}
      className="mt-3 rounded-2xl bg-fill p-4"
    >
      {header}
      <ol className="mt-3">
        {rows.map((r, k) => (
          <li
            key={k}
            className="grid grid-cols-[3rem_1rem_minmax(0,1fr)] gap-x-2"
          >
            <span className="pt-0.5 text-label font-semibold text-fg tabular-nums">
              {r.time}
            </span>
            <span aria-hidden className="flex flex-col items-center">
              <span
                className={`mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-primary ${k === 0 || k === n - 1 ? "bg-primary" : "bg-surface"}`}
              />
              {k < n - 1 && <span className="w-0.5 flex-1 bg-line" />}
            </span>
            <p className="min-w-0 pb-3 text-label">
              <span className="block font-semibold text-fg">{r.place}</span>
              <span className="block text-fg-muted">{r.note}</span>
            </p>
          </li>
        ))}
      </ol>
      {onRouteChange && side.cands.length > 1 && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-label text-fg-muted">
            {t("chain.alt", { count: side.cands.length - 1 })}
          </p>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={onRouteChange}
            className={LINK}
          >
            {t("chain.routeChange")}
          </button>
        </div>
      )}
      {side.gateways.length > 1 && (
        <div className="mt-3">
          <label
            htmlFor={`${id}-gw`}
            className="text-caption font-semibold text-fg-muted"
          >
            {t("chain.gateway")}
          </label>
          <div className="relative mt-1">
            <select
              id={`${id}-gw`}
              value={gwCur}
              onChange={(e) => onGateway(e.target.value)}
              className="h-12 w-full min-w-0 appearance-none rounded-xl bg-surface pr-10 pl-4 text-body text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
            >
              {side.gateways.map((k) => (
                <option key={k} value={k}>
                  {gatewayName(k)}
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
      )}
      <p className="mt-3 text-caption text-fg-muted">{t("chain.note")}</p>
    </section>
  );
}

/** 도착 관문 → 첫 장소(PoC arr*): 「≈ 대중교통 N분 · x km」와 길찾기(새 창) */
export function CourseArrivalLeg({
  leg,
  placeName,
}: {
  leg: HubLeg;
  placeName: string;
}) {
  const t = useTranslations("Planner.course");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const hubName = locale === "ko" ? leg.hub.ko : leg.hub.en || leg.hub.ko;
  const href = directionsBetweenUrl(
    { name: hubName, lat: leg.hub.lat, lng: leg.hub.lng },
    { name: placeName, lat: leg.place.lat, lng: leg.place.lng },
    leg.mode,
    locale,
  );
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl p-4 ring-1 ring-line">
      <div className="flex min-w-48 flex-1 items-start gap-3">
        <MapPin
          size={20}
          aria-hidden
          className="mt-0.5 shrink-0 text-primary"
        />
        <p className="min-w-0 text-label">
          <span className="block text-caption font-semibold text-primary">
            {t("chain.arrivalTag")}
          </span>
          <span className="block font-semibold text-fg">
            {t("legs.route", { from: hubName, to: placeName })}
          </span>
          <span className="block text-fg-muted tabular-nums">
            {t("chain.arrivalSub", {
              mode: t(`chain.arrivalModes.${leg.mode}`),
              duration: formatDuration(tc, leg.min),
              km: leg.km.toFixed(1),
            })}
          </span>
        </p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("chain.directionsLabel", {
          from: hubName,
          to: placeName,
        })}
        className={LINK}
      >
        {t("chain.directions")}
        <ExternalLink size={16} className="shrink-0" aria-hidden />
      </a>
    </div>
  );
}
