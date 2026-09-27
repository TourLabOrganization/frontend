import { addDays } from "./dates";

// 코스 빌더 날짜 달력의 순수 함수. 고르는 규칙은 PoC Tour Planner.dc.html calendarDays의 pick을 그대로 옮겼다.
//  - 출발일이 없거나 범위가 이미 다 골라져 있으면: 누른 날이 새 출발일, 귀가일은 비운다(귀가일 고르는 중)
//  - 출발일만 있을 때 같은 날을 누르면 당일(출발일 = 귀가일)
//  - 출발일보다 이른 날을 누르면 그 날이 출발일, 원래 출발일이 귀가일
//  - 늦은 날을 누르면 그 날이 귀가일
// 여행 일수 상한(MAX_TRIP_DAYS)은 PoC에 없어서, 귀가일을 고르는 중에 상한을 넘는 날만 고를 수 없게 한다(isPickable).
// 날짜는 모두 YYYY-MM-DD 문자열이다(시간대와 무관하게 비교 · 계산한다).

export type DateRange = {
  /** 출발일. 없으면 null */
  start: string | null;
  /** 귀가일. 없으면 null(출발일만 고른 상태, 일정은 당일로 계산한다) */
  end: string | null;
};

export function pickDate(range: DateRange, key: string): DateRange {
  const { start, end } = range;
  if (!start || end) return { start: key, end: null };
  if (key === start) return { start: key, end: key };
  return key < start ? { start: key, end: start } : { start, end: key };
}

/** 귀가일을 고르는 중인지(출발일만 있음) */
export function isPickingEnd(range: DateRange): boolean {
  return range.start !== null && range.end === null;
}

/** 두 날짜로 만드는 여행 일수(앞뒤 순서와 무관) */
function spanDays(a: string, b: string): number {
  const ms = Math.abs(
    Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`),
  );
  return Math.round(ms / 86_400_000) + 1;
}

/** 이 날을 누를 수 있는지. 귀가일을 고르는 중이면 출발일과 합쳐 maxDays를 넘는 날은 안 된다 */
export function isPickable(
  range: DateRange,
  key: string,
  maxDays: number,
): boolean {
  if (!isPickingEnd(range)) return true;
  return spanDays(range.start!, key) <= maxDays;
}

export type DayMark = "start" | "end" | "single" | "inside" | null;

/** 달력 칸 표시. single은 당일(출발일 = 귀가일)이거나 출발일만 고른 상태 */
export function dayMark(range: DateRange, key: string): DayMark {
  const { start, end } = range;
  if (!start) return null;
  if (!end || end === start) return key === start ? "single" : null;
  if (key === start) return "start";
  if (key === end) return "end";
  return key > start && key < end ? "inside" : null;
}

/** 그 달의 날짜 칸. 일요일부터 한 주 7칸, 달 밖 칸은 null. month는 0~11 */
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  const iso = first.toISOString().slice(0, 10);
  for (let d = 0; d < days; d++) cells.push(addDays(iso, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** YYYY-MM-DD의 연 · 월(0~11) */
export function yearMonth(key: string): { year: number; month: number } {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 };
}

/** 연 · 월에 delta달을 더한다 */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const n = year * 12 + month + delta;
  return { year: Math.floor(n / 12), month: ((n % 12) + 12) % 12 };
}

/** 키보드 이동: 날짜에 n일을 더한다(달을 넘어가도 된다) */
export const moveDay = addDays;

/** 한 달 뒤 · 앞의 같은 날(그 달에 없으면 마지막 날) */
export function moveMonth(key: string, delta: number): string {
  const { year, month } = yearMonth(key);
  const next = shiftMonth(year, month, delta);
  const last = new Date(Date.UTC(next.year, next.month + 1, 0)).getUTCDate();
  const day = Math.min(Number(key.slice(8, 10)), last);
  return `${next.year}-${String(next.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
