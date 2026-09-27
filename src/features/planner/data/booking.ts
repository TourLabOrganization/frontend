// 투어 플래너 코스 탭 아래쪽 예매 링크(목업: KTX 예매 · SRT 예매 · 버스 예매 · 렌트카 예매 ▾ · 숙박 예매 ▾).
// 주소는 PoC Tour Planner.dc.html에서 옮긴 값이다. 숙박 검색(Agoda · Booking.com)은 도시 영어 이름을 ss=에 넣는다.
// 링크 이름은 messages Planner.course.booking에 있다(키 = label).

export type BookingLink = {
  label:
    | "ktx"
    | "srt"
    | "bus"
    | "air"
    | "ship"
    | "metro"
    | "lotte"
    | "socar"
    | "yanolja"
    | "goodchoice"
    | "agoda"
    | "bookingCom";
  href: string;
};

export const TRANSPORT_LINKS: readonly BookingLink[] = [
  { label: "ktx", href: "https://www.letskorail.com" },
  { label: "srt", href: "https://etk.srail.kr/main.do" },
  { label: "bus", href: "https://txbus.t-money.co.kr/" },
];

/**
 * 일자별 일정의 광역 구간(출발지 → 관문, 관문 → 출발지) 예매 버튼. 광역 교통 수단에 맞는 링크 하나(PoC transBtns).
 * KTX · SRT · 버스는 위 TRANSPORT_LINKS를 그대로 쓰고, 항공 · 배 · 지하철은 PoC transBtns의 주소다. 자가용은 예매가 없다
 */
export function wideBookingLink(mode: string): BookingLink | null {
  const same = TRANSPORT_LINKS.find((l) => l.label === mode);
  if (same) return same;
  if (mode === "air")
    return { label: "air", href: "https://flight.naver.com/" };
  if (mode === "ship")
    return { label: "ship", href: "https://island.haewoon.co.kr/" };
  if (mode === "metro")
    return {
      label: "metro",
      href: "https://www.letskorail.com/ebizbf/EbizBfMetroTimeTable.do",
    };
  return null;
}

export const RENT_LINKS: readonly BookingLink[] = [
  {
    label: "lotte",
    href: "https://www.lotterentacar.net/hp/kor/reserve/short/reserve.do",
  },
  { label: "socar", href: "https://www.socar.kr/" },
];

/** 숙박 예매. cityEn: 도시 영어 이름(없으면 빈 문자열) */
export function stayLinks(cityEn: string): BookingLink[] {
  const q = encodeURIComponent(cityEn);
  return [
    { label: "yanolja", href: "https://www.yanolja.com/" },
    { label: "goodchoice", href: "https://www.goodchoice.kr/" },
    { label: "agoda", href: `https://www.agoda.com/search?ss=${q}` },
    {
      label: "bookingCom",
      href: `https://www.booking.com/searchresults.html?ss=${q}`,
    },
  ];
}
