// 투어 플래너 날짜 계산. 장소 데이터를 불러오지 않아서 ME처럼 가벼워야 하는 곳도 쓴다

/** 여행 일수 상한. 날짜 칸이 이보다 긴 여행을 막는다 */
export const MAX_TRIP_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const isoTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** 두 날짜(YYYY-MM-DD)의 날 수 차이 */
function daysBetween(start: string, end: string): number {
  return Math.round((isoTime(end) - isoTime(start)) / DAY_MS);
}

/** YYYY-MM-DD에 n일을 더한 날짜 */
export function addDays(iso: string, n: number): string {
  return new Date(isoTime(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

export type DateError = "order" | "tooLong" | null;

/** 귀가일 검사. 귀가일 < 출발일 · 여행 일수 > MAX_TRIP_DAYS */
export function dateError(start: string, end: string): DateError {
  const diff = daysBetween(start, end);
  if (diff < 0) return "order";
  if (diff + 1 > MAX_TRIP_DAYS) return "tooLong";
  return null;
}

/** 여행 일수. 날짜가 없거나 잘못되면 1(당일) */
export function tripDays(start: string | null, end: string | null): number {
  if (!start || !end || dateError(start, end)) return 1;
  return daysBetween(start, end) + 1;
}
