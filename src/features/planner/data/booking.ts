// 투어 플래너 코스 탭 아래쪽 예매 링크(목업: KTX 예매 · SRT 예매 · 버스 예매 · 렌트카 예매 ▾ · 숙박 예매 ▾).
// 주소는 PoC Tour Planner.dc.html에서 옮긴 값이다. 숙박 예매는 PoC stayBookings · coursePanelBookings(체크인 · 체크아웃 · 검색어 · 언어).
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
    | "skRent"
    | "socar"
    | "rentalcars"
    | "yanolja"
    | "goodchoice"
    | "agoda"
    | "bookingCom"
    | "airbnb"
    | "tripCom";
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

/**
 * 렌트카 예매 4곳(PoC rentSites 순서): 롯데렌터카 · SK렌터카 · 쏘카 · Rentalcars.
 * Rentalcars는 화면 언어를 preflang으로 넘긴다(PoC: 중 · 일 · 스페인어는 그 언어, 나머지는 en)
 */
export function rentBookingLinks(locale: string): BookingLink[] {
  const preflang =
    locale === "zh" || locale === "ja" || locale === "es" ? locale : "en";
  return [
    {
      label: "lotte",
      href: "https://www.lotterentacar.net/hp/kor/reserve/short/reserve.do",
    },
    {
      label: "skRent",
      href: "https://www.skcarrental.com/rent/short/main.do",
    },
    { label: "socar", href: "https://www.socar.kr/" },
    {
      label: "rentalcars",
      href: `https://www.rentalcars.com/?preflang=${preflang}`,
    },
  ];
}

/** YYYY-MM-DD에 n일을 더한 로컬 날짜. toISOString은 쓰지 않는다(한국 시간 자정이 UTC 전날이라 하루 밀린다) */
export function addLocalDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * 코스 전체 숙박 예매의 체크인 · 체크아웃(PoC coursePanelBookings).
 * 체크인 = 출발 · 귀가일 중 이른 날(없으면 오늘), 체크아웃 = 늦은 날(같거나 없으면 체크인 다음 날)
 */
export function tripStayDates(
  start: string | null,
  end: string | null,
  today: string,
): { checkIn: string; checkOut: string } {
  const a = start;
  const b = end ?? start;
  const lo = a && b ? (a < b ? a : b) : null;
  const hi = a && b ? (a < b ? b : a) : null;
  const checkIn = lo ?? today;
  const checkOut = hi && hi !== lo ? hi : addLocalDays(checkIn, 1);
  return { checkIn, checkOut };
}

/** 예약 사이트 언어 인자(PoC lc). Trip.com은 경로 언어(ko · zh · ja · en) */
function bookingLang(locale: string): string {
  return locale === "ko"
    ? "ko"
    : locale === "zh"
      ? "zh_CN"
      : locale === "ja"
        ? "ja"
        : "en";
}
function tripComLang(locale: string): string {
  return locale === "ko" || locale === "zh" || locale === "ja" ? locale : "en";
}

/**
 * 숙박 예매 6곳(PoC stayBookings · coursePanelBookings): Booking · Agoda · Airbnb · 야놀자 · 여기어때 · Trip.com.
 * query: 검색어(인코딩 전), checkIn · checkOut: YYYY-MM-DD, locale: 화면 언어
 */
export function stayBookingLinks({
  query,
  checkIn,
  checkOut,
  locale,
}: {
  query: string;
  checkIn: string;
  checkOut: string;
  locale: string;
}): BookingLink[] {
  const q = encodeURIComponent(query);
  const lc = bookingLang(locale);
  return [
    {
      label: "bookingCom",
      href: `https://www.booking.com/searchresults.html?ss=${q}&checkin=${checkIn}&checkout=${checkOut}&lang=${lc}`,
    },
    {
      label: "agoda",
      href: `https://www.agoda.com/search?ss=${q}&checkIn=${checkIn}&checkOut=${checkOut}&lang=${lc}`,
    },
    {
      label: "airbnb",
      href: `https://www.airbnb.com/s/${q}/homes?checkin=${checkIn}&checkout=${checkOut}`,
    },
    { label: "yanolja", href: `https://www.yanolja.com/search/${q}` },
    {
      label: "goodchoice",
      href: `https://www.goodchoice.kr/product/search/${q}`,
    },
    {
      label: "tripCom",
      href: `https://www.trip.com/${tripComLang(locale)}/hotels/list?checkin=${checkIn}&checkout=${checkOut}&city=${q}`,
    },
  ];
}
