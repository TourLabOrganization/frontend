import {
  type Answers,
  evaluate,
  type Interest,
  type TypeId,
} from "../recommend/survey";
import { indirectPreference } from "../recommend/theme-index";

// 홈 「지역 시티투어」의 데이터 가공. 순수 함수만 둔다.
// 분류 · 내 유형 추천 규칙은 팀장 목업(2026-09-27 standalone 「Tour Navigator.html」 홈 renderVals의 KW · prof · tags · rec)을 옮겼다.
// 내 유형 추천의 적합도만 설문 6.1 · 추천 6.2 결과(간접 선호 u)로 바꿨다(recommendTours).
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
  /** S4 관심사의 경유지 분류. 드라마 · 공연 · 쇼핑은 분류가 없어 null */
  tag: TourTag | null;
};

/** 추천 답으로 유형 요약을 만든다. 완료된 응답이 아니면(예전 15문항 기록 포함) null */
export function typeProfile(answers: Answers): TypeProfile | null {
  const result = evaluate(answers);
  if (result.status !== "complete") return null;
  return {
    types: result.types,
    preference: indirectPreference(result),
    tag: INTEREST_TAG[result.interest] ?? null,
  };
}

/** 추천 개수(목업: 5개) */
export const RECOMMEND_COUNT = 5;

/**
 * 내 유형 추천(목업 rec에서 적합도만 바꿨다).
 * 점수 = 적합도(노선 분류 비율 · 간접 선호 u의 내적. 예전 1 · 2위 군집 확률 섞기를 대신한다)
 *      + 0.5 × S4 관심사 한 개의 분류 비율(야경은 야간 여부) + 경유지 3곳 이상이면 0.02.
 * 점수 높은 순으로 한 지역에 한 노선씩 5개.
 * 명세서 §16의 코사인 × coverage 순위는 팀 참조 패키지의 적격 179코스 자료(eligible_courses.csv)가 있어야 같은 값이 나온다.
 * 목업 노선 분류(tourProfile)는 한 경유지가 여러 분류에 들어가 coverage ≤ 1이 성립하지 않아 그 식을 그대로 쓰지 않았다
 */
export function recommendTours<
  T extends Pick<CityTour, "name" | "route" | "region">,
>(tours: readonly T[], type: TypeProfile): T[] {
  const scored = tours
    .map((tour) => {
      const p = tourProfile(tour);
      const fit = p.share.reduce(
        (sum, v, k) => sum + v * type.preference[k],
        0,
      );
      const interest =
        type.tag === null
          ? 0
          : type.tag === "night"
            ? Number(p.night)
            : p.share[TOUR_CATEGORIES.indexOf(type.tag)];
      return {
        tour,
        score: fit + 0.5 * interest + (p.stops >= 3 ? 0.02 : 0),
      };
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
