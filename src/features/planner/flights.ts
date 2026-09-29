import flightsData from "./data/flights.json";
import type { Island } from "./island";
import { PLANNER_ORIGINS } from "./regions";
import type { WideChoice } from "./wide-chain";

// 투어 플래너 코스 탭 「제주 노선 운항 현황」 · 「김해공항 노선 운항 현황」 카드(PoC flightBoard* · busanAir*). 순수 함수만 둔다.
// 화면(FlightCard)은 이 값을 언어에 맞춰 그리기만 한다. 데이터 data/flights.json은 scripts/build-flights.mjs가 PoC 하드코딩 값에서 만든다.
//  - 보이는 조건: 광역 교통이 항공이고 자가용이 아닐 때. 제주 카드는 제주 · 서귀포 여행, 김해 카드는 첫 도시가 부산 · 김해 · 양산 · 창원 · 거제일 때
//  - 요약 표(운항 항공사 · 일 운항 · 첫 · 막 출발 · 비행 시간): 노선의 항공사표(ROUTE_AIRLINES)가 있으면 합계 · 첫 · 막 편을 그 표에서 다시 계산한다
//    (PoC flightSched: 「두 칸의 숫자를 맞춘다」. PoC 김해 카드는 다시 계산하지 않지만 같은 노선 PUS-CJU가 두 카드에서 달라 보이지 않게 여기서는 맞춘다)
//  - 항공사별 운항 개요: 편도 편수 「a~b편」의 가운데 값으로 비중을 내고 많은 순
//  - 실시간 편성(PoC loadFlights)은 PoC에서도 요청 주소가 비어 꺼져 있어 옮기지 않았다. 공항 수속 소요시간만 실시간이다(lib/airport-process.ts)

export type Airport = { code: string; ko: string; en: string };
type Sched = {
  air: string;
  day: string;
  first: string;
  last: string;
  dur: number;
};
type RouteAirline = { ko: string; en: string; day: string; win: string };
export type AirlineLink = { ko: string; en: string; url: string };

const DATA = flightsData as {
  jejuAirports: Airport[];
  jejuSched: Record<string, Sched>;
  busanAirports: Airport[];
  busanSched: Record<string, Sched>;
  routeAirlines: Record<string, RouteAirline[]>;
  airlineLinks: AirlineLink[];
};

export const JEJU_AIRPORTS: readonly Airport[] = DATA.jejuAirports;
export const BUSAN_AIRPORTS: readonly Airport[] = DATA.busanAirports;
export const AIRLINE_LINKS: readonly AirlineLink[] = DATA.airlineLinks;

/** 김해공항 카드를 보이는 첫 도시(PoC busanAirShow) */
export const BUSAN_AIR_CITIES = ["부산", "김해", "양산", "창원", "거제"];

/** 제주 카드: 제주 · 서귀포 여행, 광역 교통 항공, 자가용 아님(PoC flightBoardShow) */
export function showJejuFlights(p: {
  island: Island | null;
  own: boolean;
  choice: WideChoice | null;
}): boolean {
  return p.island === "jeju" && !p.own && p.choice === "air";
}

/** 김해 카드: 첫 도시가 부산권, 광역 교통 항공, 자가용 아님(PoC busanAirShow) */
export function showBusanFlights(p: {
  destination: string | null;
  own: boolean;
  choice: WideChoice | null;
}): boolean {
  return (
    !p.own &&
    p.choice === "air" &&
    p.destination !== null &&
    BUSAN_AIR_CITIES.includes(p.destination)
  );
}

/**
 * 출발지 → 제주 노선 출발 공항(기본값). 출발지 이름(한국어)에 공항 이름이 있으면 그 공항, 없으면 김포(PoC 기본 GMP).
 * 김해(부산)은 「김해」로 찾는다
 */
export function jejuAirportFor(originKey: string | null | undefined): string {
  const ko = originKey ? (PLANNER_ORIGINS[originKey]?.ko ?? "") : "";
  if (/공항/.test(ko)) {
    const hit = JEJU_AIRPORTS.find((a) =>
      ko.includes(a.ko.replace(/\(.*?\)/g, "")),
    );
    if (hit) return hit.code;
  }
  return "GMP";
}

/** 「18~22편」 · 「편도 90~100편」 · 「주 2~3편」 → 숫자 범위. 숫자가 없으면 null */
export function flightCount(
  text: string,
): { lo: number; hi: number; weekly: boolean } | null {
  const m = text.match(/(\d+)\s*[~–-]\s*(\d+)/) ?? text.match(/(\d+)/);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] === undefined ? lo : Number(m[2]);
  return { lo, hi, weekly: /^\s*주/.test(text) };
}

