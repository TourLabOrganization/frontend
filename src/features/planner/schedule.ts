import { METRO_CITY, type RegionHub } from "../course/places";
import { type Context, type CourseDay, splitDays } from "../course/scenarios";
import {
  type AccessMode,
  accessMin,
  autoCourse,
  dayWindows,
  type LegFn,
  legInfo,
  timeline,
  type TravelMode,
} from "../course/schedule";
import type { PlannerSettings, WideMode } from "./course-store";
import { CITY_HUBS, PLANNER_ORIGINS, type PlannerPlace } from "./data";

// 투어 플래너 코스 탭의 일정 계산. 순수 함수만 둔다. 화면(PlannerCourseTab)은 이 결과만 그린다.
//
//  - 일수 = 귀가일 − 출발일 + 1 (당일 = 1). 날짜가 없거나 귀가일이 출발일보다 이르면 당일로 계산한다
//  - 광역 교통(목업 01, 6칸): 버스 · 기차 · 항공 · 배 · 지하철(도시철도) · 자가용
//      · 출발지(ORIGINS modes)와 도착 도시 관문(REGION_HUB modes)이 함께 가진 수단만 고를 수 있다
//      · 기차는 출발지가 SRT역(srt만 있음)이면 srt, 아니면 ktx
//      · 자가용은 관문에 육로 수단(metro · ktx · srt · bus)이 있는 도시만(섬은 차로 갈 수 없다)
//      · 고른 수단을 쓸 수 없으면(출발지를 바꿨을 때 등) metro · 기차 · bus · air · ship · 자가용 순으로 첫 수단을 쓴다
//        (course/scenarios.ts accessModeFor의 대중교통 순서와 같다)
//  - 광역 접근 분 = accessMin(출발지, 관문, 광역 교통). 첫날은 출발 시각 + 접근 분부터 시작한다(dayWindows · dayStartClock)
//  - 현지 이동(목업 02) = legInfo 모드. 광역이 자가용이면 현지도 자가용(own)
//  - 날짜 나누기는 테마 코스와 같은 splitDays(개장 대기 · 폐장 · 그날 끝 · 마지막 날 여행지 출발 시각), 시각은 timeline
//  - 요약: 경유지 수 · 총 거리(같은 날 앞 장소 → 이 장소 구간 legInfo km 합, 소수 1자리) · 예상 시간(이동 + 대기 + 체류)

/** 광역 교통 칸. 목업 순서(버스 · 기차 · 항공 / 배 · 지하철 · 자가용) */
export const WIDE_CHOICES = [
  "bus",
  "rail",
  "air",
  "ship",
  "metro",
  "own",
] as const;
export type WideChoice = (typeof WIDE_CHOICES)[number];

/** 고를 수 없는 이유. noCity 도착 도시 없음 · origin 출발지에 없음 · hub 도착 관문에 없음 · island 섬(자가용) */
export type WideBlock = "noCity" | "origin" | "hub" | "island";

export type WideOption = {
  choice: WideChoice;
  mode: WideMode;
  block: WideBlock | null;
};

/** 자동으로 고를 때의 순서 */
const AUTO_ORDER: readonly WideChoice[] = [
  "metro",
  "rail",
  "bus",
  "air",
  "ship",
  "own",
];
const LAND_MODES: readonly string[] = ["metro", "ktx", "srt", "bus"];

/** 여행 일수 상한. 날짜 칸이 이보다 긴 여행을 막는다 */
export const MAX_TRIP_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const isoTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** 두 날짜(YYYY-MM-DD)의 날 수 차이 */
export function daysBetween(start: string, end: string): number {
  return Math.round((isoTime(end) - isoTime(start)) / DAY_MS);
}

