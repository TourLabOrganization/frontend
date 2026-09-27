import { METRO_CITY } from "../course/places";
import { type Context, type CourseDay, splitDays } from "../course/scenarios";
import {
  autoCourse,
  dayWindows,
  type LegFn,
  legInfo,
  timeline,
  type TravelMode,
  toMin,
} from "../course/schedule";
import type { PlannerSettings, WideMode } from "./course-store";
import type { PlannerPlace } from "./data";
import { tripDays } from "./dates";
import { type Island, islandOf, tripOriginKey } from "./island";
import { findStation, stationPoint } from "./metro";
import { CITY_HUBS, PLANNER_ORIGINS, type PlannerHub } from "./regions";
import { isStay, splitStays } from "./stays";
import {
  type ChainMode,
  type ChainPoint,
  type ChainStep,
  chainSchedule,
  gatewayOptions,
  originKeyOf,
  routeCands,
  WIDE_ALLOW,
  type WideChain,
  type WideChoice,
  wideChain,
} from "./wide-chain";

// 투어 플래너 코스 탭의 일정 계산. 순수 함수만 둔다. 화면(PlannerCourseTab)은 이 결과만 그린다.
//
//  - 일수 = 귀가일 − 출발일 + 1 (당일 = 1). 날짜가 없거나 귀가일이 출발일보다 이르면 당일로 계산한다
//  - 광역 교통(목업 01, 6칸): 버스 · 기차 · 항공 · 배 · 지하철(도시철도) · 자가용. 수단을 먼저 고르고 출발지는 그 수단의 관문만
//    (wide-chain.ts originOptions, PoC 「광역교통 먼저」)
//      · 도착 관문에 없는 버스 · 기차 · 항공 · 배, 섬(육로 수단 없음)의 자가용은 고를 수 없다(도착 도시가 없으면 모두)
//      · 지하철은 출발 · 귀가역을 고르는 칸이라 도착 관문과 상관없이 고를 수 있다(PoC originFor)
//  - 광역 이동은 체인(wide-chain.ts wideChain): 출발지 → (전철 접근) → 출발 관문 → 광역 본 구간 → 도착 관문.
//    가는 체인은 첫 장소 도시, 돌아오는 체인은 마지막 장소 도시와 귀가지(없으면 출발지)로 만든다(PoC dayWindows cIn · cOut)
//  - 첫날(PoC dayWindows accIn) = 체인 소요(chainSchedule) + 도착 관문 → 첫 장소 구간(firstLeg).
//    첫 일정은 출발 시각 + 이 분부터 시작한다(dayStartClock). 창은 21:00 − (출발 + 이 분)
//  - 마지막 날(PoC dayWindows lastLeg): 마지막 장소 → 귀가 관문 구간을 빼고 여행지 출발 시각 안에 끝나게 한다.
//    공용 식(course/schedule.ts dayWindows · scenarios.ts splitDays)은 그대로 두고, 넘기는 여행지 출발 시각을 lastLeg만큼 당긴다
//    (창 = min(720, 당긴 시각 − 09:00)은 PoC retMin − lastLeg − 9×60과 같다. 날짜 나누기의 그날 끝도 당긴 시각)
//  - firstLeg · lastLeg는 현지 이동 수단의 legInfo(자가용이면 렌트카 식, PoC lm). 관문 점에는 도시가 없어 시내 식이다
//  - 현지 이동(목업 02) = legInfo 모드. 광역이 자가용이면 현지도 자가용(own)
//  - 날짜 나누기는 테마 코스와 같은 splitDays(개장 대기 · 폐장 · 그날 끝 · 마지막 날 여행지 출발 시각), 시각은 timeline
//  - 숙박 장소(cat === "stay")는 일정 계산 입력에서 뺀다(PoC courseList). 그날 밤 숙소로만 쓴다(stays.ts).
//    요약 · 「넣지 못한 장소」 · 일자별 시각에 들어가지 않는다. 계산 식(course/schedule.ts · scenarios.ts)은 그대로다
//  - 요약: 경유지 수 · 총 거리(같은 날 앞 장소 → 이 장소 구간 legInfo km 합, 소수 1자리) · 예상 시간(이동 + 대기 + 체류)
//  - 섬(island.ts islandOf):
//      · 제주(서귀포 포함)는 광역 교통 칸이 항공 · 배 · 자가용만(PoC wideOpts _jeju). 자가용을 고르면 「제주도민인가요?」(PoC jejuResident)
//        - 도민(true): 광역 체인 없이 섬 안에서 자가용만. 첫날은 출발 시각부터(PoC dayWindows: 체인이 없으면 accIn 0)
//        - 카페리(false · 아직 답하지 않음): 배로 확정한 체인 = 항만까지 운전 + 카페리(+ 선적 · 하선 30분, wide-chain.ts). 현지는 자가용
//      · 울릉은 출발지 · 귀가지를 울릉 항로 항구로만 읽는다(tripOriginKey, PoC oKey). 배 본 구간은 고정 항해 시간

