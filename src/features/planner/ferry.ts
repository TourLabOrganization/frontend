import ferryData from "./data/ferry.json";
import type { Island } from "./island";
import type { WideChoice } from "./wide-chain";

// 투어 플래너 코스 탭 「배편 시간표」 카드(PoC ferryVals). 순수 함수만 둔다. 화면(FerryCard)은 이 값만 그린다.
// 데이터 data/ferry.json은 scripts/build-ferry.mjs가 PoC FERRY_ROUTES · FERRY_STATS와 수기 항로(백령도 · 연평도,
// scripts/data/ferry-manual.json)에서 만든다.
//  - 보이는 조건: 섬(제주 · 울릉 · 백령도 · 연평도) 여행에서 광역 교통이 배이거나, 제주 자가용에서 「아니요 — 카페리」를 골랐을 때
//  - 표(선사 · 소요 · 운항 횟수 · 첫 · 막 출항 · 도착 항구): 한국어는 PoC 값 그대로, 그 밖의 언어는 PoC 영어 값과 PoC가 만드는 영어 표기
//  - 운항 실적(FERRY_STATS가 있는 항로만): 연중 통제(결항)율, 여행월 통제율(날짜가 없으면 가장 궂은 달), 1–12월 막대,
//    최근 1년 주요 출항 시각, 여행월 통제율 6% 이상이면 경고. 단계는 6% · 15%(PoC lvl)

export type FerryRoute = {
  /** 항로 key(FERRY_STATS key) */
  k: string;
  ko: string;
  en: string;
  op: string;
  opEn: string;
  dur: string;
  durEn: string;
  /** 운항 횟수(「2 – 3회」 · 「주 3 – 6회」) */
  day: string;
  first: string;
  last: string;
  /** 도착 항구(한국어) */
  arr: string;
  /** 도착 항구(영어). 수기 항로(백령도 · 연평도)만 있다. PoC 항로는 PoC 영어 표기 규칙으로 만든다 */
  arrEn?: string;
};

export type FerryStats = {
  /** 항로 이름(한국어, 「제주-완도」) */
  route: string;
  /** 연중 통제(결항)율 % */
  ctrl: number;
  /** 월별 통제율 %. key "1"~"12" */
  mon: Readonly<Record<string, number>>;
  /** 최근 1년 주요 출항 시각 */
  times: readonly string[];
  ships: readonly string[];
  /** 집계 기간 YYYY-MM-DD */
  from: string;
  to: string;
  /** 항차 수 */
  n: number;
};

export const FERRY_ROUTES = ferryData.routes as Readonly<
  Record<Island, readonly FerryRoute[]>
>;
export const FERRY_STATS = ferryData.stats as Readonly<
  Record<string, FerryStats>
>;

/** 통제율 경고 단계(PoC lvl): 6% 이상 주의, 15% 이상 높음 */
export const FERRY_WARN_PCT = 6;
export const FERRY_BAD_PCT = 15;
/** 막대 높이(PoC ferryStatMonths): 최대 26px, 최소 2px, 기준 최댓값은 5% 이상 */
const BAR_MAX_PX = 26;
const BAR_MIN_PX = 2;
const BAR_FLOOR_PCT = 5;

/** 섬 이름. 한국어 · 영어(PoC ferryVals IS). 예매 검색어와 항구 이름에 쓴다 */
const ISLAND_NAME: Record<Island, { ko: string; en: string }> = {
  jeju: { ko: "제주", en: "Jeju" },
  ulleung: { ko: "울릉도", en: "Ulleungdo" },
  baengnyeong: { ko: "백령도", en: "Baengnyeongdo" },
  yeonpyeong: { ko: "연평도", en: "Yeonpyeongdo" },
};

/** 가보고싶은섬 예매(PoC ferryBook) */
export const FERRY_BOOK_URL = "https://island.theksa.co.kr/";

export type FerryLevel = "normal" | "warn" | "bad";

/** 통제율 단계(PoC lvl) */
export function ferryLevel(pct: number): FerryLevel {
  if (pct >= FERRY_BAD_PCT) return "bad";
  if (pct >= FERRY_WARN_PCT) return "warn";
  return "normal";
}

/**
 * 배편 시간표 카드를 보일지(PoC ferryVals).
 * 섬 여행에서 자가용이 아니고 광역 교통이 배이거나, 제주 자가용에서 카페리로 답했을 때(jejuResident === false)
 */
export function showFerryCard(p: {
  island: Island | null;
  own: boolean;
  choice: WideChoice | null;
  jejuResident: boolean | null;
}): boolean {
  if (!p.island) return false;
  if (p.own) return p.island === "jeju" && p.jejuResident === false;
  return p.choice === "ship";
}

/** 고른 출발 항구의 항로. 없거나 모르는 key면 첫 항로(PoC `L.find(…)||L[0]`) */
export function ferryRoute(
  island: Island,
  port: string | undefined,
): FerryRoute {
  const list = FERRY_ROUTES[island];
  return list.find((r) => r.k === port) ?? list[0];
}

/** 출발 항구 보기 이름(「완도항 → 제주항」, 그 밖의 언어 「Wando → Jeju」) */
export function ferryPortLabel(
  r: FerryRoute,
  island: Island,
  ko: boolean,
): string {
  return ko ? `${r.ko} → ${r.arr}` : `${r.en} → ${ISLAND_NAME[island].en}`;
}

