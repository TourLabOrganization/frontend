// 투어 플래너 여행 정보 탭의 「이동 요령」 문단과 「지역별 관광 안내」 링크.
// PoC 플래너 여행 정보(channel) 탭에 박혀 있던 값을 그대로 옮겼다.
// 출처: Tour-Navigator-App/Tour Planner.dc.html  이동 요령 1062~1065행 · 링크 1067~1073행
// 이동 요령 · 링크 이름의 영어는 PoC에 없어 뜻을 옮겨 썼다. 링크 주소는 PoC 그대로다.

type Text = { ko: string; en: string };

export const PLANNER_TIPS: Text = {
  ko: "지역 탭을 바꾸면 그 지역의 장소와 광역 교통편이 함께 바뀝니다. 코스 탭에서 날짜와 출발지를 정하면 하루 단위 동선과 이동 시간이 계산되고, 1박 이상이면 각 날짜에 숙소 후보와 예약 버튼이 붙습니다. 제주는 항공편, 그 외 지역은 KTX·SRT·고속버스 기준으로 계산합니다.",
  en: "Switching the region tab changes both the places and the long-distance transport for that region. Set your dates and departure point in the Course tab to get a day-by-day route with travel times; for trips of one night or more, each day also gets lodging options and booking buttons. Jeju is planned by flight, and other regions by KTX, SRT or express bus.",
};

export type PlannerLink = { href: string; label: Text };

export const PLANNER_LINKS: readonly PlannerLink[] = [
  {
    href: "https://korean.visitkorea.or.kr",
    label: { ko: "대한민국 구석구석", en: "VisitKorea" },
  },
  {
    href: "https://www.data.go.kr",
    label: { ko: "공공데이터포털", en: "Public Data Portal" },
  },
  {
    href: "https://www.letskorail.com",
    label: { ko: "코레일", en: "Korail" },
  },
  {
    href: "https://www.weather.go.kr",
    label: { ko: "기상청", en: "Weather (KMA)" },
  },
];
