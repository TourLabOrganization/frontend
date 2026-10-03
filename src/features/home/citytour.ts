import {
  type Answers,
  evaluate,
  type Interest,
  type TypeId,
} from "../recommend/survey";
import { indirectPreference } from "../recommend/theme-index";

// 홈 「지역 시티투어」의 데이터 가공. 순수 함수만 둔다.
// 카드 분류 칩 규칙은 팀장 목업(2026-09-27 standalone 「Tour Navigator.html」 홈 renderVals의 KW · prof · tags)을 옮겼다.
// 내 유형 추천(recommendTours)은 명세서 integrated 6.5 §16의 코스 점수와 관심사별 1자리 보장이다(Data-Analytics reference_calc/recommend_reference.py와 같은 식).
// 데이터는 data/citytour.json(scripts/build-citytour.mjs가 PoC data/citytour.json으로 만든다)과
// data/citytour-scores.json(scripts/build-citytour-scores.mjs가 Data-Analytics eligible_courses.csv로 만든다). 둘 다 손으로 고치지 않는다

export type CityTour = {
  /** 운영 도시(시군) 한국어 이름(원천의 도시 = 운영 지자체 · 출발지) */
  region: string;
  /** 실제 여행지 도시들(경유지 순, 비지 않는다). 대개 운영 도시 하나. 서울 출발 EG투어버스는 경기 각지(citytour-match.ts TOUR_VISITS). 지역별 검색 · 집계 · 여행 정보 탭은 이것으로 */
  visits: string[];
  /** 노선명(원천 한국어) */
  name: string;
  /** loop 순환형 · fixed 코스형 */
  kind: "loop" | "fixed";
  /** 탑승지 */
  board: string;
  /** 경유지(원천 문자열, 「→」로 잇는다) */
  route: string;
  /** 첫차 · 막차 HH:MM. 없으면 "" */
  first: string;
  last: string;
  /** 요금(원천 문자열) */
  fare: string;
  tel: string;
  /** 홈페이지(http · https만). 없으면 "" */
  url: string;
  /** 기준일 YYYY-MM-DD */
  date: string;
  /** 코스빌더에 넣을 때의 코스 도시(첫 장소의 locKo). 넣을 장소가 없으면 null */
  city: string | null;
  /** 코스빌더에 넣을 투어 플래너 장소 id(경유 순서). 없으면 빈 배열 */
  placeIds: string[];
};

/** 경유지 분류. 목업 CAT 순서(역사 · 자연 · 체험 · 먹거리 · 바다)와 같다. 간접 선호 u(recommend/theme-index.ts)도 이 순서다 */
export const TOUR_CATEGORIES = [
  "history",
  "nature",
  "activity",
  "food",
  "sea",
] as const;
export type TourCategory = (typeof TOUR_CATEGORIES)[number];
export type TourTag = TourCategory | "night";

// 목업 KW. 경유지 이름에 이 말이 들어가면 그 분류로 센다(한 경유지가 여러 분류에 들 수 있다)
const KEYWORDS: readonly RegExp[] = [
  /궁|성곽|읍성|산성|사찰|[가-힣]사$|향교|서원|박물관|유적|고분|릉|왕|역사|문화재|한옥|민속|전통|사지|탑|기념관/,
  /산$|산 |숲|수목원|공원|호수|저수지|계곡|습지|정원|폭포|자연|생태|휴양림|둘레길|꽃|농원|수변/,
  /체험|테마파크|랜드|케이블카|레일|짚|루지|월드|과학관|전망대|스카이|목장|놀이/,
  /시장|먹거리|맛|음식|카페|막걸리|와이너리|양조|빵|맥주|술/,
  /해수욕장|해변|[가-힣]항$|바다|섬|포구|해안|등대|해상|해양|방조제/,
];
const NIGHT = /야간|야경|나이트|밤|야시장|달빛|별빛/;

export type TourProfile = {
  /** 분류별 경유지 비율(TOUR_CATEGORIES 순서) */
  share: readonly number[];
  /** 노선명 · 경유지에 야간 말이 있으면 true */
  night: boolean;
  /** 경유지 수 */
  stops: number;
};