/** 광역 교통 칸. 목업 순서(버스 · 기차 · 항공 / 배 · 지하철 · 자가용) */
const WIDE_CHOICES: readonly WideChoice[] = [
  "bus",
  "rail",
  "air",
  "ship",
  "metro",
  "own",
];

/** 제주에서 보이는 광역 교통 칸(PoC wideOpts _jeju: 육로 수단은 닿지 않는다) */
const JEJU_CHOICES: readonly WideChoice[] = ["air", "ship", "own"];

/** 고를 수 없는 이유. noCity 도착 도시 없음 · hub 도착 관문에 없음 · island 섬(자가용) */
export type WideBlock = "noCity" | "hub" | "island";

export type WideOption = { choice: WideChoice; block: WideBlock | null };

const LAND_MODES: readonly string[] = ["metro", "ktx", "srt", "bus"];

/** 기차 칸의 수단. 출발지가 SRT역(srt만 있음)이면 srt, 아니면 ktx */
export function railMode(originModes: readonly string[]): "ktx" | "srt" {
  return originModes.includes("srt") && !originModes.includes("ktx")
    ? "srt"
    : "ktx";
}

/** 저장한 광역 교통 → 칸 */
export function wideChoiceOf(mode: string | null): WideChoice | null {
  if (!mode) return null;
  if (mode === "ktx" || mode === "srt") return "rail";
  return (WIDE_CHOICES as readonly string[]).includes(mode)
    ? (mode as WideChoice)
    : null;
}

/** 칸 → 저장할 광역 교통. 기차는 출발지에 따라 ktx · srt */
export function wideModeOf(choice: WideChoice, originKey: string): WideMode {
  return choice === "rail"
    ? railMode(PLANNER_ORIGINS[originKey]?.modes ?? [])
    : choice;
}

/**
 * 광역 교통 칸과 고를 수 없는 이유. 보통 6칸, 제주는 항공 · 배 · 자가용 3칸(PoC wideOpts _jeju).
 * 제주 자가용은 카페리 · 도민으로 갈 수 있어 막지 않는다
 */
export function wideOptions(
  hub: PlannerHub | undefined,
  island: Island | null = null,
): WideOption[] {
  const hubModes: readonly string[] = hub?.modes ?? [];
  const jeju = island === "jeju";
  const choices = jeju ? JEJU_CHOICES : WIDE_CHOICES;
  return choices.map((choice) => {
    let block: WideBlock | null = null;
    if (!hub) block = "noCity";
    else if (choice === "own") {
      if (jeju) block = null;
      else if (!hubModes.some((m) => LAND_MODES.includes(m))) block = "island";
    } else if (choice !== "metro") {
      const need = WIDE_ALLOW[choice];
      if (!hubModes.some((m) => need.includes(m))) block = "hub";
    }
    return { choice, block };
  });
}

/** 투어 플래너의 구간 함수. 관문은 플래너 데이터(regions.json hubs)를 쓴다 */
function plannerLegFn(mode: TravelMode): LegFn {
  return (p, q) => legInfo(p, q, mode, CITY_HUBS, METRO_CITY);
}

/** 광역 교통이 닿는 도시: 코스 첫 장소의 도시, 없으면 고른 도시 */
function destinationCity(
  places: readonly PlannerPlace[],
  fallback: string | null,
): string | null {
  return places[0]?.locKo ?? fallback;
}

/** 고른 지하철역(PoC metroOrg). end면 귀가역, 비어 있으면 출발역 */
function metroOrg(settings: PlannerSettings, end: boolean): ChainPoint | null {
  const useEnd = end && settings.metroEnd !== "";
  const name = useEnd ? settings.metroEnd : settings.metroOrigin;
  const line = useEnd ? settings.metroEndLine : settings.metroLine;
  const s = findStation(name, line);
  return s ? stationPoint(s) : null;
}

/**
 * 체인의 출발점(PoC originFor). 출발지 key의 값, 광역 교통이 지하철이면 고른 역(귀가는 귀가역),
 * 도착 도시가 전철권(METRO_CITY)이면 고른 출발 전철역(광역전철 구간)
 */
