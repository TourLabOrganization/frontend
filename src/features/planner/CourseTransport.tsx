import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import type { TravelMode } from "@/features/course/schedule";
import type { LocalMode, WideMode } from "./course-store";
import type { WideOption } from "./schedule";

// 칸 하나. 고른 칸은 파란 면 + 체크 표시(색만으로 나누지 않는다), 고를 수 없는 칸은 회색 면 + 이유.
// 고를 수 없는 칸도 disabled 대신 aria-disabled로 두어 초점이 닿고 이유(aria-describedby)를 읽게 한다
const CELL =
  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-center text-label leading-snug transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none";
const CELL_ON =
  "bg-primary-weak font-semibold text-primary-strong ring-2 ring-inset ring-primary";
const CELL_OFF =
  "bg-surface font-medium text-fg ring-1 ring-inset ring-line active:bg-fill";
const CELL_BLOCKED = "cursor-not-allowed bg-fill font-medium text-fg-muted";

type CourseTransportProps = {
  options: readonly WideOption[];
  /** 실제로 쓰는 광역 교통. 없으면 null */
  wide: WideMode | null;
  /** 실제로 쓰는 현지 이동 */
  local: TravelMode;
  originName: string;
  hubName: string | null;
  destinationName: string | null;
  /** 광역 접근 시간 문구(「약 2시간 8분」). 광역 교통이 없으면 null */
  accessDuration: string | null;
  onWide: (mode: WideMode) => void;
  onLocal: (mode: LocalMode) => void;
};

// 코스 탭 01 광역 교통 · 02 현지 이동 (목업 순서 · 칸 수 그대로)
export function CourseTransport({
  options,
  wide,
  local,
  originName,
  hubName,
  destinationName,
  accessDuration,
  onWide,
  onLocal,
}: CourseTransportProps) {
  const t = useTranslations("Planner.course");
  const id = useId();
  const wideHeading = `${id}-wide`;
  const localHeading = `${id}-local`;
  const noCityId = `${id}-nocity`;
  const noCity = options.every((o) => o.block === "noCity");

  return (
    <>
      <section aria-labelledby={wideHeading}>
        <h3 id={wideHeading} className="text-body-lg font-bold">
          <span aria-hidden className="mr-2 text-primary tabular-nums">
            01
          </span>
          {t("wide.heading")}
        </h3>
        {noCity && (
          <p id={noCityId} className="mt-1 text-label text-fg-muted">
            {t("wide.reason.noCity")}
          </p>
        )}
        <div
          role="group"
          aria-labelledby={wideHeading}
          className="mt-3 grid grid-cols-3 gap-2"
        >
          {options.map((o) => {
            const label = t(`wide.modes.${o.choice}`);
            const on = wide === o.mode;
            const reasonId = `${id}-${o.choice}`;
            const reason =
              o.block === "origin"
                ? t("wide.reason.origin", { origin: originName, mode: label })
                : o.block === "hub"
                  ? t("wide.reason.hub", { hub: hubName ?? "", mode: label })
                  : o.block === "island"
                    ? t("wide.reason.island")
                    : null;
            return (
              <button
                key={o.choice}
                type="button"
                aria-pressed={on}
                aria-disabled={o.block ? true : undefined}
                aria-label={label}
                aria-describedby={
                  o.block === "noCity"
                    ? noCityId
                    : reason
                      ? reasonId
                      : undefined
                }
                onClick={() => {
                  if (!o.block) onWide(o.mode);
                }}
                className={`${CELL} ${o.block ? CELL_BLOCKED : on ? CELL_ON : CELL_OFF}`}
              >
                <span className="flex items-center gap-1">
                  {on && <Check size={16} className="shrink-0" aria-hidden />}
                  {label}
                </span>
                {reason && (
                  <>
                    <span aria-hidden className="text-micro font-normal">
                      {t(
                        `wide.short.${o.block as "origin" | "hub" | "island"}`,
                      )}
                    </span>
                    <span id={reasonId} className="sr-only">
                      {reason}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        <p aria-live="polite" className="mt-2 text-label text-fg-muted">
          {wide && accessDuration && hubName
            ? t("wide.access", {
                origin: originName,
                hub: hubName,
                duration: accessDuration,
              })
            : !wide && destinationName && !noCity
              ? t("wide.none", { city: destinationName })
              : ""}
        </p>
      </section>

      <section aria-labelledby={localHeading} className="mt-6">
        <h3 id={localHeading} className="text-body-lg font-bold">
          <span aria-hidden className="mr-2 text-primary tabular-nums">
            02
          </span>
          {t("local.heading")}
        </h3>
        <div
          role="group"
          aria-labelledby={localHeading}
          className={`mt-3 grid gap-2 ${local === "own" ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {local === "own" ? (
            // 광역이 자가용이면 현지도 자가용 하나뿐이라 고를 것이 없다. 버튼이 아닌 표시로 둔다
            <p className={`${CELL} ${CELL_ON}`}>
              <span className="flex items-center gap-1">
                <Check size={16} className="shrink-0" aria-hidden />
                {t("local.own")}
              </span>
            </p>
          ) : (
            (["driving", "transit"] as const).map((m) => {
              const on = local === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onLocal(m)}
                  className={`${CELL} ${on ? CELL_ON : CELL_OFF}`}
                >
                  <span className="flex items-center gap-1">
                    {on && <Check size={16} className="shrink-0" aria-hidden />}
                    {t(`local.${m}`)}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {local === "own" && (
          <p className="mt-2 text-label text-fg-muted">{t("local.ownNote")}</p>
        )}
      </section>
    </>
  );
}
