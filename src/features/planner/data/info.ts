import type { AppLocale } from "@/i18n/locales";
// 투어 플래너 여행 정보 탭의 「지역별 관광 안내」 링크. 「이동 요령」 문단은 messages Planner.info.tips
// PoC 플래너 여행 정보(channel) 탭에 박혀 있던 값을 그대로 옮겼다.
// 출처: Tour-Navigator-App/Tour Planner.dc.html 링크 1067~1073행
// 링크 이름의 영어는 PoC에 없어 뜻을 옮겨 썼다. 중 · 일 · 스페인어는 PoC TX_DICT 값, 없는 것만 옮겨 썼다.
// PoC의 공공데이터포털 · 코레일 · 기상청은 여행자에게 더 쓸모 있는 곳으로 바꿨다(대표 요청 2026-09-29):
//   공공데이터포털 → Klook(액티비티 · 입장권 예약), 코레일 → 열린관광 모두의 여행(한국관광공사 무장애 관광), 기상청 → 두루누비(한국관광공사 걷기 · 자전거 여행길)

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
    href: "https://www.klook.com/",
    label: {
      ko: "Klook(액티비티 · 입장권)",
      en: "Klook (activities & tickets)",
      zh: "Klook 客路(活动 · 门票)",
      ja: "Klook(アクティビティ · チケット)",
      es: "Klook (actividades y entradas)",
    },
  },
  {
    href: "https://access.visitkorea.or.kr/main/main.do",
    label: {
      ko: "열린관광 모두의 여행(무장애 관광)",
      en: "Travel for All (accessible tourism)",
      zh: "开放观光 人人旅行(无障碍旅游)",
      ja: "みんなの旅(バリアフリー観光)",
      es: "Viaje para todos (turismo accesible)",
    },
  },
  {
    href: "https://durunubi.kr/",
    label: {
      ko: "두루누비(걷기 · 자전거 여행길)",
      en: "Durunubi (walking & cycling trails)",
      zh: "Durunubi(徒步 · 骑行路线)",
      ja: "トゥルヌビ(ウォーキング · サイクリングコース)",
      es: "Durunubi (rutas a pie y en bicicleta)",
    },
  },
];