export function originFor(
  settings: PlannerSettings,
  key: string,
  city: string | null,
  own: boolean,
  end = false,
): ChainPoint {
  const o = PLANNER_ORIGINS[key] ?? PLANNER_ORIGINS.seoul;
  if (own) return o;
  if (settings.wideMode === "metro") return metroOrg(settings, end) ?? o;
  if (!city || !METRO_CITY[city]) return o;
  return metroOrg(settings, false) ?? o;
}

/** 체인 한쪽(가는 길 · 돌아오는 길) */
export type ChainSide = {
  /** 도착 도시(한국어 이름) */
  city: string;
  /** 출발지(돌아올 때는 귀가지) key */
  key: string;
  /** 체인 출발점(돌아올 때는 귀가점) */
  origin: ChainPoint;
  chain: WideChain;
  /** 시각표. 가는 길은 출발 시각부터, 돌아오는 길은 여행지 출발 시각부터 */
  schedule: { steps: ChainStep[]; end: number };
  /** 이 도착 도시에 닿는 광역 경로 후보(PoC routeCands). 2개 이상이면 경로 선택 창으로 고른다 */
  cands: WideChain[];
  /** 환승 관문 후보 key(2곳 이상일 때만) */
  gateways: string[];
  /** 지금 출발 관문 key(출발지 목록의 값이 아니면 null) */
  gatewayKey: string | null;
};

/** 도착 관문 ↔ 첫(마지막) 장소 구간(PoC arr* · firstLeg · lastLeg) */
export type HubLeg = {
  hub: ChainPoint;
  place: PlannerPlace;
  mode: "transit" | "driving";
  min: number;
  km: number;
};

export type TripPlan = {
  dayCount: number;
  destination: string | null;
  hub: PlannerHub | undefined;
  /** 도착 도시의 섬(제주 · 울릉). 섬이 아니면 null */
  island: Island | null;
  /** 가는 · 돌아오는 도착 도시에 울릉이 있다(PoC ulleungTrip). 출발지 · 귀가지는 울릉 항로 항구만 */
  ulleung: boolean;
  /** 계산에 쓰는 출발지 · 귀가지 key(PoC oKey). 저장된 값이 울릉 규칙에 맞지 않으면 고친 값 */
  originKey: string;
  originEndKey: string;
  /** 제주 자가용 카페리(항만까지 운전 + 카페리) */
  carFerry: boolean;
  /** 제주 자가용 도민(광역 체인 없이 섬 안에서 자가용만) */
  resident: boolean;
  options: WideOption[];
  /** 강조할 광역 교통 칸: 고른 칸(고를 수 있을 때), 없으면 체인 수단의 칸 */
  choice: WideChoice | null;
  /** 광역 본 구간 수단(가는 체인). 도착 관문이 없으면 null */
  wide: ChainMode | null;
  local: TravelMode;
  inbound: ChainSide | null;
  outbound: ChainSide | null;
  /** 도착 관문 → 첫 장소(자가용이면 없다) */
  arrival: HubLeg | null;
  /** 도착 관문 → 첫 장소 분 · 마지막 장소 → 귀가 관문 분 */
  firstLeg: number;
  lastLeg: number;
  /** 첫날 일정 시작까지 분 = 체인 소요 + firstLeg */
  accIn: number;
  windows: number[];
  ctx: Context;
};

const hhmm = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

/** 추천 코스(PoC autoCourse)의 도착 관문 → 첫 장소 어림값(분). 장소를 고르기 전이라 PoC가 「대략」 30분으로 둔다 */
const AUTO_FIRST_LEG = 30;

/**
 * 설정과 첫 · 마지막 장소로 일정 창 · 이동수단 · 체인을 정한다.
 * destination: 첫 장소가 없을 때 광역 교통을 정할 도시.
 * 첫 장소가 없으면 firstLeg = guessFirstLeg(추천 코스는 PoC autoCourse처럼 30분, 그 밖은 0), lastLeg = 0
 */
