import { api } from "../../lib/api/client";
import { API_TIMEOUT_MS, DATALAB_REGIONS } from "../../lib/api/datalab";
import type { Answers } from "./questions";
import type { ClusterId } from "./scoring";
import {
  CATEGORY_IDS,
  type CategoryId,
  findThemeByKey,
  INTEREST_CATEGORY,
  NIGHT_INTEREST,
  type RegionId,
  type ThemeSlug,
} from "./themes";

// 백엔드 테마 추천(POST /api/v1/recommend). 추천 점수는 data-server가 정본이고, 프론트는 결과를 그대로 보인다.
// 군집 판정(classify, Q1~Q9)만 프론트에서 하고 그 1순위 군집을 cluster로 보낸다.
// 필드 설명은 백엔드 명세(/v3/api-docs)의 description을 옮겼다.

/** 테마 추천 요청 */
export type RecommendRequest = {
  /** 군집 코드. /api/v1/personas 의 clusters 값 */
  cluster: string;
  /** 관심 카테고리 인덱스. /api/v1/personas 의 cats 순서 */
  interests: number[];
  /** 야경 선호 */
  night: boolean;
  /** 여행 지역. 주면 그 지역 TFI를 보정에 반영한다 */
  region?: string;
};

/** 추천된 테마 하나 */
export type RecommendThemeResponse = {
  /** 테마 이름 */
  theme: string;
  /** 군집 적합도 */
  fit: number;
  /** 관심사 일치도 */
  interest: number;
  /** 지역 보정치 */
  region: number;
  /** 최종 점수 */
  score: number;
  /** 카테고리별 구성 비율 (키: cats 이름) */
  share: Record<string, number>;
};

/** 테마 추천 결과 */
export type RecommendResponse = {
  /** 요청한 군집 코드 */
  cluster: string;
  /** 관심 카테고리 이름 */
  cats: string[];
  /** 점수에 반영된 지역. 요청에 region을 주지 않으면 비어 있다 */
  region: string | null;
  /** 지역 보정이 실제로 적용됐는지 */
  regionApplied: boolean;
  /** 점수 산출에 쓰인 자료 출처. 데이터랩 반영 여부를 여기서 확인한다 */
  sources: string[];
  /** 점수 내림차순 테마 목록 */
  themes: RecommendThemeResponse[];
};

/**
 * 추천 API의 관심 카테고리 이름. 순서가 곧 interests 인덱스다.
 * 출처: GET /api/v1/personas 의 cats (2026-09-27 확인). CATEGORY_IDS와 같은 순서다
 */
/**
 * 추천 응답 sources의 출처 이름 → 화면 문구 키(Datalab.sources).
 * 백엔드가 출처 이름을 한국어로만 보내서 영어 화면에서는 이 표로 바꿔 보인다. 표에 없는 이름은 받은 그대로 보인다
 */
export const SOURCE_KEYS: Readonly<
  Record<string, "nationalTravel" | "inbound" | "datalabTfi">
> = {
  국민여행조사: "nationalTravel",
  외래관광객조사: "inbound",
  "한국관광 데이터랩 (지역×테마 강도 TFI)": "datalabTfi",
};

export const API_CATS = [
  "역사·문화",
  "힐링·생태",
  "테마파크·액티비티",
  "로컬·먹거리",
  "해양·자연",
] as const;

/** 설문 답 + 1순위 군집 → 추천 요청. Q15를 안 골랐으면 region을 보내지 않는다 */
export function buildRecommendRequest(
  answers: Answers,
  cluster: ClusterId,
): RecommendRequest {
  const q4 = answers.q4 ?? [];
  const interests = q4
    .map((option) => INTEREST_CATEGORY[option])
    .filter((i): i is number => i !== undefined);
  const region = regionName(answers.q15?.[0]);
  return {
    cluster,
    interests,
    night: q4.includes(NIGHT_INTEREST),
    ...(region ? { region } : {}),
  };
}

/** Q15 보기 id → API 지역 이름. 모르는 값 · 안 골랐으면 undefined */
export function regionName(option: string | undefined): string | undefined {
  if (!option || !(option in DATALAB_REGIONS)) return undefined;
  return DATALAB_REGIONS[option as keyof typeof DATALAB_REGIONS];
}

