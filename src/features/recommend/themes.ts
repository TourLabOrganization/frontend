import themeFit from "./data/theme-fit.json";

// 추천 대상 테마와 화면에 보일 메타데이터. 테마 이름은 messages의 Themes.<slug>.name에 있다.
// 테마 순위(추천 점수)는 백엔드 POST /api/v1/recommend 결과를 그대로 쓴다(features/recommend/api.ts).
// data/theme-fit.json은 Tour-Navigator-App/테마 추천 알고리즘/data/derived/calc2.json P[테마]의
// night(야경 장소 비율)만 실제 테마 5개에 대해 발췌한 것이다. 야경 배지 표시에만 쓴다.

export const REGION_IDS = [
  "seoul",
  "busan",
  "gangwon",
  "gyeongbuk",
  "gyeongnam",
  "jeju",
] as const;

export type RegionId = (typeof REGION_IDS)[number];

/**
 * 관심 카테고리. messages의 Result.categories 키로 쓴다.
 * 순서는 추천 API의 cats 순서와 같다(features/recommend/api.ts API_CATS, api.test.ts가 고정한다)
 */
export const CATEGORY_IDS = [
  "history",
  "healing",
  "activity",
  "local-food",
  "nature",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type Theme = {
  slug: ThemeSlug;
  /** 추천 API 응답의 테마 이름(RecommendThemeResponse.theme) */
  key: string;
  /** 출처: Tour-Navigator-App/테마 추천 알고리즘/data/derived/survey.json TREG */
  regions: readonly RegionId[];
  /** 야경 장소 비율 (calc2.json P[테마].night) */
  night: number;
};

const THEME_META = [
  { slug: "kings-warden", key: "왕과 사는 남자", regions: ["gangwon"] },
  { slug: "kpop-demon-hunters", key: "케이팝 데몬 헌터스", regions: ["seoul"] },
  {
    slug: "rescene-route",
    key: "RESCENE Route",
    regions: ["gyeongbuk", "gyeongnam"],
  },
  { slug: "jeju-k-drama", key: "제주 K-Drama", regions: ["jeju"] },
  { slug: "busan-film-trip", key: "부산 영화 기행", regions: ["busan"] },
] as const satisfies readonly {
  slug: string;
  key: keyof typeof themeFit.themes;
  regions: readonly RegionId[];
}[];

export type ThemeSlug = (typeof THEME_META)[number]["slug"];

export const THEMES: readonly Theme[] = THEME_META.map((meta) => ({
  ...meta,
  night: themeFit.themes[meta.key].night,
}));

export function findTheme(slug: string): Theme | undefined {
  return THEMES.find((theme) => theme.slug === slug);
}

/** 추천 API의 테마 이름 → 우리 테마. 목록에 없는 테마(「[가상] …」 등)면 undefined */
export function findThemeByKey(key: string): Theme | undefined {
  return THEMES.find((theme) => theme.key === key);
}

/**
 * Q4 관심사 → 분류 index (CATEGORY_IDS 순서 = 추천 API cats 순서).
 * calc2.py 예시 사용자의 ints로 확인했다 (A 역사+자연 [0,1], B 체험+바다 [2,4], C 맛집+역사 [3,0] 등).
 * drama · performance · shopping-beauty는 대응 분류가 없다. night는 야경 선호(night)로 따로 보낸다.
 */
export const INTEREST_CATEGORY: Readonly<Record<string, number>> = {
  history: 0,
  nature: 1,
  activity: 2,
  "food-market": 3,
  sea: 4,
};
export const NIGHT_INTEREST = "night";
