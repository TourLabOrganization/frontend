import themeFit from "./data/theme-fit.json";
import { type Answers, QUESTION_BY_ID } from "./questions";
import type { ClusterId, ClusterResult } from "./scoring";

// 추천 대상 테마. 테마 이름은 messages의 Themes.<slug>.name에 있다.
// data/theme-fit.json은 Tour-Navigator-App/테마 추천 알고리즘/data/derived/ 에서 실제 테마 5개만 발췌한 것이다.
//   - fit(군집별 적합 점수, C1~C10) · night(야경 장소 비율) · share(카테고리 구성 비율): calc2.json P[테마]
//   - rl(연령별 지역 선호 배율, ages 순서) · treg(테마 지역): survey.json RL · TREG
//   - ages: survey.json AGES (Q1 보기 순서와 같다)
//   - faReg(외래객 군집별 지역 방문 비율, 테마 지역만): fa.json reg
// share 순서는 categories와 같다 (calc2.py CATS). "[가상]" 테마는 옮기지 않았다.

export const REGION_IDS = [
  "seoul",
  "busan",
  "gangwon",
  "gyeongbuk",
  "gyeongnam",
  "jeju",
] as const;

export type RegionId = (typeof REGION_IDS)[number];

/** calc2.py의 CATS 순서. messages의 Result.categories 키로 쓴다 */
export const CATEGORY_IDS = [
  "history",
  "healing",
  "activity",
  "local-food",
  "nature",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type ThemeFit = {
  fit: Record<ClusterId, number>;
  night: number;
  share: number[];
  /** survey.json RL[테마]. 값 순서는 AGES(= Q1 보기 순서) */
  rl: number[];
  /** survey.json TREG[테마]. faReg의 키 */
  treg: string[];
};

export type Theme = {
  slug: ThemeSlug;
  /** calc2.json의 키 */
  key: string;
  /** 출처: Tour-Navigator-App/테마 추천 알고리즘/data/derived/survey.json TREG */
  regions: readonly RegionId[];
} & ThemeFit;

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
  ...themeFit.themes[meta.key],
}));

export function findTheme(slug: string): Theme | undefined {
  return THEMES.find((theme) => theme.slug === slug);
}

// ── 최종 점수 ───────────────────────────────────────────────────────
// 출처: Tour-Navigator-App/테마 추천 알고리즘/src/calc2.py 26~33행
//   최종(t, c) = fit[t][c] + 0.5 × (Σ share[t][i] (i ∈ 고른 관심사의 분류) + (야경을 골랐으면 night[t])) + 지역보정(t, c)
//   지역보정: 군집이 C7~C10이면 freg(t, c), 아니면 reg(t, 연령 index). 둘 다 ±0.05로 자른다.

/** 관심사 가산 계수. calc2.py `.5*(…)` */
export const INTEREST_WEIGHT = 0.5;
/** 지역보정 계수와 상한. calc2.py `max(-.05,min(.05,.1*(…-1)))` */
export const REGION_WEIGHT = 0.1;
export const REGION_CAP = 0.05;

/**
 * Q4 관심사 → 분류 index (CATEGORY_IDS 순서).
 * calc2.py 예시 사용자의 ints로 확인했다 (A 역사+자연 [0,1], B 체험+바다 [2,4], C 맛집+역사 [3,0] 등).
 * drama · performance · shopping-beauty는 대응 분류가 없어 가산 0이다. night는 야경 가산(night)이다.
 */
export const INTEREST_CATEGORY: Readonly<Record<string, number>> = {
  history: 0,
  nature: 1,
  activity: 2,
  "food-market": 3,
  sea: 4,
};
export const NIGHT_INTEREST = "night";

/** 지역보정에 외래객 방문 비율(freg)을 쓰는 군집. calc2.py에서 ai가 군집 문자열인 사용자 */
const FOREIGN_CLUSTERS: readonly ClusterId[] = ["C7", "C8", "C9", "C10"];

/** 점수에 쓰는 사용자 입력 */
export type ScoreProfile = {
  /** 고른 관심사의 분류 index (calc2.py ints) */
  interests: number[];
  /** 야경을 골랐는지 (calc2.py night) */
  night: boolean;
  /** Q1 보기 index (calc2.py ai). 답이 없으면 null → 국내 군집의 지역보정 0 */
  ageIndex: number | null;
};

export function profileFromAnswers(answers: Answers): ScoreProfile {
  const q4 = answers.q4 ?? [];
  const interests = q4
    .map((option) => INTEREST_CATEGORY[option])
    .filter((i): i is number => i !== undefined);
  const age = answers.q1?.[0];
  // Q1 보기 순서 = survey.json AGES 순서 (teens=0 … 70s-plus=6)
  const ageIndex =
    age === undefined ? -1 : QUESTION_BY_ID.q1.options.indexOf(age);
  return {
    interests,
    night: q4.includes(NIGHT_INTEREST),
    ageIndex: ageIndex < 0 ? null : ageIndex,
  };
}

const clamp = (x: number) => Math.max(-REGION_CAP, Math.min(REGION_CAP, x));

type FaRegion = { all: number } & Partial<Record<ClusterId, number>>;
const FA_REG = themeFit.faReg as Readonly<Record<string, FaRegion>>;

