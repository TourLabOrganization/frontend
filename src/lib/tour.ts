// 장소 시트의 한국관광공사 칸(오디오 가이드 · 함께 많이 가는 관광지 Top · 방문 집중률 예측).
// 공공데이터포털 API는 Route Handler(app/api/tour/*)가 서버 키로 부르고(lib/tour-api.ts · tour-audio.ts · tour-related.ts · tour-crowd.ts),
// 장소 시트(components/ui/PlaceTour)가 그 결과를 그린다. 여기에는 두 쪽이 함께 쓰는 타입 · 순수 함수만 둔다(키 · 무거운 데이터를 import하지 않는다).
import type { KtoPlace } from "../features/planner/kto-place";
import { addDays, seoulDate } from "./weather";

/** Route Handler · 외부 호출 시간 제한(ms) */
export const TOUR_TIMEOUT_MS = 8000;
/** 오디오 가이드 · 연관 관광지를 다시 받는 간격(초). 오디오 해설은 거의 바뀌지 않고, 연관 관광지는 달마다 바뀐다 */
export const TOUR_DAY_SECONDS = 86400;
/** 방문 집중률을 다시 받는 간격(초). 날마다 새 예측이 붙는다 */
export const TOUR_CROWD_SECONDS = 21600;

/** 결과 없음(검색 결과 없음 · 이름이 맞는 곳 없음 · 외국어 화면에 보일 것이 없음) */
export type TourEmpty = { empty: true };

/** GET /api/tour/audio 응답 */
export type TourAudio = {
  title: string;
  /** 해설 대본 · 스토리텔링 본문 */
  script: string;
  /** 음성 파일 주소(https). 오디 결과에 있을 때만 */
  audioUrl?: string;
  /** 재생 시간(초). 오디 결과에 있을 때만 */
  playTime?: number;
  /** odii = 한국관광공사 오디오 가이드(오디), story = 관광 스토리텔링(한국어 화면만) */
  source: "odii" | "story";
  /**
   * 같은 관광지(오디 tid)의 다른 해설(대표를 뺀 나머지, 오디 순서). 불국사처럼 관광지 하나에 천왕문 · 다보탑 · 대웅전 같은
   * 세부 해설이 여럿일 때 모두 들을 수 있게 담는다. 있을 때만, 각 항목에는 others가 없다
   */
  others?: TourAudio[];
};

/** 함께 많이 가는 관광지 한 곳 */
export type TourRelatedItem = {
  /** 순위(관광지 · 음식 안에서 1부터 다시 매긴 순위) */
  rank: number;
  /** 한국어 화면은 한국관광공사 이름, 외국어 화면은 이어진 우리 장소의 그 언어 이름 */
  name: string;
  /** 한국어 화면은 한국관광공사 분류, 외국어 화면은 우리 분류 이름 */
  category: string;
  /** 한국어 화면은 시도 · 시군구, 외국어 화면은 우리 도시 이름 */
  region: string;
  /** 이어진 우리 장소(플래너 장소 id). 누르면 그 장소 시트로 바뀐다 */
  placeId?: string;
};

/** 함께 많이 찾는 숙소 한 곳(순위 번호 없이 보인다) */
export type TourRelatedStay = Omit<TourRelatedItem, "rank">;

/** GET /api/tour/related 응답 */
export type TourRelated = {
  /** 기준월 YYYYMM */
  month: string;
  /** 관광지 · 음식(한국관광공사 대분류)만 순위 순 최대 8곳. rank는 이 안에서 1부터 다시 매긴 순위 */
  items: TourRelatedItem[];
  /** 숙박만 한국관광공사 순위 순 최대 3곳(순위 계산에서 뺀 숙소) */
  stays: TourRelatedStay[];
};

/** 하루 방문 집중률 예측 */
export type TourCrowdDay = {
  /** 한국 날짜 YYYY-MM-DD */
  date: string;
  /** 집중률(%) */
  rate: number;
};

/** GET /api/tour/crowd 응답 */
export type TourCrowd = {
  /** 한국관광공사 관광지 이름(한국어). 한국어 화면의 출처 줄에만 쓴다 */
  name: string;
  /** 오늘부터 날짜순 */
  days: TourCrowdDay[];
};

/**
 * 홈 「지금 인기 관광지」의 도시(칩 순서). 플래너 주요 도시(서울 · 부산 · 제주)와 관광객이 많은 도시.
 * 서버가 도시마다 장소가 많은 시군구(최대 4곳)의 관광지 집중률을 모은다(lib/tour-popular.ts)
 */
