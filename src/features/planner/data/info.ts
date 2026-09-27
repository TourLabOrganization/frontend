import type { AppLocale } from "@/i18n/locales";
// 투어 플래너 여행 정보 탭의 「지역별 관광 안내」 링크. 「이동 요령」 문단은 messages Planner.info.tips
// PoC 플래너 여행 정보(channel) 탭에 박혀 있던 값을 그대로 옮겼다.
// 출처: Tour-Navigator-App/Tour Planner.dc.html 링크 1067~1073행
// 링크 이름의 영어는 PoC에 없어 뜻을 옮겨 썼다. 중 · 일 · 스페인어는 PoC TX_DICT 값, 없는 것(공공데이터포털 · 코레일 · 기상청)만 옮겨 썼다. 링크 주소는 PoC 그대로다.

type Text = Record<AppLocale, string>;

export type PlannerLink = { href: string; label: Text };

export const PLANNER_LINKS: readonly PlannerLink[] = [
  {
    href: "https://korean.visitkorea.or.kr",
    label: {
      ko: "대한민국 구석구석",
      en: "VisitKorea",
      zh: "韩国旅游(韩文)",
      ja: "大韓民国くまなく(韓国語)",
      es: "Visit Korea (coreano)",
    },
  },
  {
    href: "https://www.data.go.kr",
    label: {
      ko: "공공데이터포털",
      en: "Public Data Portal",
      zh: "公共数据门户",
      ja: "公共データポータル",
      es: "Portal de Datos Públicos",
    },
  },
  {
    href: "https://www.letskorail.com",
    label: {
      ko: "코레일",
      en: "Korail",
      zh: "Korail",
      ja: "Korail",
      es: "Korail",
    },
  },
  {
    href: "https://www.weather.go.kr",
    label: {
      ko: "기상청",
      en: "Weather (KMA)",
      zh: "韩国气象厅",
      ja: "韓国気象庁",
      es: "Meteorología (KMA)",
    },
  },
];
