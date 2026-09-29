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

/**
 * 운영시간 칸의 연락처 이름(원문 「문의」와 그 번역) → 뒤에 붙일 쌍점. 중 · 일은 전각 쌍점을 붙여 쓴다.
 * 대표 요청(2026-09-28): 칸에 여백이 있어 연락처는 줄을 바꿔 보이고, 이름 뒤에 쌍점을 붙인다(「Contact: 054-…」)
 */
const CONTACT_COLON: Readonly<Record<string, string>> = {
  문의: ": ",
  Contact: ": ",
  Contacto: ": ",
  咨询电话: "：",
  お問い合わせ: "：",
};
const CONTACT = new RegExp(` · (${Object.keys(CONTACT_COLON).join("|")}) `);

/** 연락처 앞의 「 · 」를 줄바꿈으로 바꾸고 이름 뒤에 쌍점을 붙인다. 연락처가 없으면 그대로. 칸은 whitespace-pre-line으로 그린다 */
export function breakBeforeContact(text: string): string {
  return text.replace(
    CONTACT,
    (_, label: string) => `\n${label}${CONTACT_COLON[label]}`,
  );
}
