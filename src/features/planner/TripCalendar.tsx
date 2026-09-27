"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import {
  type DateRange,
  dayMark,
  isPickable,
  isPickingEnd,
  monthCells,
  moveDay,
  moveMonth,
  pickDate,
  shiftMonth,
  yearMonth,
} from "./calendar";
import { MAX_TRIP_DAYS } from "./dates";

const NAV_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none";

// 일요일(2026-09-27)부터 한 주. 요일 이름을 Intl로 만든다
const WEEK_BASE = Date.UTC(2026, 8, 27);

type TripCalendarProps = {
  /** 저장된 출발일 · 귀가일(없으면 null). 귀가일이 null이면 귀가일을 고르는 중이다 */
  range: DateRange;
  /** 오늘(YYYY-MM-DD) */
  today: string;
  onChange: (range: DateRange) => void;
};

// 출발일 · 귀가일 달력(PoC calendarDays). 첫 누름 = 출발일, 두 번째 누름 = 귀가일. 규칙은 calendar.ts.
// 키보드: 날짜 칸 하나만 Tab으로 닿고(roving tabindex), 화살표로 하루 · 한 주, Home · End로 주 처음 · 끝,
// PageUp · PageDown으로 한 달 옮긴다. Enter · Space로 고른다(버튼 기본 동작).
// 칸 이름은 날짜 전체(요일 포함) + 오늘 · 출발일 · 귀가일 · 여행 기간 표시. 고를 수 없는 날(상한을 넘음)은 aria-disabled
export function TripCalendar({ range, today, onChange }: TripCalendarProps) {
  const t = useTranslations("Planner.course.dates");
  const locale = useLocale();
  const id = useId();
  const initial = range.start ?? today;
  const [view, setView] = useState(() => yearMonth(initial));
  const [focusKey, setFocusKey] = useState(initial);
  // 키보드로 옮긴 뒤에만 초점을 옮긴다(처음 그릴 때 화면이 달력으로 튀지 않게)
  const moveFocus = useRef(false);

  const cells = monthCells(view.year, view.month);
  const inView = (key: string) => cells.includes(key);
  // 초점 칸이 보이는 달에 없으면 그 달의 출발일 · 오늘 · 1일 순으로 고른다
  const tabKey = inView(focusKey)
    ? focusKey
    : ([range.start, today].find((k) => k && inView(k)) ??
      (cells.find(Boolean) as string));

  const fmt = (key: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" }).format(
      new Date(`${key}T00:00:00Z`),
    );
  const monthTitle = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(view.year, view.month, 1)));
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(WEEK_BASE + i * 86_400_000);
    const f = (weekday: "narrow" | "long") =>
      new Intl.DateTimeFormat(locale, { weekday, timeZone: "UTC" }).format(d);
    return { short: f("narrow"), long: f("long") };
  });

  const goTo = (key: string) => {
    setFocusKey(key);
    setView(yearMonth(key));
    moveFocus.current = true;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = tabKey;
    const dow = new Date(`${k}T00:00:00Z`).getUTCDay();
    const next =
      e.key === "ArrowLeft"
        ? moveDay(k, -1)
        : e.key === "ArrowRight"
          ? moveDay(k, 1)
          : e.key === "ArrowUp"
            ? moveDay(k, -7)
            : e.key === "ArrowDown"
              ? moveDay(k, 7)
              : e.key === "Home"
                ? moveDay(k, -dow)
                : e.key === "End"
                  ? moveDay(k, 6 - dow)
                  : e.key === "PageUp"
                    ? moveMonth(k, -1)
                    : e.key === "PageDown"
                      ? moveMonth(k, 1)
                      : null;
    if (!next) return;
    e.preventDefault();
    goTo(next);
  };

  const hint = isPickingEnd(range) ? t("hintEnd") : t("hintStart");
  const hintId = `${id}-hint`;
  const titleId = `${id}-title`;

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t("prevMonth")}
          onClick={() => setView(shiftMonth(view.year, view.month, -1))}
          className={NAV_BUTTON}
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <h3
          id={titleId}
          aria-live="polite"
          className="text-body-lg font-bold tabular-nums"
        >
          {monthTitle}
        </h3>
        <button
          type="button"
          aria-label={t("nextMonth")}
          onClick={() => setView(shiftMonth(view.year, view.month, 1))}
          className={NAV_BUTTON}
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>
      <table
        role="grid"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        className="mt-2 w-full table-fixed border-collapse"
      >
        <thead>
          <tr>
            {weekdays.map((w) => (
              <th
                key={w.long}
                scope="col"
                abbr={w.long}
                className="pb-1 text-caption font-semibold text-fg-subtle"
              >
                {w.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((key, di) => {
                if (!key) return <td key={`e${di}`} />;
                const mark = dayMark(range, key);
                const pickable = isPickable(range, key, MAX_TRIP_DAYS);
                const isToday = key === today;
                const selected = mark !== null;
                const edge =
                  mark === "start" || mark === "end" || mark === "single";
                const notes = [
                  isToday && t("mark.today"),
                  mark && t(`mark.${mark}`),
                  !pickable && t("mark.blocked", { max: MAX_TRIP_DAYS }),
                ].filter(Boolean);
                // 범위 띠: 안쪽 칸과 양 끝 칸의 바깥쪽 절반을 옅은 파랑으로 잇는다
                const band =
                  mark === "inside"
                    ? "bg-primary-weak"
                    : mark === "start"
                      ? "bg-linear-to-r from-transparent from-50% to-primary-weak to-50%"
                      : mark === "end"
                        ? "bg-linear-to-l from-transparent from-50% to-primary-weak to-50%"
                        : "";
                return (
                  <td
                    key={key}
                    role="gridcell"
                    aria-selected={selected}
                    className={`p-0 py-0.5 text-center ${band}`}
                  >
                    <button
                      type="button"
                      tabIndex={key === tabKey ? 0 : -1}
                      aria-label={[
                        fmt(key, { dateStyle: "full" }),
                        ...notes,
                      ].join(", ")}
                      aria-current={isToday ? "date" : undefined}
                      aria-disabled={!pickable || undefined}
                      ref={(el) => {
                        if (el && key === tabKey && moveFocus.current) {
                          moveFocus.current = false;
                          el.focus();
                        }
                      }}
                      onFocus={() => setFocusKey(key)}
                      onClick={() => {
                        setFocusKey(key);
                        if (!pickable) return;
                        onChange(pickDate(range, key));
                      }}
                      className={`relative mx-auto flex size-11 flex-col items-center justify-center rounded-full text-label tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                        edge
                          ? "bg-primary font-bold text-white"
                          : mark === "inside"
                            ? "font-semibold text-primary-strong"
                            : pickable
                              ? "text-fg active:bg-fill"
                              : "cursor-not-allowed text-fg-disabled"
                      } ${isToday && !edge ? "font-bold ring-1 ring-primary ring-inset" : ""}`}
                    >
                      {Number(key.slice(8, 10))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p id={hintId} className="mt-2 text-caption text-fg-muted">
        {hint}
      </p>
    </div>
  );
}