export const POPULAR_CITIES = [
  "서울",
  "부산",
  "제주",
  "경주",
  "강릉",
  "전주",
  "인천",
  "속초",
] as const;
export type PopularCity = (typeof POPULAR_CITIES)[number];

/** 인기 관광지 한 곳 */
export type TourPopularItem = {
  /** 화면 이름(앱 장소와 맞으면 화면 언어 이름, 아니면 한국관광공사 이름) */
  name: string;
  /** 시군구 이름(한국관광공사 signguNm, 한국어) */
  district: string;
  /** 그날 집중률(%) */
  rate: number;
  /**
   * 맞는 장소 id. 이름이 같거나(표기 차이 포함) 한국관광공사 좌표 근처에 있는 앱 장소 id,
   * 앱 장소가 없으면 신규 관광지 id(kto:<contentid>). 둘 다 못 찾으면 null(목록에서 글자만 둔다)
   */
  id: string | null;
  /** 신규 관광지면 그 장소(브라우저가 기억해 지도 · 코스에 넣는다) */
  place?: KtoPlace;
};

/** GET /api/tour/popular 응답. 결과가 없으면 TourEmpty */
export type TourPopular = {
  /** 기준 날짜(한국, YYYY-MM-DD). 보통 오늘 */
  date: string;
  /** 집중률 높은 순 최대 10곳 */
  items: TourPopularItem[];
};

/** 홈 인기 관광지 주소 */
export function popularPath(city: string, locale: string): string {
  return `/api/tour/popular?city=${encodeURIComponent(city)}&locale=${encodeURIComponent(locale)}`;
}

export type TourKind = "audio" | "related" | "crowd";

/**
 * 응답 모양이 바뀐 칸의 판. 주소에 v로 붙여 브라우저 · CDN에 하루 캐시된 옛 응답(Cache-Control max-age)을 피한다.
 * 모양을 바꿀 때 올린다. audio 2: 같은 관광지의 다른 해설(others)을 더함(2026-10-02)
 */
export const TOUR_PATH_VERSION: Readonly<Partial<Record<TourKind, number>>> = {
  audio: 2,
};

/** 브라우저가 부르는 우리 Route Handler 주소. 입력은 장소 id(와 화면 언어)뿐이고, 응답 모양이 바뀐 칸은 판(v)이 붙는다 */
export function tourPath(kind: TourKind, id: string, locale?: string): string {
  const qs = new URLSearchParams({ id });
  if (locale) qs.set("locale", locale);
  const v = TOUR_PATH_VERSION[kind];
  if (v) qs.set("v", String(v));
  return `/api/tour/${kind}?${qs}`;
}

/** 응답이 결과 없음인지 */
export function isTourEmpty(body: unknown): body is TourEmpty {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as TourEmpty).empty === true
  );
}

export type CrowdLevel = "quiet" | "moderate" | "busy";

/** 혼잡 기준(%, 이상). PoC crowdLvl */
export const CROWD_BUSY = 70;
/** 보통 기준(%, 이상). 그 아래는 여유 */
export const CROWD_MODERATE = 40;

/** 집중률 → 수준 (PoC crowdLvl: 70 이상 혼잡 · 40 이상 보통 · 그 아래 여유) */
export function crowdLevel(rate: number): CrowdLevel {
  if (rate >= CROWD_BUSY) return "busy";
  if (rate >= CROWD_MODERATE) return "moderate";
  return "quiet";
}

/**
 * 오늘(한국 날짜)부터 n일. 응답은 캐시될 수 있어 순번이 아니라 날짜로 거른다(오늘 전 날짜는 버린다).
 * 빠진 날은 건너뛴다(없는 값을 만들지 않는다)
 */
export function upcomingCrowdDays(
  days: readonly TourCrowdDay[],
  now: Date,
  n = 7,
): TourCrowdDay[] {
  const today = seoulDate(now);
  const last = addDays(today, n - 1);
  return days
    .filter((d) => d.date >= today && d.date <= last)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 대본을 접는 길이(글자). 넘으면 앞부분 + 「…」과 「더 읽기」 (PoC d_storyText) */
export const SCRIPT_FOLD = 240;

/** 접은 대본. 접는 길이 이하면 그대로 */
export function foldScript(script: string): string {
  return script.length > SCRIPT_FOLD
    ? script.slice(0, SCRIPT_FOLD).trimEnd() + "…"
    : script;
}

/** 재생 시간(초) → 「3:05」 */
export function formatPlayTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
