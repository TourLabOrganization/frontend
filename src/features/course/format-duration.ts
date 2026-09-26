export type DurationKey = "duration.m" | "duration.h" | "duration.hm";

/**
 * 분을 "1시간 30분" 꼴로. 문구는 messages의 Course.duration에 있다.
 * translate에는 useTranslations("Course") · getTranslations("Course")의 t를 그대로 넘긴다
 */
export function formatDuration(
  translate: (key: DurationKey, values: { h: number; m: number }) => string,
  min: number,
): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const key: DurationKey =
    h === 0 ? "duration.m" : m === 0 ? "duration.h" : "duration.hm";
  return translate(key, { h, m });
}
