import {
  DAY_END,
  DEFAULT_DEP,
  DEFAULT_RET,
  HOP,
  MAX_STOPS,
  NO_ORDER,
  OFF_LIST_PENALTY,
  PLACE_WEIGHT_CAP,
  VIDEO_WEIGHT,
} from "./params";
import {
  getThemePlaces,
  makeLegFn,
  ORIGINS,
  type Place,
  REGION_HUB,
  type RegionHub,
} from "./places";
import {
  type AccessMode,
  accessMin,
  autoCourse,
  dayStartClock,
  dayWindows,
  type LegFn,
  openHours,
  type SchedulePlace,
  stayMin,
  timeline,
  type TimelineStop,
  toMin,
  type TravelMode,
} from "./schedule";
import type { TripAnswers } from "./trip";

// 테마 코스 3안 (A 정석 · B 트렌드 · C 한적).
//
// 전략 문서(Tour-Navigator-App/테마 추천 알고리즘/docs/01_고도화_전략.md 434행)의 3안은 같은 후보군에서
// 관광지 점수의 가중치만 바꾼다: A 정석(기본) · B 트렌드(Trend × 2) · C 한적(Crowd × 2, Local × 2).
// 그 데이터가 아직 연결되지 않았다. 그래서 지금은 places.json에 이미 있는 필드만으로 안을 나눈다.
// 숫자(가중치 · 분)는 새로 만들지 않고 params.ts의 기존 값(VIDEO_BONUS 14, OFF_LIST_PENALTY 26, HOP 45 …)만 쓴다.
// 데이터가 연결되면 이 파일의 후보 · 순위 규칙을 전략 문서의 가중치로 바꾼다. 화면에도 같은 안내를 보인다.
//
//  | 안      | 후보                                                     | 순위                                                 |
//  | classic | 테마의 자동 코스 후보(auto) 전체                          | autoCourse. 100선 · 유네스코도 영상 장소처럼 우대     |
//  | trend   | 영상 장소(yt)만. 날짜가 남으면 정석 후보로 나머지를 채움   | autoCourse → 남는 시간을 fillCourse로 채움            |
//  | quiet   | 한국관광100선(k100) · 유네스코(un) · 영상 장소를 뺀 후보   | autoCourse. 힐링·생태(heal) 우대                      |
//
// - 정석: 전략 문서가 유네스코 · 한국관광 100선을 "A안(정석) 시나리오의 필수 후보"로 둔다(275행).
// - 트렌드: 인기(검색 추세) 대신 "영상 속 장소"를 트렌드의 대리 지표로 쓴다.
// - 한적: 혼잡도 대신 "많이 알려진 명소(100선 · 유네스코)"와 "영상 속 장소(테마를 보고 오는 사람이 몰리는 곳)"를
//   붐빌 곳의 대리 지표로 보고 뺀다. 남는 후보는 테마 지역의 확장 장소다.
//   우대하는 분류는 힐링·생태뿐이다. 전략 문서가 낮은 혼잡도와 엮은 분류가 이것이다(228 · 264행).
// - 우대는 autoCourse가 영상 장소에 주는 우대(yt)를 빌려 준다(prioritize).
//   그래서 −14분 순위 우대뿐 아니라 시군 가중치(영상 수 × 2)와 시군 진입 직후 순서(영상 먼저)에도 같이 반영된다.
// - 장소가 적은 테마는 조건에 따라 트렌드가 정석과 같아진다(영월 · 부산의 자가용 · 단체버스 일부, 60개 조건 중 6개).
//   화면이 그 사실을 알린다(sameCourse).
// - 공통 필터: Q14 무장애(accessible)면 무장애(bf) 장소만. 반려동물 · 실내는 장소 데이터가 없어 반영하지 않는다.
//   Q13 하루 걷기도 같다. 전략 문서는 장소별 걷기 난이도 태그로 거르는데(284행) 그 태그가 아직 없다.
//   Q10 출발 시기(계절 · 축제 필터)도 계절 지수 · 축제 데이터가 없어 반영하지 않는다. 화면이 반영하지 않은 조건을 알린다.
// - 출발지 서울역 · 08:00 출발 · 마지막 날 19:00 여행지 출발(귀가) (체류시간 산정 설명서의 기본값).
// - 순위에 개장 대기를 넣는다(autoCourse waitAware). 원본 순위는 이동만 봐서 16:00에 여는 식당을 09:00에 골라
//   420분을 기다리게 했다(RESCENE 정석 · 대중교통 · 1박 이상).