function planTrip(
  settings: PlannerSettings,
  destination: string | null,
  first?: PlannerPlace,
  last?: PlannerPlace,
  guessFirstLeg = 0,
): TripPlan {
  const dayCount = tripDays(settings.startDate, settings.endDate);
  const regIn = first?.locKo ?? destination;
  const regOut = last?.locKo ?? regIn;
  const hub = regIn ? CITY_HUBS[regIn] : undefined;
  const island = islandOf(regIn);
  const ulleung = regIn === "울릉" || regOut === "울릉";
  const options = wideOptions(hub, island);
  const picked = wideChoiceOf(settings.wideMode);
  const usable =
    picked && options.find((o) => o.choice === picked)?.block === null
      ? picked
      : null;
  const own = usable === "own";
  const jejuOwn = own && island === "jeju";
  const resident = jejuOwn && settings.jejuResident === true;
  const local: TravelMode = own
    ? "own"
    : settings.localMode === "driving"
      ? "driving"
      : "transit";
  const hubLegMode = own || local === "driving" ? "driving" : "transit";
  const dep = toMin(settings.depTime);
  const ret = toMin(settings.retTime);

  const side = (
    key: string,
    city: string | null,
    out: boolean,
  ): ChainSide | null => {
    const h = city ? CITY_HUBS[city] : undefined;
    if (!city || !h || resident) return null;
    const o = originFor(settings, key, city, own, out);
    const opts = {
      own,
      pref: own ? null : usable,
      picked: settings.routePick[city],
      gwPick: settings.gwPick,
      carFerry: own && islandOf(city) === "jeju",
      ulleung: city === "울릉",
    };
    const chain = wideChain(o, key, h, opts);
    if (!chain) return null;
    return {
      city,
      key,
      origin: o,
      chain,
      schedule: chainSchedule(chain, out ? ret : dep, out),
      cands: routeCands(o, key, h, opts),
      gateways: gatewayOptions(chain, o),
      gatewayKey: originKeyOf(chain.gw),
    };
  };
  const originKey = tripOriginKey(settings.origin, ulleung);
  const originEndKey = tripOriginKey(
    settings.originEnd ?? settings.origin,
    ulleung,
  );
  const inbound = side(originKey, regIn, false);
  const outbound = side(originEndKey, regOut, true);

  const hubLeg = (
    s: ChainSide | null,
    place: PlannerPlace | undefined,
    toPlace: boolean,
  ): HubLeg | null => {
    if (!s || !place) return null;
    const hp = s.chain.hubPt;
    const pt = { lat: hp.lat, lng: hp.lng };
    const L = toPlace
      ? legInfo(pt, place, hubLegMode)
      : legInfo(place, pt, hubLegMode);
    return { hub: hp, place, mode: hubLegMode, min: L.min, km: L.km };
  };
  const inLeg = hubLeg(inbound, first, true);
  const outLeg = hubLeg(outbound, last, false);
  const firstLeg = inLeg?.min ?? (inbound && !first ? guessFirstLeg : 0);
  const lastLeg = outLeg?.min ?? 0;
  const accIn = inbound ? inbound.schedule.end - dep + firstLeg : 0;
  const retTime = hhmm(Math.max(0, ret - lastLeg));
  const windows = dayWindows({
    days: dayCount,
    depTime: settings.depTime,
    retTime,
    accIn,
  });
  const wide = inbound ? inbound.chain.mode : null;
  return {
    dayCount,
    destination: regIn,
    hub,
    island,
    ulleung,
    originKey,
    originEndKey,
    carFerry: inbound?.chain.carFerry === true,
    resident,
    options,
    choice: usable ?? wideChoiceOf(wide),
    wide,
    local,
    inbound,
    outbound,
    arrival: own ? null : inLeg,
    firstLeg,
    lastLeg,
    accIn,
    windows,
    ctx: {
      legFn: plannerLegFn(local),
      windows,
      depTime: settings.depTime,
      accIn,
      retTime,
    },
  };
}

export type PlannerSchedule = TripPlan & {
  /** 일자별 일정. 일수만큼 있고, 비어 있는 날도 있다 */
  days: CourseDay[];
  /** 시간이 모자라 일정에 넣지 못한 장소(담은 순서 뒤쪽부터 잘린다) */
  dropped: PlannerPlace[];
  /** 일정에 넣은 경유지 수 */
  stops: number;
  /** 총 이동 거리(km, 소수 1자리) */
  km: number;
  /** 예상 시간(분) = 이동 + 대기 + 체류 */
  minutes: number;
};

/**
 * 담은 장소(담은 순서)에 날짜와 도착 · 출발 시각을 붙인다. 숙박 장소는 빼고 계산한다.
 * fallbackCity: 담은 장소가 없을 때 광역 교통을 정할 도시(지금 고른 도시)
 */
