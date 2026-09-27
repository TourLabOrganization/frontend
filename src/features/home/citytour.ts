import { type Answers, hasRequiredAnswers } from "../recommend/questions";
import { type ClusterId, classify } from "../recommend/scoring";

// 홈 「지역 시티투어」의 데이터 가공. 순수 함수만 둔다.
// 분류 · 내 유형 추천 규칙은 팀장 목업(2026-09-27 standalone 「Tour Navigator.html」 홈 renderVals의 KW · prof · tags · rec)을 그대로 옮겼다.
// 데이터는 data/citytour.json(scripts/build-citytour.mjs가 PoC data/citytour.json으로 만든다. 손으로 고치지 않는다)

export type CityTour = {
  /** 도시(시군) 한국어 이름 */
  region: string;
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

/** 경유지 분류. 목업 CAT 순서(역사 · 자연 · 체험 · 먹거리 · 바다)와 같다. 군집 선호 벡터도 이 순서다 */
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

/**
 * 군집 선호 벡터(역사 · 자연 · 체험 · 먹거리 · 바다). 목업 CL[3]과 PoC 「Tour Navigator Home.dc.html」 CL을 그대로 옮겼다
 */
export const CLUSTER_PREFS: Readonly<
  Record<ClusterId, readonly [number, number, number, number, number]>
> = {
  C1: [0.1, 0.1, 0.3, 0.3, 0.2],
  C2: [0.1, 0.2, 0.1, 0.3, 0.3],
  C3: [0.1, 0.1, 0.5, 0.1, 0.2],
  C4: [0.5, 0.3, 0.05, 0.15, 0],
  C5: [0.1, 0.6, 0, 0.1, 0.2],
  C6: [0.2, 0.05, 0.05, 0.7, 0],
  C7: [0.21, 0.03, 0.35, 0.27, 0.14],
  C8: [0.08, 0.26, 0, 0.44, 0.23],
  C9: [0.02, 0.33, 0.07, 0.21, 0.36],
  C10: [0.31, 0.19, 0.19, 0.13, 0.18],
};

/** Q4 관심사 → 경유지 분류(목업 QS[3].cat). 드라마 · 공연 · 쇼핑은 분류가 없다 */
const Q4_TAG: Readonly<Record<string, TourTag>> = {
  history: "history",
  nature: "nature",
  sea: "sea",
  "food-market": "food",
  activity: "activity",
  night: "night",
};

/** 내 유형 추천에 쓰는 추천 결과 요약(목업 result의 p · s2 · pr · pr2 · mix · cats) */
export type TypeProfile = {
  primary: ClusterId;
  secondary: ClusterId | null;
  /** 1위 · 2위 확률(%, 반올림) */
  pr: number;
  pr2: number;
  mixed: boolean;
  /** Q4 관심사의 경유지 분류 */
  tags: TourTag[];
};

/** 추천 답으로 유형 요약을 만든다. 필수 문항이 비었으면 null */
export function typeProfile(
  answers: Answers,
  locale: string,
): TypeProfile | null {
  if (!hasRequiredAnswers(answers)) return null;
  const { clusters, mixed } = classify(answers, locale);
  const [first, second] = clusters;
  return {
    primary: first.id,
    secondary: second?.id ?? null,
    pr: Math.round(first.probability * 100),
    pr2: second ? Math.round(second.probability * 100) : 0,
    mixed,
    tags: (answers.q4 ?? []).flatMap((o) => (Q4_TAG[o] ? [Q4_TAG[o]] : [])),
  };
}

/** 추천 개수(목업: 5개) */
export const RECOMMEND_COUNT = 5;

/**
 * 내 유형 추천(목업 rec).
 * 점수 = 적합도(분류 비율 · 1위 군집 선호의 내적. 섞기면 1위 · 2위 확률로 가중 평균)
 *      + 0.5 × Q4 관심사 분류 비율 합(야경은 야간 여부) + 경유지 3곳 이상이면 0.02.
 * 점수 높은 순으로 한 지역에 한 노선씩 5개
 */
export function recommendTours<
  T extends Pick<CityTour, "name" | "route" | "region">,
>(tours: readonly T[], type: TypeProfile): T[] {
  const w1 = CLUSTER_PREFS[type.primary];
  const w2 =
    type.mixed && type.secondary ? CLUSTER_PREFS[type.secondary] : null;
  const a1 = type.pr || 100;
  const a2 = type.pr2 || 0;
  const dot = (share: readonly number[], w: readonly number[]) =>
    share.reduce((sum, v, k) => sum + v * w[k], 0);

  const scored = tours
    .map((tour) => {
      const p = tourProfile(tour);
      let fit = dot(p.share, w1);
      if (w2) fit = (a1 * fit + a2 * dot(p.share, w2)) / (a1 + a2);
      const bonus =
        0.5 *
        type.tags.reduce(
          (sum, tag) =>
            sum +
            (tag === "night"
              ? Number(p.night)
              : p.share[TOUR_CATEGORIES.indexOf(tag)]),
          0,
        );
      return { tour, score: fit + bonus + (p.stops >= 3 ? 0.02 : 0) };
    })
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: T[] = [];
  for (const { tour } of scored) {
    if (seen.has(tour.region)) continue;
    seen.add(tour.region);
    out.push(tour);
    if (out.length >= RECOMMEND_COUNT) break;
  }
  return out;
}

/** 지역별 노선 수. 처음 나온 순서 */
export function regionCounts(
  tours: readonly Pick<CityTour, "region">[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tours) m.set(t.region, (m.get(t.region) ?? 0) + 1);
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