/** 노선의 분류 구성(목업 prof). 경유지는 → · - · , · 「·」로 나누고 괄호를 뗀다 */
export function tourProfile(
  tour: Pick<CityTour, "name" | "route">,
): TourProfile {
  const stops = tour.route
    .split(/→|->|-|,|·/)
    .map((s) => s.replace(/\(.*?\)/g, "").trim())
    .filter(Boolean);
  const counts = KEYWORDS.map(
    (re) => stops.filter((stop) => re.test(stop)).length,
  );
  const n = Math.max(1, stops.length);
  return {
    share: counts.map((c) => c / n),
    night: NIGHT.test(tour.name + tour.route),
    stops: stops.length,
  };
}

/** 카드의 분류 칩(목업 tags). 비율 높은 분류 두 개, 야간이면 야경을 맨 앞에. 최대 두 개 */
export function tourTags(profile: TourProfile): TourTag[] {
  const top: TourTag[] = profile.share
    .map((value, k) => ({ value, k }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((x) => TOUR_CATEGORIES[x.k]);
  return (profile.night ? (["night", ...top] as TourTag[]) : top).slice(0, 2);
}

/** S4 관심사 → 경유지 분류(목업 QS[3].cat). 드라마 · 공연 · 쇼핑은 분류가 없다 */
const INTEREST_TAG: Readonly<Partial<Record<Interest, TourTag>>> = {
  history: "history",
  nature: "nature",
  sea: "sea",
  "food-market": "food",
  activity: "activity",
  night: "night",
};

/** 내 유형 추천에 쓰는 추천 결과 요약 */
export type TypeProfile = {
  /** 최종 후보 E(recommend/survey.ts). 첫 유형 이름이 목록 제목에 보인다 */
  types: TypeId[];
  /** 간접 선호 u(TOUR_CATEGORIES 순서, 합 1. recommend/theme-index.ts indirectPreference) */
  preference: readonly number[];
  /** S4 두 관심사의 경유지 분류(관심사 순서). 드라마 · 공연 · 쇼핑은 분류가 없어 빠진다(0~2개) */
  tags: TourTag[];
  /** S3 여행 속도 가산 방향: 빡빡하게 → 방문지 많은 코스, 천천히 → 적은 코스. 적당히면 null */
  pace: "packed" | "relaxed" | null;
  /** S6 「저녁 · 밤까지」이고 S4에 야경이 없으면 야경 코스 가산(S4에 야경이 있으면 관심사 항이 이미 야경이다) */
  eveningNight: boolean;
};

/**
 * 분석 적격 코스의 점수 자료(data/citytour-scores.json 한 칸). 경로 해석 · 경유지 연결 · 범주 분류를 거친 값이다.
 * 목업 분류(tourProfile)는 한 경유지가 여러 분류에 들어 커버리지 ≤ 1이 성립하지 않아 점수에 쓰지 않는다
 */
export type CourseScoreProfile = {
  /** 분석 코스 id(Data-Analytics analysis_course_id). 점수가 같으면 이 순서로 보인다 */
  id: string;
  /** 범주 비중(역사 · 자연 · 체험 · 음식 · 바다). 합이 coverage */
  shares: readonly number[];
  /** 범주 분류 커버리지(0~1] */
  coverage: number;
  /** 방문 후보 수 */
  visits: number;
  /** 야경 코스 */
  night: boolean;
};

/** 추천 답으로 유형 요약을 만든다. 완료된 응답이 아니면(예전 15문항 기록 포함) null */
export function typeProfile(answers: Answers): TypeProfile | null {
  const result = evaluate(answers);
  if (result.status !== "complete") return null;
  return {
    types: result.types,
    preference: indirectPreference(result),
    tags: result.interests.flatMap((i) => {
      const tag = INTEREST_TAG[i];
      return tag ? [tag] : [];
    }),
    pace:
      answers.s3 === "packed" || answers.s3 === "relaxed" ? answers.s3 : null,
    eveningNight:
      answers.s6 === "evening" && !result.interests.includes("night"),
  };
}

/** 추천 개수(목업: 5개) */
export const RECOMMEND_COUNT = 5;

/** 가산 계수(명세서 §16 course_score). 관심사는 테마 지수와 같은 0.5, 야경 · 여행 속도는 0.1 */
const INTEREST_WEIGHT = 0.5;
const NIGHT_WEIGHT = 0.1;
const PACE_WEIGHT = 0.1;

export type CourseScore = {
  /** cos(u, p) */
  cosine: number;
  /** 범주 적합 = 100 · cos · coverage(가산 전) */
  fit: number;
  /** 최종 점수 = 100 · (cos · coverage + Σ w · b) / (1 + Σ w). 적용되는 가산 항만 분모에 넣어 늘 0~100 */
  score: number;
};

/**
 * 코스 점수(명세서 §16, recommend_reference.recommend의 코스 부분).
 * - 관심사(0.5): S4 두 관심사 중 분류가 있는 것의 평균. 역사 · 자연 · 체험 · 음식 · 바다는 그 범주 비중, 야경은 야경 코스 여부.
 *   드라마 · 공연 · 쇼핑은 분류가 없어 빠지고, 둘 다 없으면 항이 없다
 * - 야경(0.1): S6 저녁 · 밤까지이고 S4에 야경이 없으면 야경 코스 여부
 * - 여행 속도(0.1): 방문 후보 3곳 이하 0 ~ 8곳 이상 1인 길이 L. 빡빡하게는 L, 천천히는 1 − L
 */
export function courseScore(
  profile: CourseScoreProfile,
  type: TypeProfile,
): CourseScore {
  const u = type.preference;
  const p = profile.shares;
  const norm = (v: readonly number[]) => Math.hypot(...v);
  const cosine =
    u.reduce((sum, x, k) => sum + x * p[k], 0) / (norm(u) * norm(p));
  const night = Number(profile.night);
  const length = Math.min(Math.max((profile.visits - 3) / 5, 0), 1);
  const terms: [number, number][] = [];
  if (type.tags.length > 0) {
    const interest =
      type.tags.reduce(
        (sum, tag) =>
          sum + (tag === "night" ? night : p[TOUR_CATEGORIES.indexOf(tag)]),
        0,
      ) / type.tags.length;
    terms.push([INTEREST_WEIGHT, interest]);
  }
  if (type.eveningNight) terms.push([NIGHT_WEIGHT, night]);
  if (type.pace !== null)
    terms.push([PACE_WEIGHT, type.pace === "packed" ? length : 1 - length]);
  const bonus = terms.reduce((sum, [w, b]) => sum + w * b, 0);
  const scale = 1 + terms.reduce((sum, [w]) => sum + w, 0);
  const fit = cosine * profile.coverage;
  return { cosine, fit: 100 * fit, score: (100 * (fit + bonus)) / scale };
}

/** 추천 한 줄: 노선 · 코스 점수 · 이 노선이 채운 관심사 보장 자리(보장 자리가 아니면 null) */
export type TourPick<T> = {
  tour: T;
  profile: CourseScoreProfile;
  reservedFor: TourTag | null;
} & CourseScore;

/** 이 코스가 관심사 보장 자리를 채울 수 있는지: 야경은 야경 코스, 분류는 그 비중이 가장 큰 코스(같은 최댓값이면 모두) */
function serves(profile: CourseScoreProfile, tag: TourTag): boolean {
  if (tag === "night") return profile.night;
  const max = Math.max(...profile.shares);
  return profile.shares[TOUR_CATEGORIES.indexOf(tag)] >= max - 1e-12;
}

/**
 * 내 유형 추천: 분석 적격 코스(profiles가 null이 아닌 노선)만 코스 점수(courseScore)로 정렬해 한 지역에 한 노선씩 5개.
 * 점수가 같으면 cos, 커버리지가 큰 순, 그다음 분석 코스 id 순이다(명세서 참조 계산과 같은 순서).
 * 관심사별 1자리 보장(추천 6.5): 분류가 있는 관심사마다 그 관심사를 채울 수 있는 코스(serves) 중 가장 앞 코스로
 * 한 자리를 먼저 채우고(아직 뽑지 않은 지역만), 남은 자리를 순위대로 채운 뒤 순위 순서로 돌려준다.
 * profiles는 tours와 같은 순서(data/citytour-scores.json)
 */
export function recommendTourPicks<
  T extends Pick<CityTour, "region" | "visits">,
>(
  tours: readonly T[],
  type: TypeProfile,
  profiles: readonly (CourseScoreProfile | null)[],
): TourPick<T>[] {
  const scored = tours
    .flatMap((tour, i) => {
      const profile = profiles[i];
      return profile ? [{ tour, profile, ...courseScore(profile, type) }] : [];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.cosine - a.cosine ||
        b.profile.coverage - a.profile.coverage ||
        (a.profile.id < b.profile.id
          ? -1
          : a.profile.id > b.profile.id
            ? 1
            : 0),
    );

  // 한 지역에서 한 노선. 지역은 명세서 §16 · Data-Analytics 참조 계산과 같이 운영 도시(region)다(실제 여행지 visits가 아니다:
  // 참조 계산과 같은 결과를 지키려고. 서울 출발 EG투어버스 12노선은 여기서 「서울」 한 지역이다)
  const seen = new Set<string>();
  const picked = new Map<number, TourTag | null>();
  for (const tag of type.tags) {
    const i = scored.findIndex(
      (x) => !seen.has(x.tour.region) && serves(x.profile, tag),
    );
    if (i < 0) continue;
    picked.set(i, tag);
    seen.add(scored[i].tour.region);
  }
  for (let i = 0; i < scored.length && picked.size < RECOMMEND_COUNT; i++) {
    if (seen.has(scored[i].tour.region)) continue;
    picked.set(i, null);
    seen.add(scored[i].tour.region);
  }
  return [...picked.keys()]
    .sort((a, b) => a - b)
    .map((i) => ({ ...scored[i], reservedFor: picked.get(i) ?? null }));
}

/** 내 유형 추천의 노선만(recommendTourPicks 순서) */
export function recommendTours<T extends Pick<CityTour, "region" | "visits">>(
  tours: readonly T[],
  type: TypeProfile,
  profiles: readonly (CourseScoreProfile | null)[],
): T[] {
  return recommendTourPicks(tours, type, profiles).map((x) => x.tour);
}

/** 노선의 대표 지역 = 첫 여행지(visits[0]), 없으면 운영 도시 */
export function tourRegion(tour: Pick<CityTour, "region" | "visits">): string {
  return tour.visits[0] ?? tour.region;
}

/** 노선이 이 도시를 여행하는지(지역별 검색 · 여행 정보 탭) */
export function visitsCity(
  tour: Pick<CityTour, "region" | "visits">,
  city: string,
): boolean {
  return tour.visits.length > 0
    ? tour.visits.includes(city)
    : tour.region === city;
}

/** 지역별 노선 수(여행지 기준: 여러 도시를 도는 노선은 도시마다 센다). 처음 나온 순서 */
export function regionCounts(
  tours: readonly Pick<CityTour, "region" | "visits">[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tours)
    for (const c of t.visits.length > 0 ? t.visits : [t.region])
      m.set(c, (m.get(c) ?? 0) + 1);
  return m;
}

/** 운행 시간 「9:30–18:00」(목업 hm: 앞자리 0을 뗀다). 둘 다 없으면 "" */
export function tourHours(tour: Pick<CityTour, "first" | "last">): string {
  const hm = (v: string) => {
    const m = v.match(/^(\d{1,2}):?(\d{2})/);
    return m ? `${Number(m[1])}:${m[2]}` : "";
  };
  return [hm(tour.first), hm(tour.last)].filter(Boolean).join("–");
}

/**
 * 요금 문구. 숫자만 있는 값(「88」 「19000」)은 단위를 알 수 없어 보이지 않는다(null).
 * 목업은 그대로 「· 88」로 보인다
 */
export function tourFare(tour: Pick<CityTour, "fare">): string | null {
  const fare = tour.fare.trim();
  return fare && !/^\d+$/.test(fare) ? fare : null;
}

/**
 * 경로 접기 기준(카드의 경로는 3줄까지만 보인다): 줄 수를 자른(line-clamp) 글의 전체 높이가 보이는 높이보다 크면 잘린 것이다.
 * 글꼴 · 폭마다 줄바꿈이 달라 글자 수가 아니라 그려진 높이로 판단한다. 반올림 차이(1px)는 넘친 것으로 보지 않는다
 */
export function routeOverflows(scrollHeight: number, clientHeight: number) {
  return scrollHeight - clientHeight > 1;
}
