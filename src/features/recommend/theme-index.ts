import type { Interest, SurveyResult, TypeId } from "./survey";
import { type ThemeSlug, THEMES } from "./themes";

// 명세서 6.4 추천 연결(§13~§15): 최종 유형 E · α → 5범주 간접 선호 u → 테마 적합도 지수. 순수 함수만 둔다.
// 정본: 팀 명세서 integrated 6.4(2026-09-29)의 참조 계산(Data-Analytics reference_calc/recommend_reference.recommend의 테마 부분)을 옮겼다.
// data-server가 API를 내면 그 API를 부르도록 바꿀 임시본이다(docs/api.md).
// 지역 가산 G · 한류 H · 연령 A · 인구통계 D는 신규 설문만으로 필수 입력을 얻을 수 없어 0이다(§14 · §29 · §30).
// 지수는 구성 적합도 순서이고 확률 · 퍼센트가 아니다(§15). 지역 시티투어 코사인 점수(§16)와 더하지 않는다

/** 5범주. 명세서 표 순서(역사 · 자연 · 체험 · 음식 · 바다) = 앱 분류 id(messages Course.categories) */
export const CATEGORIES = ["herit", "heal", "activity", "food", "sea"] as const;
export type Category = (typeof CATEGORIES)[number];

/** 5범주 값(CATEGORIES 순서) */
type CategoryVector = readonly [number, number, number, number, number];

/**
 * 유형별 범주 프로필 W(명세서 §13 표 = 기존 앱의 유형 프로필, PoC 「Tour Navigator Home.dc.html」 CL과 같은 값).
 * 개정 이름에 맞춰 다시 추정한 값이 아니다(§13). C9는 추천 6.3 개정값(바다 0.50 · 자연 0.30 · 음식 0.11)이다. 합이 1이 아닌 유형(C8 1.01)이 있어 행 합으로 나눠 쓴다.
 * 홈 시티투어 내 유형 추천(features/home/citytour.ts)도 이 표로 만든 간접 선호(indirectPreference)를 쓴다
 */
export const TYPE_PROFILES: Readonly<Record<TypeId, CategoryVector>> = {
  C1: [0.1, 0.1, 0.3, 0.3, 0.2],
  C2: [0.1, 0.2, 0.1, 0.3, 0.3],
  C3: [0.1, 0.1, 0.5, 0.1, 0.2],
  C4: [0.5, 0.3, 0.05, 0.15, 0],
  C5: [0.1, 0.6, 0, 0.1, 0.2],
  C6: [0.2, 0.05, 0.05, 0.7, 0],
  C7: [0.21, 0.03, 0.35, 0.27, 0.14],
  C8: [0.08, 0.26, 0, 0.44, 0.23],
  C9: [0.02, 0.3, 0.07, 0.11, 0.5],
  C10: [0.31, 0.19, 0.19, 0.13, 0.18],
};

/**
 * 테마 구성표(명세서 §14 표 값을 소수 셋째 자리 그대로): 5범주 장소 비중과 야경 비중.
 * 5범주는 합으로 나눠 쓴다(케이팝 데몬 헌터스 합 0.999). 야경은 5범주 합에 넣지 않는 별도 속성이라 나누지 않는다.
 * 예전 data/theme-fit.json(PoC calc2.json의 야경 비율)과 야경 값이 같다(0.0556 ↔ 0.056 등)
 */
const THEME_COMPOSITION: Readonly<
  Record<ThemeSlug, { categories: CategoryVector; night: number }>
> = {
  "kings-warden": { categories: [0.4, 0.311, 0.233, 0.056, 0], night: 0.056 },
  "kpop-demon-hunters": {
    categories: [0.293, 0.228, 0.216, 0.253, 0.009],
    night: 0.128,
  },
  "rescene-route": {
    categories: [0.328, 0.165, 0.13, 0.193, 0.184],
    night: 0.058,
  },
  "jeju-k-drama": {
    categories: [0.165, 0.437, 0.084, 0.052, 0.262],
    night: 0.037,
  },
  "busan-film-trip": {
    categories: [0.141, 0.245, 0.152, 0.265, 0.197],
    night: 0.141,
  },
};

/**
 * S4 관심사 → 테마 지수의 관심사 항 r(§14). 역사 · 자연 · 체험 · 음식 · 바다는 그 범주 비중(합으로 나눈 값), 야경은 야경 비중.
 * 드라마 · 공연 · 쇼핑은 대응 열이 없어 null이다: r = 0이고 「관심사 자료 없음」(명세서 additional_metadata_required)
 */
export const INTEREST_TERM: Readonly<
  Record<Interest, Category | "night" | null>
