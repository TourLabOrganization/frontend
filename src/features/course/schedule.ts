import {
  AIR_BASE,
  AIR_PER_KM,
  BUS_BASE,
  BUS_PER_KM,
  DAY,
  DAY_END,
  DAY_START,
  DEFAULT_DEP,
  DEFAULT_RET,
  DETOUR,
  DETOUR_CAR,
  DRIVE_BASE,
  DRIVE_PER_KM,
  DRIVE_SHORT_BASE,
  DRIVE_SHORT_KM,
  DRIVE_SHORT_PER_KM,
  EARTH_RADIUS_KM,
  HOP,
  LEG_MIN_FLOOR,
  MAX_STOPS,
  METRO_BASE,
  METRO_PER_KM,
  METRO_XFER,
  NO_ORDER,
  OFF_LIST_PENALTY,
  OWN_CITY_KM,
  OWN_CITY_KMH,
  OWN_HWY_KMH,
  OWN_RAMP_MIN,
  OWN_REST_EVERY,
  OWN_REST_MIN,
  PLACE_WEIGHT_CAP,
  RAIL_BASE,
  RAIL_PER_KM,
  REGION_MIN_STOPS,
  SHIP_BASE,
  SHIP_PER_KM,
  STOPS_PER_DAY,
  TRANSIT_BASE,
  TRANSIT_PER_KM,
  TRANSIT_SHORT_KM,
  TRANSIT_SHORT_MIN,
  TRANSIT_SHORT_PER_KM,
  VIDEO_BONUS,
  VIDEO_WEIGHT,
  WIDE_XFER,
} from "./params";

// 관광지 체류 시간 · 일정 시간 산정. 순수 함수만 둔다.
// 출처: Tour-Navigator-App/체류시간 산정/stay_schedule.js 를 그대로 옮기고 타입만 붙였다.
// 함수 이름 · 식 · 분기 순서를 바꾸지 않는다 (부동소수 연산 순서까지 원본과 같게 둔다).
// 단위: 시간은 모두 '분', 거리는 'km'. 시각은 0시 기준 경과 분(09:00 = 540).

export type LatLng = { lat: number; lng: number };

/** 이동 계산에 쓰는 점. 장소든 시군 중심점이든 된다 */
export type LegPoint = LatLng & { id?: string; locKo?: string };

/** stay_schedule.js가 읽는 장소 레코드 필드 */
export type SchedulePlace = LegPoint & {
  id: string;
  ko: string;
  cat: string;
  /** 권장 체류 분 */
  min?: number | null;
  /** 운영시간 원문 */
  hrs?: string | null;
  /** 영상 장소 (원본은 영상 id 문자열, 여기서는 참/거짓으로도 받는다) */
  yt?: boolean | string | null;
  /** 확장(목록 외) 장소 */
  off?: boolean | null;
  /** 화면 순번. 확장 장소는 없다 */
  n?: number | string | null;
};

export type TravelMode = "transit" | "driving" | "own";
export type AccessMode =
  "air" | "ship" | "metro" | "ktx" | "srt" | "bus" | "own";

export type Hub = { modes?: readonly string[] };
export type LegResult = { km: number; min: number; wide: boolean; own?: true };
export type LegFn = (p: LegPoint, q: LegPoint) => { min: number };

// ── 1. 체류 시간 ─────────────────────────────────────────────────────
/** 장소의 권장 체류 분. 데이터의 min 필드를 그대로 쓰고, 없으면 0(코스에 넣지 않음). */
export function stayMin(place: { min?: number | null }): number {
  return place.min || 0;
}

/** 체류 분을 '1h 30m' 꼴로 표기. */
export function fmtStay(min: number): string {
  if (!min) return "0m";
  return min >= 60
    ? Math.floor(min / 60) + "h" + (min % 60 ? " " + (min % 60) + "m" : "")
    : min + "m";
}

// ── 2. 운영시간 ─────────────────────────────────────────────────────
/**
 * 운영시간 문자열에서 여닫는 시각을 뽑는다. 'HH:MM–HH:MM' 꼴이 없으면 null(상시 개방).
 * 폐장이 개장보다 이르면 자정을 넘긴 것으로 본다.
 */