/** 「06:00–21:00」 → 분(시작 · 끝). 모양이 다르면 null */
function windowMinutes(win: string): [number | null, number | null] {
  const toMin = (s: string | undefined) => {
    const m = s?.match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const [a, b] = win.split(/[–~-]/);
  return [toMin(a), toMin(b)];
}

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** 한국어 항공사 이름 → 영어(항공사표 · 시간표 링크에서 모은다). 표에 없는 이름은 그대로 */
const AIRLINE_EN = new Map<string, string>([
  ...Object.values(DATA.routeAirlines)
    .flat()
    .map((a) => [a.ko, a.en] as const),
  ...DATA.airlineLinks.map((a) => [a.ko, a.en] as const),
  // 요약 표에만 나오는 줄인 이름
  ["아시아나", "Asiana"],
  ["티웨이", "T'way"],
]);

/** 요약 표 한 노선 */
export type FlightSummary = {
  /** 운항 항공사(화면 언어). 정기편이 없거나 부정기면 빈 배열이고 special이 있다 */
  airlines: string[];
  /** 항공사표에서 다시 계산했으면 true(화면은 「n개사 · 앞 3곳 외」, 「편도 합계」) */
  fromTable: boolean;
  /** 정기 운항 없음(KTX · SRT 이용) · 부정기 · 계절편 */
  special: "noRegular" | "irregular" | null;
  /** 일 운항(편도). 없으면 null */
  count: { lo: number; hi: number; weekly: boolean } | null;
  /** 첫 · 막 출발 HH:MM. 없으면 null */
  first: string | null;
  last: string | null;
  /** 비행 시간(분). 없으면 null */
  minutes: number | null;
};

function summarize(
  sched: Sched | undefined,
  table: readonly RouteAirline[] | undefined,
  ko: boolean,
): FlightSummary | null {
  if (!sched) return null;
  const special = /정기 운항 없음/.test(sched.air)
    ? ("noRegular" as const)
    : /부정기|계절/.test(sched.air)
      ? ("irregular" as const)
      : null;
  const time = (v: string) => (/^\d{1,2}:\d{2}$/.test(v) ? v : null);
  const base: FlightSummary = {
    airlines: special
      ? []
      : sched.air
          .split("·")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => (ko ? s : (AIRLINE_EN.get(s) ?? s))),
    fromTable: false,
    special,
    count: sched.day === "—" ? null : flightCount(sched.day),
    first: time(sched.first),
    last: time(sched.last),
    minutes: sched.dur > 0 ? sched.dur : null,
  };
  if (!table || table.length === 0) return base;
  let lo = 0;
  let hi = 0;
  let first = Infinity;
  let last = -1;
  for (const a of table) {
    const c = flightCount(a.day);
    if (c) {
      lo += c.lo;
      hi += c.hi;
    }
    const [s, e] = windowMinutes(a.win);
    if (s !== null) first = Math.min(first, s);
    if (e !== null) last = Math.max(last, e);
  }
  return {
    ...base,
    airlines: table.map((a) => (ko ? a.ko : a.en)),
    fromTable: true,
    special: null,
    count: { lo, hi, weekly: false },
    first: first < Infinity ? hhmm(first) : base.first,
    last: last >= 0 ? hhmm(last) : base.last,
  };
}

/** 제주 노선 요약(출발 · 도착 공항 code ↔ 제주). 모르는 공항이면 null */
export function jejuSummary(code: string, ko: boolean): FlightSummary | null {
  return summarize(DATA.jejuSched[code], DATA.routeAirlines[`${code}-CJU`], ko);
}

/** 김해 노선 요약(김해 ↔ code) */
export function busanSummary(code: string, ko: boolean): FlightSummary | null {
  return summarize(
    DATA.busanSched[code],
    DATA.routeAirlines[`PUS-${code}`],
    ko,
  );
}

/** 항공사별 운항 개요 한 줄 */
export type AirlineShare = {
  name: string;
  count: { lo: number; hi: number; weekly: boolean } | null;
  /** 운항 시간대(「06:00–21:00」) */
  window: string;
  /** 노선 안 비중(%, 편수 범위의 가운데 값 기준, 반올림) */
  share: number;
};

/** 노선(「GMP-CJU」)의 항공사별 운항 개요. 비중이 큰 순(같으면 표 순서). 표가 없으면 빈 배열 */
export function airlineShares(route: string, ko: boolean): AirlineShare[] {
  const list = (DATA.routeAirlines[route] ?? []).map((a, i) => {
    const count = flightCount(a.day);
    return { a, i, count, mid: count ? (count.lo + count.hi) / 2 : 0 };
  });
  const total = list.reduce((s, x) => s + x.mid, 0) || 1;
  return list
    .sort((x, y) => y.mid - x.mid || x.i - y.i)
    .map(({ a, count, mid }) => ({
      name: ko ? a.ko : a.en,
      count,
      window: a.win.replace(/[~-]/, "–"),
      share: Math.round((mid / total) * 100),
    }));
}