export function buildPlannerSchedule(
  course: readonly PlannerPlace[],
  settings: PlannerSettings,
  fallbackCity: string | null = null,
): PlannerSchedule {
  const { sights: places, stays } = splitStays(course);
  const trip = planTrip(
    settings,
    destinationCity(places, stays[0]?.locKo ?? fallbackCity),
    places[0],
    places.at(-1),
  );
  const { buckets, keep } = splitDays(places, trip.ctx);
  const kept = places.slice(0, keep);
  const timed = timeline(kept, buckets, trip.ctx.legFn, {
    depTime: settings.depTime,
    accIn: trip.accIn,
  });
  const byId = new Map(kept.map((p) => [p.id, p]));
  const days: CourseDay[] = trip.windows.map((_, i) => ({
    day: i + 1,
    stops: timed
      .filter((s) => s.day === i + 1)
      .map((s) => ({ ...s, place: byId.get(s.id)! })),
  }));

  let km = 0;
  for (const d of days)
    d.stops.forEach((s, k) => {
      if (k > 0)
        km += legInfo(
          d.stops[k - 1].place,
          s.place,
          trip.local,
          CITY_HUBS,
          METRO_CITY,
        ).km;
    });

  return {
    ...trip,
    days,
    dropped: places.slice(keep),
    stops: timed.length,
    km: Math.round(km * 10) / 10,
    minutes: timed.reduce((a, s) => a + s.move + s.wait + s.stay, 0),
  };
}

/**
 * 추천 코스. 후보(도시나 권역의 자동 코스 후보)로 autoCourse를 돌린다.
 * 창 · 구간 함수 · 광역 체인은 지금 설정으로 정한다. 도착 도시는 autoCourse가 첫 시군으로 고를 도시(leadCity).
 * autoCourse에 넘기는 창은 PoC autoCourse처럼 체인 소요 + 30분(도착 관문 → 첫 장소 어림)으로 재고 마지막 날 lastLeg는 빼지 않는다.
 * 그 뒤 실제 firstLeg · lastLeg로 다시 나눠 들어가는 만큼만 담는다. 첫 장소까지 먼 도시의 당일 여행이면 빌 수 있다
 */
export function recommendCourse(
  pool: readonly PlannerPlace[],
  settings: PlannerSettings,
  leadCity: string | null,
): PlannerPlace[] {
  const candidates = pool.filter((p) => p.auto && !isStay(p));
  if (candidates.length === 0) return [];
  const trip = planTrip(
    settings,
    leadCity,
    undefined,
    undefined,
    AUTO_FIRST_LEG,
  );
  let course = autoCourse(candidates, {
    days: trip.dayCount,
    windows: trip.windows,
    legFn: trip.ctx.legFn,
    depTime: settings.depTime,
    accIn: trip.accIn,
    waitAware: true,
  });
  // autoCourse는 창 길이만 보고 채워서, 첫날 · 마지막 날 창(도착 관문 ↔ 장소 구간 포함)으로 나누는 일정(splitDays)에
  // 다 들어가지 않을 수 있다. 불러오자마자 「넣지 못한 장소」가 생기지 않게 일정에 들어가는 만큼만 담는다.
  // 마지막 장소가 바뀌면 lastLeg도 바뀌므로 다 들어갈 때까지 다시 잰다
  for (;;) {
    const t = planTrip(settings, leadCity, course[0], course.at(-1));
    const keep = splitDays(course, t.ctx).keep;
    if (keep >= course.length) return course;
    course = course.slice(0, keep);
  }
}

/** 경로 선택 창을 연 도착 도시 · 방향(PoC routeAskOpen) */
export type RouteAskTarget = { city: string; dir: "in" | "out" };

/**
 * 경로 선택 창에 보일 체인 한쪽(PoC routeAsk*). 없으면 null.
 *  - 자가용 · 담은 장소 없음이면 없다
 *  - open(「경로 변경」으로 연 것)이 없으면 스스로 연다: 가는 도착 도시가 고른 경로 · 닫은 기록 없이 후보 2개 이상이면 가는 길,
 *    아니면 돌아오는 도착 도시(가는 도시와 다를 때)가 그러면 돌아오는 길
 *  - 스스로 열 때는 후보가 2개 이상이어야 한다
 */
export function routeAsk(
  plan: PlannerSchedule,
  settings: Pick<PlannerSettings, "routePick">,
  routeSkip: Readonly<Record<string, true>>,
  open: RouteAskTarget | null,
): { target: RouteAskTarget; side: ChainSide } | null {
  if (plan.local === "own" || plan.stops === 0) return null;
  const { inbound, outbound } = plan;
  const fresh = (s: ChainSide | null): s is ChainSide =>
    s !== null &&
    !settings.routePick[s.city] &&
    !routeSkip[s.city] &&
    s.cands.length > 1;
  let target = open;
  if (!target && fresh(inbound)) target = { city: inbound.city, dir: "in" };
  if (!target && outbound?.city !== inbound?.city && fresh(outbound))
    target = { city: outbound.city, dir: "out" };
  if (!target) return null;
  const side = target.dir === "out" ? outbound : inbound;
  if (!side || side.city !== target.city) return null;
  if (side.cands.length < 2 && !open) return null;
  return { target, side };
}