/**
 * 운항 실적 항로 이름(통계의 「포항-울릉」). 한국어가 아니면 구간마다 영어 이름으로 바꾼다(「Pohang–Ulleungdo」).
 * 섬 쪽은 섬 이름, 항구 쪽은 고른 항로의 영어 이름(괄호 앞)을 쓴다
 */
export function ferryStatRoute(
  route: string,
  r: FerryRoute,
  island: Island,
  ko: boolean,
): string {
  if (ko) return route;
  const isle = ISLAND_NAME[island];
  const port = r.en.split(" (")[0];
  const parts = route.split("-");
  if (parts.length !== 2) return `${port}–${isle.en}`;
  const part = (p: string) => (isle.ko.startsWith(p) ? isle.en : port);
  const [a, b] = parts.map(part);
  return a === b ? `${port}–${isle.en}` : `${a}–${b}`;
}

export type FerryRowKey = "op" | "dur" | "day" | "first" | "last" | "arr";

/** 표 값(PoC ferrySched). 한국어가 아니면 PoC 영어 표기 규칙을 그대로 쓴다 */
export function ferryRows(
  r: FerryRoute,
  island: Island,
  ko: boolean,
): { key: FerryRowKey; value: string }[] {
  const time = (v: string) =>
    ko ? v : v.replace(" 무렵", "").replace(" (크루즈)", " (cruise)");
  const day = ko
    ? `하루 ${r.day}`.replace("하루 주", "주")
    : r.day
        .replace("회", " /day")
        .replace("주 ", "")
        .replace(" /day", r.day.includes("주") ? " /week" : " /day");
  const arr = ko
    ? r.arr
    : r.arrEn
      ? r.arrEn
      : island === "jeju"
        ? "Jeju Port"
        : r.arr
            .replace("도동항", "Dodong")
            .replace("사동항", "Sadong")
            .replace("저동항", "Jeodong");
  return [
    { key: "op", value: ko ? r.op : r.opEn },
    { key: "dur", value: ko ? r.dur : r.durEn },
    { key: "day", value: day },
    { key: "first", value: time(r.first) },
    { key: "last", value: time(r.last) },
    { key: "arr", value: arr },
  ];
}

/** 선사 시간표 검색(PoC ferryOp): 네이버에서 「선사 항구 섬 시간표」 */
export function ferryOperatorUrl(r: FerryRoute, island: Island): string {
  const q = `${r.op.split(" (")[0]} ${r.ko} ${ISLAND_NAME[island].ko} 시간표`;
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
}

/** 여행월(1–12, PoC `+tripFrom.slice(5,7)`). 출발일이 없으면 null */
export function tripMonth(startDate: string | null): number | null {
  if (!startDate) return null;
  const m = Number(startDate.slice(5, 7));
  return m >= 1 && m <= 12 ? m : null;
}

/** 가장 궂은 달(통제율이 가장 높은 달, 같으면 이른 달) */
export function worstMonth(s: FerryStats): { month: number; pct: number } {
  let month = 1;
  let pct = -1;
  for (let m = 1; m <= 12; m++) {
    const v = s.mon[m] ?? 0;
    if (v > pct) {
      month = m;
      pct = v;
    }
  }
  return { month, pct };
}

export type FerryBar = {
  month: number;
  pct: number;
  /** 막대 높이(px) */
  px: number;
  level: FerryLevel;
  /** 여행월 */
  trip: boolean;
};

export type FerryStatView = {
  stats: FerryStats;
  /** 여행월. 출발일이 없으면 null */
  month: number | null;
  /** 여행월 통제율. 출발일이 없으면 null */
  tripPct: number | null;
  /** 출발일이 없을 때 대신 보이는 가장 궂은 달 */
  worst: { month: number; pct: number };
  /** 둘째 칸 단계: 여행월 통제율(없으면 연중 통제율)로 정한다 */
  level: FerryLevel;
  yearLevel: FerryLevel;
  bars: FerryBar[];
  /** 여행월 통제율이 6% 이상 */
  warn: boolean;
};

/** 운항 실적 값(PoC ferryVals FERRY_STATS 부분). 실적이 없는 항로면 null */
export function ferryStatView(
  routeKey: string,
  startDate: string | null,
): FerryStatView | null {
  const s = FERRY_STATS[routeKey];
  if (!s) return null;
  const month = tripMonth(startDate);
  const tripPct = month ? (s.mon[month] ?? 0) : null;
  const values = Array.from({ length: 12 }, (_, i) => s.mon[i + 1] ?? 0);
  const max = Math.max(BAR_FLOOR_PCT, ...values);
  return {
    stats: s,
    month,
    tripPct,
    worst: worstMonth(s),
    level: ferryLevel(tripPct ?? s.ctrl),
    yearLevel: ferryLevel(s.ctrl),
    bars: values.map((pct, i) => ({
      month: i + 1,
      pct,
      px: Math.max(BAR_MIN_PX, Math.round((pct / max) * BAR_MAX_PX)),
      level: ferryLevel(pct),
      trip: month === i + 1,
    })),
    warn: tripPct !== null && tripPct >= FERRY_WARN_PCT,
  };
}
