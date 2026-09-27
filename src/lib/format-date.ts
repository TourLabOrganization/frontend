// 날짜만 있는 값(YYYY-MM-DD, 시티투어 기준일 등)을 화면 언어의 보통 길이 날짜로 쓴다.
// 시티투어 카드(홈) · 플래너 여행 정보 탭 · 머리줄 알림이 함께 쓴다.
// 시각이 없는 값이라 UTC 자정으로 읽고 UTC로 쓴다. 기기 시간대로 읽으면 서쪽 시간대에서 하루 밀린다

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD → 「2026. 9. 27.」 · 「Sep 27, 2026」 …. 모양이 다르거나 없는 날짜면 받은 그대로 */
export function formatDate(ymd: string, locale: string): string {
  const m = YMD.exec(ymd);
  if (!m) return ymd;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  // 2026-02-30처럼 넘치는 날짜는 다음 달로 넘어가므로 되돌려 확인한다
  if (new Date(t).toISOString().slice(0, 10) !== ymd) return ymd;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(t);
}