/** calc2.py reg(t, ai): 국내 연령별 지역 선호 배율 */
export function ageRegionAdjust(theme: ThemeFit, ageIndex: number): number {
  return clamp(REGION_WEIGHT * (theme.rl[ageIndex] - 1));
}

/** calc2.py freg(t, c): 외래객 군집의 테마 지역 방문 비율 ÷ 외래객 전체 비율 */
export function foreignRegionAdjust(
  theme: ThemeFit,
  cluster: ClusterId,
): number {
  const regions = theme.treg.filter((r) => r in FA_REG);
  const a = regions.reduce((acc, r) => acc + FA_REG[r].all, 0);
  const b = regions.reduce((acc, r) => acc + (FA_REG[r][cluster] ?? 0), 0);
  return clamp(REGION_WEIGHT * (b / a - 1));
}

export type ScoreBreakdown = {
  fit: number;
  interest: number;
  region: number;
  total: number;
};

/** 한 군집 기준 최종 점수 */
export function themeScore(
  theme: ThemeFit,
  cluster: ClusterId,
  profile: ScoreProfile,
): ScoreBreakdown {
  const fit = theme.fit[cluster];
  const interest =
    INTEREST_WEIGHT *
    (profile.interests.reduce((acc, i) => acc + theme.share[i], 0) +
      (profile.night ? theme.night : 0));
  const region = FOREIGN_CLUSTERS.includes(cluster)
    ? foreignRegionAdjust(theme, cluster)
    : profile.ageIndex === null
      ? 0
      : ageRegionAdjust(theme, profile.ageIndex);
  // calc2.py 정렬 키 x[1]+x[2]+x[3] 와 같은 순서로 더한다
  return { fit, interest, region, total: fit + interest + region };
}

export type ThemeEvidence = {
  /** 점수를 낸 군집. 섞을 때는 상위 두 군집 */
  fitClusters: ClusterId[];
  /** 최종 점수 순위 (1부터) */
  rank: number;
  /** 최종 점수 구성 (섞을 때는 확률 가중 평균) */
  breakdown: ScoreBreakdown;
  /** 야경 장소 비율. 야경을 고른 사람에게만 보인다(calc2.py도 이때만 night를 점수에 더한다). 0이면 null */
  night: number | null;
  /**
   * 보여 줄 카테고리 구성비.
   * 고른 관심사에 대응하는 분류가 있으면 그중 이 테마 구성비가 가장 큰 분류(matched = true),
   * 없거나 그 분류의 장소가 0%면 이 테마에서 가장 큰 분류.
   */
  category: { id: CategoryId; share: number; matched: boolean };
};

export type RankedTheme = {
  slug: string;
  score: number;
  regions: readonly RegionId[];
  evidence: ThemeEvidence;
};

/**
 * 테마 순위. 대표 군집 기준 최종 점수(themeScore)로 매긴다.
 * 섞을 때(1위 확률 < 0.5)는 상위 두 군집의 최종 점수를 두 군집 확률로 가중 평균한다.
 */
export function rankThemes<T extends ThemeFit & { slug: string }>(
  clusters: readonly ClusterResult[],
  mixed: boolean,
  themes: readonly (T & { regions?: readonly RegionId[] })[],
  profile: ScoreProfile,
): RankedTheme[] {
  const picks = clusters.slice(0, mixed ? 2 : 1);
  if (picks.length === 0) return [];
  const totalWeight = picks.reduce((a, p) => a + p.probability, 0);
  const fitClusters = picks.map((p) => p.id);

  return themes
    .map((theme) => {
      const parts = picks.map((p) => ({
        weight: p.probability / totalWeight,
        score: themeScore(theme, p.id, profile),
      }));
      const breakdown =
        parts.length === 1
          ? parts[0].score
          : weighted(parts.map((p) => [p.weight, p.score]));
      return { theme, breakdown };
    })
    .sort((a, b) => b.breakdown.total - a.breakdown.total)
    .map(({ theme, breakdown }, index) => ({
      slug: theme.slug,
      score: breakdown.total,
      regions: theme.regions ?? [],
      evidence: {
        fitClusters,
        rank: index + 1,
        breakdown,
        night: profile.night && theme.night > 0 ? theme.night : null,
        category: pickCategory(theme.share, profile.interests),
      },
    }));
}

function weighted(parts: [number, ScoreBreakdown][]): ScoreBreakdown {
  const sum = (key: keyof ScoreBreakdown) =>
    parts.reduce((acc, [w, s]) => acc + w * s[key], 0);
  return {
    fit: sum("fit"),
    interest: sum("interest"),
    region: sum("region"),
    total: sum("total"),
  };
}

function pickCategory(
  share: readonly number[],
  interests: readonly number[],
): ThemeEvidence["category"] {
  const candidates = interests.length > 0 ? interests : share.map((_, i) => i);
  let best = candidates[0];
  for (const i of candidates) if (share[i] > share[best]) best = i;
  // 고른 관심사 분류의 장소가 이 테마에 없으면(0%) 근거가 되지 않는다. 테마에서 가장 큰 분류를 보인다
  if (interests.length > 0 && share[best] === 0) return pickCategory(share, []);
  return {
    id: CATEGORY_IDS[best],
    share: share[best],
    matched: interests.length > 0,
  };
}