export type RecommendResult =
  { ok: true; data: RecommendResponse } | { ok: false; error: unknown };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * 추천 응답의 모양을 검사한다. 화면이 순위를 매기는 themes(배열 · 항목마다 theme 문자열)가 틀리면 null.
 * 없어도 되는 필드는 빈 값으로 채운다(sources · cats 빈 배열, region null, regionApplied false, share {}, 점수 0).
 * 백엔드 응답 모양이 조금 달라도 결과 페이지 전체가 500이 되지 않게 한다
 */
export function parseRecommendResponse(
  data: unknown,
): RecommendResponse | null {
  if (!isObject(data) || !Array.isArray(data.themes)) return null;
  const themes: RecommendThemeResponse[] = [];
  for (const t of data.themes as unknown[]) {
    if (!isObject(t) || typeof t.theme !== "string") return null;
    const share: Record<string, number> = {};
    if (isObject(t.share)) {
      for (const [k, v] of Object.entries(t.share)) {
        if (typeof v === "number" && Number.isFinite(v)) share[k] = v;
      }
    }
    themes.push({
      theme: t.theme,
      fit: num(t.fit),
      interest: num(t.interest),
      region: num(t.region),
      score: num(t.score),
      share,
    });
  }
  return {
    cluster: typeof data.cluster === "string" ? data.cluster : "",
    cats: strings(data.cats),
    region: typeof data.region === "string" ? data.region : null,
    regionApplied: data.regionApplied === true,
    sources: strings(data.sources),
    themes,
  };
}

/**
 * 추천 API를 부른다. 시간 초과 · 네트워크 오류 · ApiError · 모양이 틀린 응답을 모두 실패({ ok: false })로 돌려준다.
 * 서버 컴포넌트에서 부른다(공개 API, docs/api.md)
 */
export async function fetchRecommendation(
  request: RecommendRequest,
): Promise<RecommendResult> {
  try {
    const raw = await api<unknown>("/api/v1/recommend", {
      method: "POST",
      body: request,
      auth: false,
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    const data = parseRecommendResponse(raw);
    if (!data) {
      return { ok: false, error: new Error("Unexpected recommend response") };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error };
  }
}

/** 결과 화면 카드 하나 */
export type ThemeCardData = {
  slug: ThemeSlug;
  /** 우리 테마 목록 안에서의 순위 (1부터, API 순서) */
  rank: number;
  regions: readonly RegionId[];
  /** 보여 줄 카테고리 구성비 (API share에서) */
  category: { id: CategoryId; share: number; matched: boolean } | null;
};

/**
 * 추천 응답 → 카드 목록. 순서는 API 순서(점수 내림차순) 그대로이고,
 * 우리 테마 목록에 없는 테마(「[가상] …」)는 뺀다.
 */
export function toThemeCards(
  response: RecommendResponse,
  interests: readonly number[],
): ThemeCardData[] {
  return response.themes
    .flatMap((item) => {
      const theme = findThemeByKey(item.theme);
      return theme ? [{ theme, item }] : [];
    })
    .map(({ theme, item }, index) => ({
      slug: theme.slug,
      rank: index + 1,
      regions: theme.regions,
      category: pickCategory(
        API_CATS.map((name) => item.share?.[name] ?? 0),
        interests,
      ),
    }));
}

/**
 * 보여 줄 카테고리 구성비(표시용 선택).
 * 고른 관심사에 대응하는 분류가 있으면 그중 이 테마 구성비가 가장 큰 분류(matched = true),
 * 없거나 그 분류의 장소가 0%면 이 테마에서 가장 큰 분류.
 */
export function pickCategory(
  share: readonly number[],
  interests: readonly number[],
): ThemeCardData["category"] {
  if (share.length === 0) return null;
  const candidates = interests.length > 0 ? interests : share.map((_, i) => i);
  let best = candidates[0];
  for (const i of candidates) if (share[i] > share[best]) best = i;
  if (interests.length > 0 && !(share[best] > 0)) {
    return pickCategory(share, []);
  }
  if (!(share[best] > 0)) return null;
  return {
    id: CATEGORY_IDS[best],
    share: share[best],
    matched: interests.length > 0,
  };
}