/** YYYY-MM-DD에 n일을 더한 날짜 */
export function addDays(iso: string, n: number): string {
  return new Date(isoTime(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

export type DateError = "order" | "tooLong" | null;

/** 귀가일 검사. 귀가일 < 출발일 · 여행 일수 > MAX_TRIP_DAYS */
export function dateError(start: string, end: string): DateError {
  const diff = daysBetween(start, end);
  if (diff < 0) return "order";
  if (diff + 1 > MAX_TRIP_DAYS) return "tooLong";
  return null;
}

/** 여행 일수. 날짜가 없거나 잘못되면 1(당일) */
export function tripDays(start: string | null, end: string | null): number {
  if (!start || !end || dateError(start, end)) return 1;
  return daysBetween(start, end) + 1;
}

/** 기차 칸의 수단. 출발지가 SRT역(srt만 있음)이면 srt, 아니면 ktx */
export function railMode(originModes: readonly string[]): "ktx" | "srt" {
  return originModes.includes("srt") && !originModes.includes("ktx")
    ? "srt"
    : "ktx";
}

/** 광역 교통 6칸과 고를 수 없는 이유 */
export function wideOptions(
  originKey: string,
  hub: RegionHub | undefined,
): WideOption[] {
  const originModes: readonly string[] =
    PLANNER_ORIGINS[originKey]?.modes ?? [];
  const hubModes: readonly string[] = hub?.modes ?? [];
  return WIDE_CHOICES.map((choice) => {
    const mode: WideMode = choice === "rail" ? railMode(originModes) : choice;
    let block: WideBlock | null = null;
    if (!hub) block = "noCity";
    else if (choice === "own") {
      if (!hubModes.some((m) => LAND_MODES.includes(m))) block = "island";
    } else if (!originModes.includes(mode)) block = "origin";
    else if (!hubModes.includes(mode)) block = "hub";
    return { choice, mode, block };
  });
}

/** 실제로 쓸 광역 교통. 고른 수단을 쓸 수 없으면 AUTO_ORDER의 첫 수단, 하나도 없으면 null */
export function resolveWide(
  chosen: WideMode | null,
  options: readonly WideOption[],
): WideMode | null {
  const open = options.filter((o) => o.block === null);
  const picked = chosen
    ? open.find(
        (o) =>
          o.mode === chosen ||
          (o.choice === "rail" && (chosen === "ktx" || chosen === "srt")),
      )
    : undefined;
  if (picked) return picked.mode;
  for (const c of AUTO_ORDER) {
    const o = open.find((x) => x.choice === c);
    if (o) return o.mode;
  }
  return null;
}

/** 실제로 쓸 현지 이동(legInfo 모드). 광역이 자가용이면 자가용 */
export function resolveLocal(
  wide: WideMode | null,
  chosen: PlannerSettings["localMode"],
): TravelMode {
  if (wide === "own") return "own";
  return chosen === "driving" ? "driving" : "transit";
}

/** 투어 플래너의 구간 함수. 관문은 플래너 데이터(regions.json hubs)를 쓴다 */
export function plannerLegFn(mode: TravelMode): LegFn {
  return (p, q) => legInfo(p, q, mode, CITY_HUBS, METRO_CITY);
}

/** 광역 교통이 닿는 도시: 코스 첫 장소의 도시, 없으면 고른 도시 */
export function destinationCity(
  places: readonly PlannerPlace[],
  fallback: string | null,
): string | null {
  return places[0]?.locKo ?? fallback;
}

export type TripPlan = {
  dayCount: number;
  destination: string | null;
  hub: RegionHub | undefined;
  options: WideOption[];
  wide: WideMode | null;
  local: TravelMode;
  /** 출발지 → 관문 광역 접근 분 */
  accIn: number;
  windows: number[];
  ctx: Context;
};

/** 설정과 도착 도시로 일정 창 · 이동수단을 정한다 */
export function planTrip(
  settings: PlannerSettings,
  destination: string | null,
): TripPlan {
  const dayCount = tripDays(settings.startDate, settings.endDate);
  const hub = destination ? CITY_HUBS[destination] : undefined;
  const options = wideOptions(settings.origin, hub);
  const wide = resolveWide(settings.wideMode, options);
  const local = resolveLocal(wide, settings.localMode);
  const origin = PLANNER_ORIGINS[settings.origin];
  const accIn =
    wide && hub ? accessMin(origin, hub, wide satisfies AccessMode) : 0;
  const windows = dayWindows({
    days: dayCount,
    depTime: settings.depTime,
    retTime: settings.retTime,
    accIn,
  });
  return {
    dayCount,
    destination,
    hub,
    options,
    wide,
    local,
    accIn,
    windows,
    ctx: {
      legFn: plannerLegFn(local),
      windows,
      depTime: settings.depTime,
      accIn,
      retTime: settings.retTime,
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
 * 담은 장소(담은 순서)에 날짜와 도착 · 출발 시각을 붙인다.
 * fallbackCity: 담은 장소가 없을 때 광역 교통을 정할 도시(지금 고른 도시)
 */
export function buildPlannerSchedule(
  places: readonly PlannerPlace[],
  settings: PlannerSettings,
  fallbackCity: string | null = null,
): PlannerSchedule {
  const trip = planTrip(settings, destinationCity(places, fallbackCity));
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
 * 창 · 구간 함수 · 광역 접근 분은 지금 설정으로 정한다. 도착 도시는 autoCourse가 첫 시군으로 고를 도시(leadCity)
 */
export function recommendCourse(
  pool: readonly PlannerPlace[],
  settings: PlannerSettings,
  leadCity: string | null,
): PlannerPlace[] {
  const candidates = pool.filter((p) => p.auto);
  if (candidates.length === 0) return [];
  const trip = planTrip(settings, leadCity);
  return autoCourse(candidates, {
    days: trip.dayCount,
    windows: trip.windows,
    legFn: trip.ctx.legFn,
    depTime: settings.depTime,
    accIn: trip.accIn,
    waitAware: true,
  });
}
