// 투어 플래너 여행 정보 탭의 「지역별 관광 안내」 링크. 「이동 요령」 문단은 messages Planner.info.tips
// PoC 플래너 여행 정보(channel) 탭에 박혀 있던 값을 그대로 옮겼다.
// 출처: Tour-Navigator-App/Tour Planner.dc.html 링크 1067~1073행
// 링크 이름의 영어는 PoC에 없어 뜻을 옮겨 썼다. 링크 주소는 PoC 그대로다.

type Text = { ko: string; en: string };

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