export const PLAN_IDS = ["classic", "trend", "quiet"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export function isPlanId(value: unknown): value is PlanId {
  return (PLAN_IDS as readonly unknown[]).includes(value);
}

/** Q12 보기 id */
export type Transport = "car" | "public-transit" | "flight" | "tour-bus";
const TRANSPORTS: readonly Transport[] = [
  "car",
  "public-transit",
  "flight",
  "tour-bus",
];

/** 한적 안에서 우대하는 분류: 힐링·생태(heal). 전략 문서가 낮은 혼잡도와 엮은 분류 */
const QUIET_CATEGORIES: readonly string[] = ["heal"];

/** 출발지. ORIGINS 키 (서울역) */
const ORIGIN_KEY = "seoul";

export type TripInput = {
  days: number;
  transport: Transport;
  accessible: boolean;
  /** Q14에서 고른, 데이터가 없어 반영하지 못한 조건 */
  ignored: ("pet" | "indoor-rain")[];
  /**
   * Q13 하루 걷기. 전략 문서는 장소별 걷기 난이도(상·중·하) 태그로 거르는데
   * 장소 데이터에 그 태그가 아직 없어 코스에는 반영하지 않고 화면에 안내만 한다
   */
  walk?: Walk;
  /** Q10 출발 시기. 계절 지수 · 축제 데이터가 없어 코스에는 반영하지 않고 화면에 안내만 한다 */
  when?: When;
};

/** Q10 보기 id */
export type When = "this-weekend" | "this-month" | "later";
const WHENS: readonly When[] = ["this-weekend", "this-month", "later"];

/** Q13 보기 id */
export type Walk = "under-1h" | "1-3h" | "over-3h";
const WALKS: readonly Walk[] = ["under-1h", "1-3h", "over-3h"];

/** Q11 → 일수. 없으면 1(당일) */
const DAYS_BY_Q11: Readonly<Record<string, number>> = {
  "day-trip": 1,
  "1-night": 2,
  "2-nights-plus": 3,
};

export function tripFromAnswers(answers: TripAnswers): TripInput {
  const q10 = answers.q10?.[0];
  const q11 = answers.q11?.[0];
  const q12 = answers.q12?.[0];
  const q13 = answers.q13?.[0];
  const q14 = answers.q14 ?? [];
  return {
    days: (q11 && DAYS_BY_Q11[q11]) || 1,
    transport: TRANSPORTS.includes(q12 as Transport)
      ? (q12 as Transport)
      : "car",
    accessible: q14.includes("accessible"),
    ignored: q14.filter(
      (o): o is "pet" | "indoor-rain" => o === "pet" || o === "indoor-rain",
    ),
    walk: WALKS.includes(q13 as Walk) ? (q13 as Walk) : undefined,
    when: WHENS.includes(q10 as When) ? (q10 as When) : undefined,
  };
}

// ── 이동수단 매핑 ───────────────────────────────────────────────────
// schedule.ts의 모드 이름으로 바꾼다.
//  - 시내 구간(legInfo): car → own(자가용, 도로공사 표정속도 모델)
//                        public-transit · flight → transit(대중교통)
//                        tour-bus → driving(차량 모델. 원본의 '자동차(렌트카)' 식)
//  - 광역 접근(accessMin): Tour Planner의 pickMode를 따른다
//      car · tour-bus → own(관문을 거치지 않고 직행). 단 관문에 육로 수단이 없는 지역(제주)은
//                       차로 갈 수 없으므로 관문의 첫 수단(항공)으로 간 뒤 현지에서 차로 다닌다고 본다
//      public-transit → 출발지와 관문이 함께 가진 첫 수단(metro · ktx · srt · bus · air · ship 순), 없으면 관문의 첫 수단
//      flight → 관문에 항공이 있으면 air, 없으면 public-transit과 같다(항공 노선이 없는 지역)
const LEG_MODE: Readonly<Record<Transport, TravelMode>> = {
  car: "own",
  "public-transit": "transit",
  flight: "transit",
  "tour-bus": "driving",
};

const ACCESS_ORDER: readonly AccessMode[] = [
  "metro",
  "ktx",
  "srt",
  "bus",
  "air",
  "ship",
];
const LAND_MODES: readonly AccessMode[] = ["metro", "ktx", "srt", "bus"];

export function legModeFor(transport: Transport): TravelMode {
  return LEG_MODE[transport];
}

export function accessModeFor(
  transport: Transport,
  hub: RegionHub | undefined,
  originModes: readonly AccessMode[] = ORIGINS[ORIGIN_KEY].modes,
): AccessMode {
  const hubModes: readonly AccessMode[] = hub?.modes ?? ["bus"];
  const publicMode =
    ACCESS_ORDER.find((m) => originModes.includes(m) && hubModes.includes(m)) ??
    hubModes[0] ??
    "bus";
  if (transport === "car" || transport === "tour-bus") {
    return hubModes.some((m) => LAND_MODES.includes(m))
      ? "own"
      : (hubModes[0] ?? "own");
  }
  if (transport === "flight")
    return hubModes.includes("air") ? "air" : publicMode;
  return publicMode;
}

// ── 후보 ────────────────────────────────────────────────────────────
function basePool(places: readonly Place[], trip: TripInput): Place[] {
  return places.filter((p) => p.auto && (!trip.accessible || p.bf));
}

/** autoCourse가 체인의 첫 시군으로 고를 시군. 광역 접근 시간(accIn)을 정하는 데 쓴다 (Tour Planner와 같은 규칙) */
export function leadRegion(pool: readonly Place[]): string | null {
  const groups: Record<string, Place[]> = {};
  pool.forEach((p) => {
    (groups[p.locKo] = groups[p.locKo] || []).push(p);
  });
  const weight = (r: string) =>
    groups[r].filter((p) => p.yt).length * VIDEO_WEIGHT +
    Math.min(groups[r].length, PLACE_WEIGHT_CAP);
  const regs = Object.keys(groups).sort((a, b) => weight(b) - weight(a));
  return regs[0] ?? null;
}

// ── 결과 ────────────────────────────────────────────────────────────
export type CourseStop = TimelineStop & { place: Place };
export type CourseDay = { day: number; stops: CourseStop[] };

export type Scenario = {
  plan: PlanId;
  trip: TripInput;
  legMode: TravelMode;
  accessMode: AccessMode;
  /** 서울역 → 첫 시군 관문 접근 분 */
  accIn: number;
  windows: number[];
  /** 일자별 일정. 일수만큼 있고, 비어 있는 날도 있다 */
  days: CourseDay[];
  placeCount: number;
  stayTotal: number;
  moveTotal: number;
};

export type Context = {
  legFn: LegFn;
  windows: readonly number[];
  depTime: string;
  accIn: number;
  /** 마지막 날 여행지 출발(귀가) 시각. 없으면 DEFAULT_RET(19:00). 테마 코스는 늘 기본값이고 투어 플래너가 바꾼다 */
  retTime?: string;
};

/**
 * 일자 나누기. assignDays와 같은 규칙(고른 순서대로 담고, 그날에 안 들어가면 다음 날,
 * 마지막 날에도 안 들어가면 그 뒤를 잘라낸다)에 timeline의 시계를 더했다.
 *  - assignDays는 (이동 + 체류) 합만 보고 개장 대기를 세지 않아서, timeline으로 시각을 붙이면
 *    21:00을 넘기는 날이 생긴다(예: 대기 60분이 낀 날). 그래서 담을 때 timeline과 같은 시계로 잰다:
 *    그날 첫 장소는 이동 0, 개장 전이면 개장까지 대기, 체류를 마친 시각이 그날 끝이나 폐장을 넘으면 다음 날.
 *    (폐장 검사는 autoCourse 5단계와 같은 규칙이다. autoCourse는 날 첫 장소에도 이동을 더해 시계가 조금 다르다)
 *  - 그날 끝은 dayEnd (그날 시작 + 그날 창, 21:00 상한, 마지막 날은 19:00 여행지 출발까지).
 * 시각은 원본 timeline이 붙인다. 이 함수는 날짜 경계만 정한다.
 * 투어 플래너 코스 탭(features/planner/schedule.ts)도 이 함수로 날짜를 나눈다.
 */
export function splitDays<T extends SchedulePlace>(
  items: readonly T[],
  ctx: Context,
): { buckets: number[][]; keep: number } {
  const days = ctx.windows.length;
  const buckets: number[][] = Array.from({ length: days }, () => []);
  const startOf = (d: number) =>
    dayStartClock(d, { depTime: ctx.depTime, accIn: ctx.accIn });
  const endOf = (d: number) => dayEnd(d, ctx);
  let d = 0,
    clock = startOf(0),
    keep = 0;
  for (let i = 0; i < items.length; i++) {
    let placed = false;
    while (d < days) {
      const first = buckets[d].length === 0;
      let at = clock + (first ? 0 : ctx.legFn(items[i - 1], items[i]).min);
      const oh = openHours(items[i]);
      if (oh && at < oh.open) at = oh.open;
      const leave = at + stayMin(items[i]);
      if (leave <= endOf(d) && (!oh || leave <= oh.close)) {
        clock = leave;
        placed = true;
        break;
      }
      if (d === days - 1) break;
      d++;
      clock = startOf(d);
    }
    if (!placed) break;
    buckets[d].push(i);
    keep++;
  }
  return { buckets, keep };
}

function schedule(
  course: readonly Place[],
  ctx: Context,
): { kept: Place[]; stops: TimelineStop[] } {
  const { buckets, keep } = splitDays(course, ctx);
  const kept = course.slice(0, keep);
  const stops = timeline(kept, buckets, ctx.legFn, {
    depTime: ctx.depTime,
    accIn: ctx.accIn,
  });
  return { kept, stops };
}

/**
 * 트렌드 안의 채우기. 영상 장소 코스(base)가 날짜를 다 채우지 못했으면
 * 정석 후보(extra)를 하루씩 앞에서부터 끝에 붙인다.
 * 순위는 autoCourse 5단계와 같다: (이동 + 확장 +26, 시군이 바뀌면 +45)이 작은 순.
 * 붙일 수 있는 조건: 개장 대기 후 폐장 전에 체류를 마치고, 그날 창을 넘지 않고,
 * splitDays로 다시 나눴을 때 이미 담긴 장소의 날짜가 바뀌지 않는다.
 * 시군은 base에 나온 시군만 쓴다.
 */
function fillCourse(
  base: readonly Place[],
  extra: readonly Place[],
  ctx: Context,
): Place[] {
  let list = schedule(base, ctx).kept;
  if (!list.length) return list;
  const regions = new Set(list.map((p) => p.locKo));
  const taken = new Set(list.map((p) => p.id));
  const pool = extra.filter((p) => regions.has(p.locKo) && !taken.has(p.id));
  const days = ctx.windows.length;

  const dayOf = (course: readonly Place[]) => {
    const { buckets } = splitDays(course, ctx);
    const m = new Map<string, number>();
    buckets.forEach((idxs, d) => idxs.forEach((i) => m.set(course[i].id, d)));
    return m;
  };

  for (let d = 0; d < days; d++) {
    while (list.length < MAX_STOPS) {
      const before = dayOf(list);
      // 그날 마지막 장소 바로 뒤 (그날이 비었으면 앞날 마지막 장소 뒤)
      let at = 0;
      list.forEach((p, i) => {
        if ((before.get(p.id) ?? days) <= d) at = i + 1;
      });
      const from = at > 0 ? list[at - 1] : null;
      const cost = (x: Place) =>
        from
          ? ctx.legFn(from, x).min +
            (from.locKo !== x.locKo ? HOP : 0) +
            (x.off ? OFF_LIST_PENALTY : 0)
          : Number(x.n) || NO_ORDER;
      const ranked = pool
        .filter((p) => !taken.has(p.id))
        .sort((x, y) => cost(x) - cost(y));
      let accepted: Place[] | null = null;
      for (const cand of ranked) {
        const next = [...list.slice(0, at), cand, ...list.slice(at)];
        const after = dayOf(next);
        if (after.get(cand.id) !== d) continue;
        if ([...before].some(([id, day]) => after.get(id) !== day)) continue;
        const stop = schedule(next, ctx).stops.find((s) => s.id === cand.id);
        if (!stop) continue;
        const oh = openHours(cand);
        if (oh && stop.leaveMin > oh.close) continue;
        accepted = next;
        taken.add(cand.id);
        break;
      }
      if (!accepted) break;
      list = accepted;
    }
  }
  return list;
}

/**
 * autoCourse에 넘길 우대 표시. autoCourse는 영상 장소(yt)를 먼저 담고(−14분 · 시군 가중치 · 시군 진입 순서)
 * 확장 장소(off)에 +26분을 준다. 안마다 이 두 표시만 바꿔 같은 순위 규칙을 다시 쓴다.
 *  - 정석: 100선 · 유네스코도 영상 장소와 같이 우대한다 (전략 문서 "유네스코·한국관광 100선: A안(정석) 시나리오의 필수 후보")
 *  - 한적: 힐링·생태 장소를 우대한다 (후보에서 영상 장소는 이미 빠져 있다. planPool)
 *  - 트렌드: 표시는 그대로 두고 후보를 영상 장소로 좁힌다 (planCourse)
 */
function prioritize(plan: PlanId, p: Place): Place {
  if (plan === "classic" && (p.k100 || p.un))
    return { ...p, yt: true, off: false };
  if (plan === "quiet") return { ...p, yt: QUIET_CATEGORIES.includes(p.cat) };
  return p;
}

function planCourse(
  plan: PlanId,
  pool: readonly Place[],
  ctx: Context,
  days: number,
): Place[] {
  const opts = {
    days,
    windows: ctx.windows,
    legFn: ctx.legFn,
    depTime: ctx.depTime,
    accIn: ctx.accIn,
    waitAware: true,
  };
  if (plan === "trend") {
    const videos = pool.filter((p) => p.yt);
    const base = autoCourse(videos, opts);
    // 영상 장소로 한 곳도 못 담으면 정석과 같다
    if (!base.length) return planCourse("classic", pool, ctx, days);
    return fillCourse(base, pool, ctx);
  }
  // 우대 표시는 순위에만 쓰고, 결과는 원래 레코드로 되돌린다
  const byId = new Map(pool.map((p) => [p.id, p]));
  return autoCourse(
    pool.map((p) => prioritize(plan, p)),
    opts,
  ).map((p) => byId.get(p.id)!);
}

/** 안별 후보. 한적은 100선 · 유네스코와 영상 장소를 뺀다 */
export function planPool(plan: PlanId, pool: readonly Place[]): Place[] {
  return plan === "quiet"
    ? pool.filter((p) => !p.k100 && !p.un && !p.yt)
    : [...pool];
}

export function buildScenario(
  themeSlug: string,
  plan: PlanId,
  trip: TripInput,
): Scenario {
  const pool = planPool(plan, basePool(getThemePlaces(themeSlug), trip));
  const legMode = legModeFor(trip.transport);
  // 광역 접근은 autoCourse가 첫 시군으로 고를 시군 기준이라, 순위에 쓰는 후보와 같은 후보로 정한다.
  // 트렌드에 영상 장소가 없으면 정석과 같다
  const videos = pool.filter((p) => p.yt);
  const lead =
    plan === "trend" && videos.length
      ? leadRegion(videos)
      : leadRegion(
          pool.map((p) => prioritize(plan === "trend" ? "classic" : plan, p)),
        );
  const hub = lead ? REGION_HUB[lead] : undefined;
  const accessMode = accessModeFor(trip.transport, hub);
  const depTime = DEFAULT_DEP;
  const accIn = accessMin(ORIGINS[ORIGIN_KEY], hub, accessMode);
  const windows = dayWindows({
    days: trip.days,
    depTime,
    retTime: DEFAULT_RET,
    accIn,
  });
  const ctx: Context = { legFn: makeLegFn(legMode), windows, depTime, accIn };

  const course = pool.length ? planCourse(plan, pool, ctx, trip.days) : [];
  const { kept, stops } = schedule(course, ctx);
  const byId = new Map(kept.map((p) => [p.id, p]));
  const days: CourseDay[] = windows.map((_, i) => ({
    day: i + 1,
    stops: stops
      .filter((s) => s.day === i + 1)
      .map((s) => ({ ...s, place: byId.get(s.id)! })),
  }));

  return {
    plan,
    trip,
    legMode,
    accessMode,
    accIn,
    windows,
    days,
    placeCount: stops.length,
    stayTotal: stops.reduce((a, s) => a + s.stay, 0),
    moveTotal: stops.reduce((a, s) => a + s.move, 0),
  };
}

/** 두 안의 코스가 같은지 (장소와 순서, 날짜 나눔까지) */
export function sameCourse(a: Scenario, b: Scenario): boolean {
  const key = (s: Scenario) =>
    s.days.map((d) => d.stops.map((x) => x.id).join(",")).join("|");
  return key(a) === key(b);
}

/** 그날 끝 시각(분). splitDays와 같은 기준(dayEnd) */
export function dayEndClock(scenario: Scenario, dayIdx: number): number {
  return dayEnd(dayIdx, {
    depTime: DEFAULT_DEP,
    accIn: scenario.accIn,
    windows: scenario.windows,
  });
}

/**
 * 그날 끝 시각(분) = 그날 시작 + 그날 창, 21:00 상한. 마지막 날은 여행지 출발(귀가) 시각 19:00도 넘지 않는다.
 * 원본 dayWindows는 마지막 날 창을 "09:00부터 귀가 출발까지의 길이"로 잡는다. 그래서 첫날이 곧 마지막 날인 당일 여행에
 * 늦게 도착하면(부산 자가용 13:45) 창이 21:00까지 남는다. 원본 설명("마지막날은 귀가시간을 미리 확보")대로 끝 시각으로 자른다
 */
function dayEnd(
  d: number,
  ctx: Pick<Context, "depTime" | "accIn" | "windows" | "retTime">,
): number {
  const start = dayStartClock(d, { depTime: ctx.depTime, accIn: ctx.accIn });
  const end = Math.min(start + ctx.windows[d], DAY_END);
  return d === ctx.windows.length - 1
    ? Math.min(end, toMin(ctx.retTime ?? DEFAULT_RET))
    : end;
}