export function openHours(place: {
  hrs?: string | null;
}): { open: number; close: number } | null {
  const raw = String(place.hrs || "");
  const m = raw.match(/(\d{1,2}):(\d{2})\s*[–~\-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const open = +m[1] * 60 + +m[2];
  let close = +m[3] * 60 + +m[4];
  if (close <= open) close += 24 * 60;
  return { open, close };
}

// ── 3. 거리 · 이동 시간 ─────────────────────────────────────────────
/** 두 좌표의 직선거리(km). 위도 보정 등거리 근사. */
export function straightKm(p: LatLng, q: LatLng): number {
  const R = EARTH_RADIUS_KM;
  const dLa = ((q.lat - p.lat) * Math.PI) / 180;
  const dLo = ((q.lng - p.lng) * Math.PI) / 180;
  const la = (((p.lat + q.lat) / 2) * Math.PI) / 180;
  return R * Math.hypot(dLa, dLo * Math.cos(la));
}

/**
 * 자가용 주행 시간. 한국도로공사 고속도로 표정속도(약 92km/h) 모델.
 *  - 20km 이내: 시내도로 35km/h
 *  - 그 이상: 진출입 15분 + 시내 20km 구간 + 고속도로 구간
 *  - 2시간을 넘기면 2시간마다 휴게소 정차 15분 가산
 */
export function ownDriveMin(a: LatLng, b: LatLng): number {
  const d = straightKm(a, b) * DETOUR_CAR;
  if (d <= OWN_CITY_KM)
    return Math.max(LEG_MIN_FLOOR, Math.round((d / OWN_CITY_KMH) * 60));
  const run =
    OWN_RAMP_MIN +
    (OWN_CITY_KM / OWN_CITY_KMH) * 60 +
    ((d - OWN_CITY_KM) / OWN_HWY_KMH) * 60;
  const rest = Math.floor(run / OWN_REST_EVERY) * OWN_REST_MIN;
  return Math.round(run + rest);
}

/**
 * 두 장소 사이 이동 시간 · 거리 추정.
 *  mode: 'transit'(대중교통, 기본) | 'driving'(렌터카) | 'own'(자가용)
 *  hubs: { [시군명]: { modes:[...] } } — 시군 간 구간의 철도 여부 판단에 씀 (선택)
 *  metroCities: { [시군명]: true } — 전철권 시군 (선택)
 *
 * 시군(locKo)이 다른 '광역 구간'은 Google 대중교통 대신 KTX · 고속버스 계수를 쓴다.
 * 앱은 Google Directions 실측이 있으면 그 값을 우선 쓰지만, 이 모듈은 추정식만 구현한다.
 */
export function legInfo(
  p: LegPoint,
  q: LegPoint,
  mode: TravelMode = "transit",
  hubs: Readonly<Record<string, Hub>> = {},
  metroCities: Readonly<Record<string, unknown>> = {},
): LegResult {
  const wide = !!(p.locKo && q.locKo && p.locKo !== q.locKo);
  const d = straightKm(p, q) * DETOUR;
  if (mode === "own") return { km: d, min: ownDriveMin(p, q), wide, own: true };
  let min: number;
  if (wide) {
    const ha = hubs[p.locKo!] || { modes: ["bus"] };
    const hb = hubs[q.locKo!] || { modes: ["bus"] };
    const metro = !!(metroCities[p.locKo!] && metroCities[q.locKo!]);
    const rail = ["ktx", "srt"].some(
      (x) => (ha.modes || []).includes(x) && (hb.modes || []).includes(x),
    );
    // 전철권 내부는 환승 여유를 짧게(15분), 철도 · 버스는 발권 · 대기 35분
    min = metro
      ? METRO_BASE + d * METRO_PER_KM + METRO_XFER
      : (rail ? RAIL_BASE + d * RAIL_PER_KM : BUS_BASE + d * BUS_PER_KM) +
        WIDE_XFER;
  } else if (mode === "transit") {
    // 도보권 11분/km, 그 밖은 대기 15분 + 3.6분/km
    min =
      d <= TRANSIT_SHORT_KM
        ? Math.max(TRANSIT_SHORT_MIN, d * TRANSIT_SHORT_PER_KM)
        : TRANSIT_BASE + d * TRANSIT_PER_KM;
  } else {
    // 렌터카: 시내 2.2분/km, 장거리 1.05분/km
    min =
      d <= DRIVE_SHORT_KM
        ? DRIVE_SHORT_BASE + d * DRIVE_SHORT_PER_KM
        : DRIVE_BASE + d * DRIVE_PER_KM;
  }
  return { km: d, min: Math.max(LEG_MIN_FLOOR, Math.round(min)), wide };
}

/**
 * 출발지(역 · 터미널 · 공항) → 지역 관문까지 광역 접근 시간.
 *  mode: 'air' | 'ship' | 'metro' | 'ktx' | 'srt' | 'bus' | 'own'
 */
export function accessMin(
  origin: LatLng | null | undefined,
  hub: Partial<LatLng> | null | undefined,
  mode: AccessMode | string,
): number {
  if (!origin || !hub) return 0;
  const to = hub.lat && hub.lng ? (hub as LatLng) : origin;
  if (mode === "own") return ownDriveMin(origin, to);
  const d = straightKm(origin, to) * DETOUR;
  if (mode === "air") return Math.round(AIR_BASE + d * AIR_PER_KM); // 수속 · 탑승 대기 + 순항
  if (mode === "ship") return Math.round(SHIP_BASE + d * SHIP_PER_KM); // 승선 수속 + 여객선 약 40km/h
  if (mode === "metro") return Math.round(METRO_BASE + d * METRO_PER_KM); // 광역전철 약 63km/h + 승강장 이동
  if (mode === "ktx" || mode === "srt")
    return Math.round(RAIL_BASE + d * RAIL_PER_KM); // 고속선 약 200km/h
  return Math.round(BUS_BASE + d * BUS_PER_KM); // 고속버스 약 110km/h
}

// ── 4. 일자 창 (하루에 쓸 수 있는 분) ──────────────────────────────
export type TripOptions = {
  days?: number;
  depTime?: string;
  retTime?: string;
  accIn?: number;
  hasTrip?: boolean;
};

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * 날짜별 활동 가능 분.
 *  - 중간일: 720분 (09:00–21:00)
 *  - 첫날: 21:00 − (출발 시각 + 광역 접근 시간), 720분 상한
 *  - 마지막날: 여행지 출발 시각 − 09:00, 720분 상한
 *  - 당일치기(1일)면 첫날 · 마지막날 규칙이 함께 적용
 */
export function dayWindows({
  days = 1,
  depTime = DEFAULT_DEP,
  retTime = DEFAULT_RET,
  accIn = 0,
  hasTrip = true,
}: TripOptions): number[] {
  if (!hasTrip) return [DAY];
  const dep = toMin(depTime),
    ret = toMin(retTime);
  const w: number[] = [];
  for (let i = 0; i < days; i++) {
    let avail = DAY;
    if (i === 0) avail = Math.max(0, Math.min(DAY, DAY_END - (dep + accIn)));
    if (i === days - 1)
      avail = Math.min(avail, Math.max(0, Math.min(DAY, ret - DAY_START)));
    w.push(avail);
  }
  return w;
}

/** 첫날은 출발 + 접근 시간이 09:00 을 넘기면 그 시각부터, 나머지 날은 09:00 부터 시작. */
export function dayStartClock(
  dayIdx: number,
  { depTime = DEFAULT_DEP, accIn = 0, hasTrip = true }: TripOptions = {},
): number {
  if (!hasTrip || dayIdx !== 0) return DAY_START;
  const [h, m] = depTime.split(":").map(Number);
  return Math.max(DAY_START, h * 60 + m + accIn);
}

// ── 5. 코스를 일자에 배정 ────────────────────────────────────────────
/**
 * 사용자가 고른 순서 그대로 (이동 + 체류) 를 누적해 일자 창에 담는다.
 * 창을 넘기면 다음 날로 넘어가고, 마지막 날에도 안 들어가는 경유지는 잘라낸다(trim).
 * 반환: { buckets: [[idx,…], …], keep: 담긴 경유지 수 }
 */
export function assignDays<T extends SchedulePlace>(
  items: readonly T[],
  windows: readonly number[],
  legFn: LegFn,
): { buckets: number[][]; keep: number } {
  const days = windows.length;
  const buckets: number[][] = Array.from({ length: days }, () => []);
  let d = 0,
    used = 0,
    keep = 0;
  for (let i = 0; i < items.length; i++) {
    const legIn = i > 0 ? legFn(items[i - 1], items[i]).min : 0;
    const stay = stayMin(items[i]);
    let placed = false;
    while (d < days) {
      if (used + legIn + stay <= windows[d]) {
        used += legIn + stay;
        placed = true;
        break;
      }
      if (d === days - 1) break;
      d++;
      used = 0;
    }
    if (!placed) break;
    buckets[d].push(i);
    keep++;
  }
  return { buckets, keep };
}

// ── 6. 도착 · 출발 시각 시계 ────────────────────────────────────────
export type TimelineStop = {
  day: number;
  order: number;
  id: string;
  name: string;
  cat: string;
  move: number;
  wait: number;
  stay: number;
  arrive: string;
  leave: string;
  arriveMin: number;
  leaveMin: number;
  closesBefore: boolean;
};

/**
 * 일자별 경유지에 도착 · 출발 시각을 붙인다.
 * 시계는 그날 시작 시각에서 출발해 이동 시간을 더하고, 개장 전이면 개장까지 기다린 뒤,
 * 체류 시간만큼 머문다. (표시용 시계는 폐장 시각을 검사하지 않는다 — 자동 코스만 검사)
 */
export function timeline<T extends SchedulePlace>(
  items: readonly T[],
  buckets: readonly (readonly number[])[],
  legFn: LegFn,
  opts: TripOptions = {},
): TimelineStop[] {
  const hm = (t: number) =>
    String(Math.floor(t / 60) % 24).padStart(2, "0") +
    ":" +
    String(t % 60).padStart(2, "0");
  const out: TimelineStop[] = [];
  buckets.forEach((idxs, day) => {
    let clk = dayStartClock(day, opts);
    idxs.forEach((idx, k) => {
      const p = items[idx];
      const move = k > 0 ? legFn(items[idxs[k - 1]], p).min : 0;
      clk += move;
      const oh = openHours(p);
      let wait = 0;
      if (oh && clk < oh.open) {
        wait = oh.open - clk;
        clk = oh.open;
      }
      const at = clk;
      const stay = stayMin(p);
      clk += stay;
      out.push({
        day: day + 1,
        order: k + 1,
        id: p.id,
        name: p.ko,
        cat: p.cat,
        move,
        wait,
        stay,
        arrive: hm(at),
        leave: hm(clk),
        arriveMin: at,
        leaveMin: clk,
        closesBefore: oh ? clk > oh.close : false,
      });
    });
  });
  return out;
}

// ── 7. 자동 코스 ────────────────────────────────────────────────────
export type AutoCourseOptions = {
  days?: number;
  windows?: readonly number[];
  regions?: readonly string[] | null;
  legFn: LegFn;
  depTime?: string;
  accIn?: number;
  hasTrip?: boolean;
  cityKo?: string;
  /**
   * 4단계 순위에 개장 대기도 넣는다. 원본(false)은 이동만 보고 골라, 개장 전인 식당을 아침 첫 장소로 골라
   * 몇 시간씩 기다리게 할 수 있다(예: 16:00에 여는 곳을 09:00에 골라 대기 420분).
   * 원본 재현 테스트가 있어 기본값은 원본대로 두고, 코스 3안(scenarios.ts)만 켠다
   */
  waitAware?: boolean;
};

/**
 * 시군(클러스터) 단위로 날짜를 배분하고 창 안에서 후보를 채운다.
 *  1. 후보 = min>0 이고 숙박(stay)이 아닌 장소. regions 를 주면 그 시군만
 *  2. 시군 가중치 = 영상 장소 수 × 2 + min(장소 수, 8). 날짜가 시군 수보다 적으면 상위 시군만
 *  3. 시군을 가까운 순서로 체인, 일수는 시군마다 1일 + 남는 날을 가중치 순으로
 *  4. 후보 순위: 시군 진입 직후는 영상 장소 → 순번, 그 뒤는 (이동 + 확장장소 26 − 영상 14) 가 작은 순
 *  5. 각 후보에 대해 이동(시군을 넘으면 +45) → 개장 전이면 대기 → 폐장 전에 못 끝내면 건너뜀
 *     → 그날 창을 넘기면 다음 후보. 후보가 없으면 다음 날, 다음 날도 없으면 다음 시군
 *  6. 한 시군에서 max(2, 배분일수 × 3) 곳을 담으면 다음 시군으로. 총 18곳 상한
 */
export function autoCourse<T extends SchedulePlace>(
  places: readonly T[],
  {
    days = 1,
    windows,
    regions = null,
    legFn,
    depTime = DEFAULT_DEP,
    accIn = 0,
    hasTrip = true,
    cityKo = "",
    waitAware = false,
  }: AutoCourseOptions,
): T[] {
  const regOf = (p: T) => p.locKo || cityKo;
  const all = places.filter((p) => stayMin(p) > 0 && p.cat !== "stay");
  const pool0 =
    regions && regions.length
      ? all.filter((p) => regions.includes(regOf(p)))
      : all;
  if (!pool0.length) return [];
  const groups: Record<string, T[]> = {};
  pool0.forEach((p) => {
    (groups[regOf(p)] = groups[regOf(p)] || []).push(p);
  });
  const cen = (r: string): LegPoint => {
    const g = groups[r];
    return {
      id: "c_" + r,
      lat: g.reduce((a, p) => a + p.lat, 0) / g.length,
      lng: g.reduce((a, p) => a + p.lng, 0) / g.length,
    };
  };
  const weight = (r: string) =>
    groups[r].filter((p) => p.yt).length * VIDEO_WEIGHT +
    Math.min(groups[r].length, PLACE_WEIGHT_CAP);
  let regs = Object.keys(groups).sort((a, b) => weight(b) - weight(a));
  if (regs.length > days) regs = regs.slice(0, days);
  const chain = [regs.shift()!];
  while (regs.length) {
    const last = cen(chain[chain.length - 1]);
    regs.sort((a, b) => legFn(last, cen(a)).min - legFn(last, cen(b)).min);
    chain.push(regs.shift()!);
  }
  const alloc: Record<string, number> = {};
  chain.forEach((r) => (alloc[r] = 1));
  let left = days - chain.length;
  const byW = chain.slice().sort((a, b) => weight(b) - weight(a));
  for (let i = 0; left > 0; i++, left--) alloc[byW[i % byW.length]]++;
  const win = windows || dayWindows({ days, depTime, accIn, hasTrip });

  const out: T[] = [];
  let cur: T | null = null,
    ri = 0,
    dayIdx = 0,
    used = 0,
    placedInRegion = 0;
  const pool: Record<string, T[]> = {};
  chain.forEach((r) => (pool[r] = groups[r].slice()));
  const rank = (r: string): T[] => {
    const g = pool[r];
    if (!g || !g.length) return [];
    if (!cur || regOf(cur) !== r)
      return g
        .slice()
        .sort(
          (x, y) =>
            (y.yt ? 1 : 0) - (x.yt ? 1 : 0) ||
            (Number(x.n) || NO_ORDER) - (Number(y.n) || NO_ORDER),
        );
    const from: T = cur;
    const wait = (x: T) => {
      const oh = waitAware ? openHours(x) : null;
      const arrive = clock + legFn(from, x).min;
      return oh && arrive < oh.open ? oh.open - arrive : 0;
    };
    const cost = (x: T) =>
      legFn(from, x).min +
      (x.off ? OFF_LIST_PENALTY : 0) +
      (x.yt ? -VIDEO_BONUS : 0) +
      wait(x);
    return g.slice().sort((x, y) => cost(x) - cost(y));
  };
  let clock = dayStartClock(0, { depTime, accIn, hasTrip });
  while (dayIdx < days && out.length < MAX_STOPS) {
    const r = chain[Math.min(ri, chain.length - 1)];
    const ranked = rank(r);
    if (!ranked.length) {
      if (ri < chain.length - 1) {
        ri++;
        placedInRegion = 0;
        continue;
      }
      dayIdx++;
      used = 0;
      clock = dayStartClock(dayIdx, { depTime, accIn, hasTrip });
      if (dayIdx >= days) break;
      continue;
    }
    let taken: T | null = null,
      tCost = 0;
    for (const cand of ranked) {
      const cross = cur && regOf(cur) !== r;
      const move = cur
        ? cross
          ? legFn(cur, cand).min + HOP
          : legFn(cur, cand).min
        : 0;
      const stay = stayMin(cand);
      let arrive = clock + move,
        wait = 0;
      const oh = openHours(cand);
      if (oh) {
        if (arrive < oh.open) {
          wait = oh.open - arrive;
          arrive = oh.open;
        }
        if (arrive + stay > oh.close) continue;
      }
      const cost = move + wait + stay;
      if (used + cost > win[dayIdx]) continue;
      taken = cand;
      tCost = cost;
      break;
    }
    if (!taken) {
      if (dayIdx < days - 1) {
        dayIdx++;
        used = 0;
        clock = dayStartClock(dayIdx, { depTime, accIn, hasTrip });
        continue;
      }
      if (ri < chain.length - 1) {
        ri++;
        placedInRegion = 0;
        continue;
      }
      break;
    }
    used += tCost;
    clock += tCost;
    out.push(taken);
    cur = taken;
    placedInRegion++;
    pool[r].splice(pool[r].indexOf(taken), 1);
    if (
      placedInRegion >=
        Math.max(REGION_MIN_STOPS, Math.round(alloc[r] * STOPS_PER_DAY)) &&
      ri < chain.length - 1
    ) {
      ri++;
      placedInRegion = 0;
    }
  }
  return out;
}
