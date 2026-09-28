// 추천 대상 테마와 화면에 보일 메타데이터. 테마 이름은 messages의 Themes.<slug>.name에 있다.
// 순서는 명세서 integrated 6.2 §14 테마 구성표의 순서이고, 적합도 지수가 같을 때의 순서다(theme-index.ts rankThemes).
// 테마 구성(5범주 · 야경 비중)은 theme-index.ts에 있다.

export const REGION_IDS = [
  "seoul",
  "busan",
  "gangwon",
  "gyeongbuk",
  "gyeongnam",
  "jeju",
] as const;

export type RegionId = (typeof REGION_IDS)[number];

export type Theme = {
  slug: ThemeSlug;
  /** 출처: Tour-Navigator-App/테마 추천 알고리즘/data/derived/survey.json TREG */
  regions: readonly RegionId[];
};

const THEME_META = [
  { slug: "kings-warden", regions: ["gangwon"] },
  { slug: "kpop-demon-hunters", regions: ["seoul"] },
  { slug: "rescene-route", regions: ["gyeongbuk", "gyeongnam"] },
  { slug: "jeju-k-drama", regions: ["jeju"] },
  { slug: "busan-film-trip", regions: ["busan"] },
] as const satisfies readonly {
  slug: string;
  regions: readonly RegionId[];
}[];

export type ThemeSlug = (typeof THEME_META)[number]["slug"];

export const THEMES: readonly Theme[] = THEME_META;

export function findTheme(slug: string): Theme | undefined {
  return THEMES.find((theme) => theme.slug === slug);
}
