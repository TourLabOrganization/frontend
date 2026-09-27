// 숙박 장소 운영시간의 「15:00 IN / 11:00 OUT」(PoC hrs 원문)을 화면 언어의 체크인 · 체크아웃 문구로 바꿔 보인다.
// 데이터는 그대로 두고 표시만 바꾼다. 그 꼴이 아니면(「체크인 15:00 · 전화」, 영업시간 등) 원문 그대로

type StayLabels = {
  checkIn: (time: string) => string;
  checkOut: (time: string) => string;
};

const IN_OUT = /^\s*(\d{1,2}:\d{2})\s*IN\s*\/\s*(\d{1,2}:\d{2})\s*OUT\s*$/i;

export function formatStayHours(text: string, label: StayLabels): string {
  const m = IN_OUT.exec(text);
  if (!m) return text;
  return `${label.checkIn(m[1])} · ${label.checkOut(m[2])}`;
}