> = {
  drama: null,
  performance: null,
  history: "herit",
  nature: "heal",
  sea: "sea",
  "food-market": "food",
  activity: "activity",
  night: "night",
  "shopping-beauty": null,
};

/** 관심사 항 계수. 기존 선호 · 관심사 항의 상대 계수 1 : 0.5를 유지한 설계값(§14) */
const INTEREST_WEIGHT = 0.5;
/** 최대 가능 합(1 + 0.5). 이 값으로 나눠 0~100 지수를 만든다 */
const INDEX_SCALE = 1 + INTEREST_WEIGHT;

function normalize(values: readonly number[]): number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  return values.map((v) => v / sum);
}

/** W̃_c: 유형 프로필을 행 합으로 나눈 값(합 1) */
export function normalizedTypeProfile(type: TypeId): number[] {
  return normalize(TYPE_PROFILES[type]);
}

/**
 * 간접 선호 u = Σ_{c∈E} α_c · W̃_c (CATEGORIES 순서, 합 1).
 * 새 설문은 5범주 선호를 직접 묻지 않는다. 유형 결과를 기존 프로필로 옮긴 간접 선호다(명세서 q_source = type_profile_prior).
 * 분기 점수 변화는 E와 α를 거쳐 u에 반영된다. PCA 점수나 방한 의향 확률로 읽지 않는다(§13)
 */
export function indirectPreference(
  result: Pick<SurveyResult, "types" | "alpha">,
): number[] {
  const u = [0, 0, 0, 0, 0];
  for (const c of result.types) {
    const alpha = result.alpha[c] ?? 0;
    normalizedTypeProfile(c).forEach((w, j) => (u[j] += alpha * w));
  }
  return u;
}

export type ThemeScore = {
  slug: ThemeSlug;
  /** p̃_t: 5범주 비중을 합으로 나눈 값(CATEGORIES 순서, 합 1) */
  shares: number[];
  /** 야경 장소 비중(나누지 않은 표 값) */
  night: number;
  /** F_t = u · p̃_t (범주 적합도) */
  fit: number;
  /** r_t (관심사 항). 관심사 자료가 없으면 0 */
  interest: number;
  /** ThemeIndex_t = 100 · (F_t + 0.5 · r_t) / 1.5 (0~100) */
  index: number;
  /** 화면에 나눠 보이는 기여: 유형 = 100 · F / 1.5, 관심사 = 100 · 0.5r / 1.5. 둘의 합이 index */
  typePart: number;
  interestPart: number;
};

/** 테마 5개의 적합도 지수. 지수 내림차순, 같으면 THEMES 순서(= 명세서 표 순서). 화면은 상위 3개를 보인다 */
export function rankThemes(
  result: Pick<SurveyResult, "types" | "alpha" | "interest">,
): ThemeScore[] {
  const u = indirectPreference(result);
  const term = INTEREST_TERM[result.interest];
  return THEMES.map((theme, order) => {
    const { categories, night } = THEME_COMPOSITION[theme.slug];
    const shares = normalize(categories);
    const fit = shares.reduce((sum, p, j) => sum + u[j] * p, 0);
    const interest =
      term === null
        ? 0
        : term === "night"
          ? night
          : shares[CATEGORIES.indexOf(term)];
    const typePart = (100 * fit) / INDEX_SCALE;
    const interestPart = (100 * INTEREST_WEIGHT * interest) / INDEX_SCALE;
    return {
      order,
      score: {
        slug: theme.slug,
        shares,
        night,
        fit,
        interest,
        index: typePart + interestPart,
        typePart,
        interestPart,
      },
    };
  })
    .sort((a, b) => b.score.index - a.score.index || a.order - b.order)
    .map(({ score }) => score);
}

/**
 * 카드에 보일 분류 비중(p̃ 값): S4 관심사에 대응 분류가 있고 이 테마의 그 비중이 0보다 크면 그 분류,
 * 아니면(야경 · 자료 없는 관심사 · 비중 0) 이 테마에서 가장 큰 분류(같으면 CATEGORIES 앞 분류)
 */
export function featuredCategory(
  theme: Pick<ThemeScore, "shares">,
  interest: Interest,
): { category: Category; share: number } {
  const term = INTEREST_TERM[interest];
  if (term !== null && term !== "night") {
    const share = theme.shares[CATEGORIES.indexOf(term)];
    if (share > 0) return { category: term, share };
  }
  let best = 0;
  theme.shares.forEach((share, j) => {
    if (share > theme.shares[best]) best = j;
  });
  return { category: CATEGORIES[best], share: theme.shares[best] };
}
