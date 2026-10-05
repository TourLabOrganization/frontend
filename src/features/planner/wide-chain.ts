import {
  type AccessMode,
  accessMin,
  ownDriveMin,
  straightKm,
} from "../course/schedule";
import wideData from "./data/wide.json";
import {
  type Island,
  islandPorts,
  islandSailMin,
  isPortRoute,
  portIslandArg,
} from "./island";
import { PLANNER_ORIGINS, type PlannerHub } from "./regions";

// 투어 플래너 광역 체인. PoC Tour Planner.dc.html의 규칙을 그대로 옮긴 순수 함수만 둔다.
//   출발지 → (전철 접근 구간) → 출발 관문(역 · 터미널 · 공항 · 항만) → 환승 대기 → 광역 본 구간 → 도착 관문
//   예: 운길산역 → 서울역(KTX) → 신경주역
//
// 옮긴 것(PoC 이름): WIDE_ALLOW · wideOriginFilter · airTwin · gwWideOf · wideOrder · ORIGIN_ALT(data/wide.json)
//   · originOptions(출발지 목록 거르기 · 정렬) · wideChain · routeCands · chainSchedule(시간표 API가 없을 때의 분기)
//   · dayPlan의 gw(환승 관문 고르기)
//   · wideChain의 제주 자가용 카페리(carFerry) · 항구 섬(울릉 · 백령도 · 연평도) 배 본 구간(accessMin 울릉 분기, island.ts)
// 옮기지 않은 것:
//   - 시간표 API(TAGO 열차 · 고속버스 · 지하철, 부산교통공사) 분기와 공항 수속 실측(getAirportProcess). 키가 필요하다.
//     공항 본 구간은 수속 실측이 없을 때의 PoC 기본값 90분을 쓴다
//   - 지도 검색으로 더한 출발지(custom · viaKey · 택시 · 차량 접근 구간). 카카오 REST 키가 필요하다
//   - 카페리 항만까지 운전의 카카오모빌리티 실측(ownDriveMin real). 키가 필요해 PoC 기본 식(ownDriveMin)만 쓴다

/** 체인의 한 점. 출발지(PLANNER_ORIGINS의 값 그대로) · 고른 전철역 · 도착 관문 */
export type ChainPoint = {
  ko: string;
  en: string;
  lat: number;
  lng: number;
  modes?: readonly AccessMode[];
  route?: string;
  /** 항구 섬(울릉 · 백령도 · 연평도) 항로 고정 항해 시간(분) */
  sailMin?: number;
};

/** 광역 본 구간 수단(자가용 포함) */
export type ChainMode =
  "bus" | "ktx" | "srt" | "air" | "ship" | "metro" | "own";

/** 광역 교통 칸(목업 6칸) */
export type WideChoice = "bus" | "rail" | "air" | "ship" | "metro" | "own";

/** 구간 수단. car 항만까지 운전(카페리), carferry 카페리 본 구간(차량 선적 · 하선 포함) */
export type LegMode = ChainMode | "car" | "carferry";

export type ChainLeg = {
  from: ChainPoint;
  to: ChainPoint;
  mode: LegMode;
  min: number;
  /** 광역 본 구간 */
  main?: true;
};

export type WideChain = {
  mode: ChainMode;
  /** 출발 관문 */
  gw: ChainPoint;
  /** 도착 관문 */
  hubPt: ChainPoint;
  legs: ChainLeg[];
  /** 제주 자가용 카페리(PoC wideChain carFerry). 본 구간 수단(mode)은 ship */
  carFerry?: true;
};

export type ChainStep = {
  /** 이 점에 있는 시각(분, 0시 기준) */
  t: number;
  place: ChainPoint;
  first?: true;
  /** 이 점에 닿은 구간 */
  leg?: ChainLeg;
  /** 다음 구간을 기다린 분 */
  wait?: number;
  /** 다음 구간 출발 시각 */
  depAt?: number;
};

const ORIGINS = PLANNER_ORIGINS;
/** 같은 권역의 수단별 대체 관문(PoC ORIGIN_ALT) */
const ORIGIN_ALT = wideData.originAlt as Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

/** PoC wideChain · accessMin의 우회 계수(직선거리 × 1.35) */
const DETOUR = 1.35;
/** 전철 접근 구간: 15 + km × 1.2 (PoC wideChain) */
const ACCESS_BASE = 15;
const ACCESS_PER_KM = 1.2;
/** 광역 본 구간 (PoC wideChain main). 공항은 수속 실측이 없을 때 90분 */
const MAIN = {
  air: (d: number) => 90 + d * 0.11,
  ship: (d: number) => 60 + d * 0.85,
  metro: (d: number) => 12 + d * 0.95,
  ktx: (d: number) => 18 + d * 0.3,
  srt: (d: number) => 18 + d * 0.3,
} as const;
/** 버스 본 구간(PoC wideChain의 나머지 분기) */
const MAIN_BUS = (d: number) => 20 + d * 0.68;
/** 서울권 기본 관문(PoC wideChain P): 70km 안이면 이 관문을 쓴다 */
const PRIMARY_GW: Readonly<Record<string, string>> = {
  bus: "centralcity",
  ktx: "seoul",
  srt: "suseo",
};
const PRIMARY_GW_KM = 70;
/** 환승 관문 고르기: 출발지에서 90km 안, 가까운 순 8곳(PoC dayPlan gw) */
const GW_PICK_KM = 90;
const GW_PICK_MAX = 8;
/** 본 구간 앞 환승 여유 15분 뒤 10분 단위 올림, 접근 구간 뒤 10분(PoC chainSchedule) */
const XFER_MAIN = 15;
const XFER_ROUND = 10;
const XFER_ACCESS = 10;
/** 카페리 차량 선적 · 하선(분, PoC wideChain carFerry main + 30) */
const CAR_FERRY_LOAD = 30;

const modesOf = (p: ChainPoint | undefined): readonly string[] =>
  p?.modes ?? ["bus"];

// ── 수단 → 출발지 (PoC WIDE_ALLOW · wideOriginFilter · airTwin · gwWideOf) ──

/** 광역 교통 칸이 받는 관문 수단 */
export const WIDE_ALLOW: Readonly<Record<string, readonly string[]>> = {
  bus: ["bus"],
  rail: ["ktx", "srt"],
  air: ["air"],
  ship: ["ship"],
  metro: ["metro"],
};

/** 고른 광역 교통에 맞는 관문만 남긴다. 맞는 곳이 없으면 전체 유지 */
export function wideOriginFilter(
  keys: readonly string[],
  choice: string | null | undefined,
): string[] {
  const al = choice ? WIDE_ALLOW[choice] : undefined;
  if (!al) return [...keys];
  const f = keys.filter((k) => modesOf(ORIGINS[k]).some((x) => al.includes(x)));
  return f.length ? f : [...keys];
}

/** 리무진 공항 항목(modes: bus)은 같은 공항의 항공 관문(key + F)으로 바꿔 읽는다 */
export function airTwin(k: string): string {
  const o = ORIGINS[k];
  if (!o || !/공항/.test(o.ko) || modesOf(o).includes("air")) return k;
  const t = `${k}F`;
  return ORIGINS[t] && modesOf(ORIGINS[t]).includes("air") ? t : k;
}

/** 관문 종류 → 광역 교통 칸(공항 = 항공, 항만 = 배, 역 = 기차, 터미널 = 버스). 섞인 관문은 null */
export function gwWideOf(k0: string): WideChoice | null {
  const k = airTwin(k0);
  const o = ORIGINS[k];
  if (!o) return null;
  const C: Record<string, WideChoice> = {
    air: "air",
    ship: "ship",
    ktx: "rail",
    srt: "rail",
    bus: "bus",
    metro: "metro",
  };
  const c = [
    ...new Set(
      modesOf(o)
        .map((m) => C[m])
        .filter(Boolean),
    ),
  ];
  if (c.length !== 1) return null;
  if (c[0] === "air" && !/공항/.test(o.ko)) return null;
  if (c[0] === "ship" && !/(항|여객)/.test(o.ko)) return null;
  return c[0];
}

/** 출발지 정렬 순위: 기차역 → 버스터미널 → 공항 → 항만(PoC originOptions rk) */
function originRank(k: string): number {
  const m = modesOf(ORIGINS[k]);
  if (m.includes("ktx") || m.includes("srt")) return 0;
  if (m.includes("bus")) return 1;
  if (m.includes("air")) return 2;
  return 3;
}

/**
 * 출발지 · 귀가지 목록(PoC originOptions).
 *  - 항구 섬(울릉 · 백령도 · 연평도) 여행이면 그 섬 항로 항구만(항해 시간이 짧은 순, 수단 거르기 없음),
 *    아니면 항구 섬 항로 항구를 모두 뺀다. island: 항구 섬(true는 울릉, 예전 boolean 인자), 제주 · null · false는 육지
 *  - 도착 관문이 받는 수단의 출발지만(관문이 없으면 기차 · 버스 · 항공 · 배 전부)
 *  - 기차역 → 버스터미널 → 공항 → 항만 순
 *  - 고른 광역 교통에 맞는 관문만(wideOriginFilter, 자가용은 거르지 않는다)
 *  - 광역 교통이 버스가 아니면 리무진 공항 항목을 뺀다(항공 관문으로 읽히므로)
 */
export function originOptions(
  hub: PlannerHub | undefined,
  choice: WideChoice | null,
  island: Island | boolean | null = false,
): string[] {
  const pi = portIslandArg(island);
  if (pi) return islandPorts(pi);
  const hm: readonly string[] = hub?.modes ?? [
    "ktx",
    "srt",
    "bus",
    "air",
    "ship",
  ];
  const all = Object.keys(ORIGINS)
    .filter((k) => {
      if (isPortRoute(ORIGINS[k].route)) return false;
      return modesOf(ORIGINS[k]).some((x) => hm.includes(x));
    })
    .sort((a, b) => originRank(a) - originRank(b));
  const n = new Set(wideOriginFilter(all, choice));
  return all.filter((k) => n.has(k) && (choice === "bus" || airTwin(k) === k));
}

/**
 * 광역 교통 칸을 골랐을 때 바꿀 출발지 · 귀가지(PoC wideOpts pick의 fix).
 * 지금 출발지가 그 수단의 관문이 아니면 ORIGINS 순서의 첫 관문으로, 귀가지가 맞지 않으면 「출발지와 같음」(null)으로
 */
export function fixOriginsForWide(
  choice: WideChoice,
  origin: string,
  originEnd: string | null,
): { origin?: string; originEnd?: null } {
  const al = WIDE_ALLOW[choice];
  const ok = (key: string | null) =>
    !al ||
    !key ||
    (ORIGINS[key] !== undefined &&
      modesOf(ORIGINS[key]).some((x) => al.includes(x)));
  const cand = al
    ? Object.keys(ORIGINS).filter(
        (x) => !isPortRoute(ORIGINS[x].route) && ok(x),
      )
    : [];
  const fix: { origin?: string; originEnd?: null } = {};
  if (!ok(origin) && cand.length) fix.origin = cand[0];
  if (originEnd && !ok(originEnd)) fix.originEnd = null;
  return fix;
}

// ── 체인 ──────────────────────────────────────────────────────────

/** 광역 교통 선호 수단을 앞으로 당긴 탐색 순서(PoC wideOrder). 불가하면 나머지 수단으로 대체 */
export function wideOrder(pref: WideChoice | null | undefined): ChainMode[] {
  const base: ChainMode[] = ["metro", "ktx", "srt", "bus", "air", "ship"];
  const pr: ChainMode[] =
    pref === "bus"
      ? ["bus"]
      : pref === "rail"
        ? ["ktx", "srt"]
        : pref === "air"
          ? ["air"]
          : pref === "ship"
            ? ["ship"]
            : pref === "metro"
              ? ["metro"]
              : [];
  return pr.concat(base.filter((m) => !pr.includes(m)));
}

export type ChainOptions = {
  /** 광역 교통이 자가용 */
  own: boolean;
  /** 고른 광역 교통 칸(PoC window.__tpWide). 없으면 null */
  pref: WideChoice | null;
  /** 이 도착 도시에서 고른 경로 수단(PoC routePick[reg]) */
  picked?: string;
  /** 수단별로 고른 환승 관문 key(PoC gwPick) */
  gwPick?: Readonly<Record<string, string>>;
  /** 제주 자가용 = 항만까지 운전 + 카페리(PoC wideChain carFerry). own과 함께 true */
  carFerry?: boolean;
  /** 도착 도시가 울릉(배 본 구간 = 승선 수속 40 + 항구별 항해 시간). portIsland: "ulleung"과 같다(예전 이름) */
  ulleung?: boolean;
  /** 도착 도시의 항구 섬(울릉 · 백령도 · 연평도. 배 본 구간 = 그 섬 승선 수속 + 항구별 항해 시간) */
  portIsland?: Island | null;
};

/** 도착 관문 점(PoC wideChain hubPt): 항공 · 배 · 버스면 그 좌표, 없으면 관문 좌표 */
function hubPoint(h: PlannerHub, mode: ChainMode): ChainPoint {
  const en = h.en || h.ko;
  if (mode === "air" && h.airLat && h.airLng)
    return {
      lat: h.airLat,
      lng: h.airLng,
      ko: h.airKo || h.ko,
      en: h.airEn || en,
    };
  if (mode === "ship" && h.shipLat && h.shipLng)
    return {
      lat: h.shipLat,
      lng: h.shipLng,
      ko: h.shipKo || h.ko,
      en: h.shipEn || en,
    };
  if (mode === "bus" && h.busLat && h.busLng)
    return {
      lat: h.busLat,
      lng: h.busLng,
      ko: h.busKo || h.ko,
      en: h.busEn || en,
    };
  return {
    lat: h.lat,
    lng: h.lng,
    ko: mode === "bus" ? h.busKo || h.ko : h.ko,
    en: mode === "bus" ? h.busEn || en : en,
  };
}

/** 출발지 key의 값인지(지도 검색 지점 · 고른 전철역이 아니라 출발지 목록 그대로) */
const isOwnKey = (o: ChainPoint, oKey: string) => ORIGINS[oKey] === o;

/**
 * 광역 체인(PoC wideChain). o: 출발점(originFor), oKey: 출발지 key, h: 도착 관문, force: 이 수단으로 확정.
 *  - 자가용: 출발점 → 관문 한 구간(accessMin own)
 *  - 제주 자가용 카페리(carFerry): 배로 확정. 출발점이 항만이 아니면 항만까지 운전(car, ownDriveMin) + 카페리(carferry, 배 본 구간 + 선적 · 하선 30분)
 *  - 항구 섬 배 본 구간: 승선 수속(울릉 40 · 백령도 · 연평도 30) + 항구별 항해 시간(sailMin, 없으면 섬별 기본값). 거리 식을 쓰지 않는다
 *  - 수단: force → 고른 경로(picked) → 고른 칸(pref)의 첫 수단 → 출발점과 관문이 함께 가진 첫 수단 → 관문의 첫 수단.
 *    출발점이 관문(출발지 key)이고 그 수단이 도착 관문에 닿으면 그 수단으로 확정한다
 *  - 출발 관문: 출발점에 그 수단이 없으면 고른 환승 관문 → 대체 관문(ORIGIN_ALT) → 서울권 기본 관문(70km 안)
 *    → 그 수단이 서는 가장 가까운 출발지(항구 섬 항로 제외)
 */
export function wideChain(
  o: ChainPoint | undefined,
  oKey: string,
  h: PlannerHub | undefined,
  opts: ChainOptions,
  force0?: string,
): WideChain | null {
  if (!o || !h) return null;
  const carFerry = opts.own && !!opts.carFerry;
  if (opts.own && !carFerry) {
    const pt: ChainPoint = {
      ko: h.ko,
      en: h.en || h.ko,
      lat: h.lat,
      lng: h.lng,
    };
    return {
      mode: "own",
      gw: o,
      hubPt: pt,
      legs: [{ from: o, to: pt, mode: "own", min: accessMin(o, h, "own") }],
    };
  }
  let force = carFerry ? "ship" : force0;
  const hm = modesOf(h);
  const om = modesOf(o);
  const own = isOwnKey(o, oKey);
  const order = wideOrder(opts.pref).filter((m) => hm.includes(m));
  const direct = order.filter((m) => om.includes(m));
  const picked = opts.picked;
  const gwM = own ? om.filter((m) => hm.includes(m)) : [];
  if (!force && gwM.length) {
    const pr = wideOrder(opts.pref).filter((m) => gwM.includes(m));
    force = pr[0] || gwM[0];
  }
  const mode = (
    force && hm.includes(force)
      ? force
      : picked && hm.includes(picked)
        ? picked
        : opts.pref && order.length
          ? order[0]
          : direct[0] || order[0] || hm[0] || "bus"
  ) as ChainMode;

  let gw = o;
  if (!om.includes(mode)) {
    let k: string | null = null;
    const ov = opts.gwPick?.[mode];
    if (ov && ORIGINS[ov] && modesOf(ORIGINS[ov]).includes(mode)) k = ov;
    if (!k && own) {
      const a = ORIGIN_ALT[oKey]?.[mode];
      if (a && ORIGINS[a]) k = a;
    }
    if (!k) {
      const p = PRIMARY_GW[mode];
      if (p && ORIGINS[p] && straightKm(o, ORIGINS[p]) < PRIMARY_GW_KM) k = p;
    }
    if (!k) {
      let bd = 1e9;
      for (const x of Object.keys(ORIGINS)) {
        const g = ORIGINS[x];
        if (isPortRoute(g.route) || !modesOf(g).includes(mode)) continue;
        const d = straightKm(o, g);
        if (d < bd) {
          bd = d;
          k = x;
        }
      }
    }
    if (k) gw = ORIGINS[k];
  }
  const hubPt = hubPoint(h, mode);
  const legs: ChainLeg[] = [];
  if (gw !== o) {
    const d = straightKm(o, gw) * DETOUR;
    legs.push({
      from: o,
      to: gw,
      mode: carFerry ? "car" : "metro",
      min: carFerry
        ? ownDriveMin(o, gw)
        : Math.round(ACCESS_BASE + d * ACCESS_PER_KM),
    });
  }
  const d2 = straightKm(gw, hubPt) * DETOUR;
  const f = mode in MAIN ? MAIN[mode as keyof typeof MAIN] : MAIN_BUS;
  const portIsland = portIslandArg(opts.portIsland ?? opts.ulleung);
  const main =
    mode === "ship" && portIsland
      ? islandSailMin(portIsland, gw)
      : Math.round(f(d2));
  legs.push({
    from: gw,
    to: hubPt,
    mode: carFerry ? "carferry" : mode,
    min: carFerry ? main + CAR_FERRY_LOAD : main,
    main: true,
  });
  return carFerry
    ? { mode, gw, hubPt, legs, carFerry: true }
    : { mode, gw, hubPt, legs };
}

/**
 * 한 도착 관문에 닿는 광역 경로 후보(PoC routeCands). 자가용 · 관문 없음은 없다.
 * 출발점이 관문이고 그 수단이 닿으면 경로가 하나(지금 체인)뿐이다.
 * 아니면 관문 수단마다(SRT는 KTX와 같은 경로로 본다) 그 수단으로 확정한 체인
 */
export function routeCands(
  o: ChainPoint | undefined,
  oKey: string,
  h: PlannerHub | undefined,
  opts: ChainOptions,
): WideChain[] {
  if (!o || !h || opts.own) return [];
  const hm = modesOf(h);
  const gwM = isOwnKey(o, oKey) ? modesOf(o).filter((m) => hm.includes(m)) : [];
  if (gwM.length) {
    const c = wideChain(o, oKey, h, opts);
    return c ? [c] : [];
  }
  const seen = new Set<string>();
  const out: WideChain[] = [];
  for (const m0 of hm) {
    const m = m0 === "srt" ? "ktx" : m0;
    if (seen.has(m)) continue;
    seen.add(m);
    const c = wideChain(o, oKey, h, opts, m);
    if (c) out.push(c);
  }
  return out;
}

/** 체인을 거꾸로(귀가) 읽은 구간 */
function outLegs(c: WideChain): ChainLeg[] {
  return c.legs
    .slice()
    .reverse()
    .map((l) => ({ ...l, from: l.to, to: l.from }));
}

/**
 * 체인 시각표(PoC chainSchedule, 시간표 API가 없을 때). 들어갈 때는 출발 시각부터, 나올 때는 도착 관문 출발 시각부터 누적한다.
 *  - 광역 본 구간은 앞 구간 도착 + 환승 15분 뒤 10분 단위로 올림한 시각에 출발한다(공항 · 항만은 수속이 본 구간에 들어 있다)
 *  - 본 구간 뒤 접근 구간은 10분 뒤에 출발한다
 */
export function chainSchedule(
  c: WideChain | null,
  start: number,
  out = false,
): { steps: ChainStep[]; end: number } {
  if (!c) return { steps: [], end: start };
  const legs = out ? outLegs(c) : c.legs;
  let t = start;
  const steps: ChainStep[] = [{ t, place: legs[0].from, first: true }];
  legs.forEach((l, i) => {
    const prev = steps[steps.length - 1];
    if (l.main && i > 0 && l.mode !== "air" && l.mode !== "ship") {
      const d = Math.ceil((t + XFER_MAIN) / XFER_ROUND) * XFER_ROUND;
      prev.wait = d - t;
      t = d;
      prev.depAt = t;
    } else if (!l.main && i > 0) {
      t += XFER_ACCESS;
      prev.wait = XFER_ACCESS;
      prev.depAt = t;
    }
    t += l.min;
    steps.push({ t, place: l.to, leg: l });
  });
  return { steps, end: t };
}

/** 체인의 점 이름 순서. 들어갈 때 출발점 → … → 도착 관문, 나올 때 도착 관문 → … → 귀가점 */
export function chainPoints(c: WideChain, o: ChainPoint, out = false) {
  return out
    ? [c.hubPt, ...outLegs(c).map((l) => l.to)]
    : [o, ...c.legs.map((l) => l.to)];
}

/**
 * 환승 관문 고르기(PoC dayPlan gw). 자가용 · 카페리 · 출발점이 곧 관문이면 없다.
 * 출발점에서 90km 안, 그 수단이 서는 출발지(항구 섬 항로 제외) 가까운 순 8곳. 지금 관문이 없으면 맨 앞에 넣는다.
 * 2곳 이상일 때만 고르게 한다(1곳 이하면 빈 배열)
 */
export function gatewayOptions(c: WideChain | null, o: ChainPoint): string[] {
  if (!c || c.mode === "own" || c.carFerry || c.gw === o) return [];
  const mode = c.mode;
  const keys = Object.keys(ORIGINS)
    .filter((k) => {
      const g = ORIGINS[k];
      return (
        !isPortRoute(g.route) &&
        modesOf(g).includes(mode) &&
        straightKm(o, g) < GW_PICK_KM
      );
    })
    .sort((a, b) => straightKm(o, ORIGINS[a]) - straightKm(o, ORIGINS[b]))
    .slice(0, GW_PICK_MAX);
  const cur = Object.keys(ORIGINS).find((k) => ORIGINS[k] === c.gw);
  if (cur && !keys.includes(cur)) keys.unshift(cur);
  return keys.length > 1 ? keys : [];
}

/** 체인 관문 key(출발지 목록의 값이면). 고른 전철역 등이면 null */
export function originKeyOf(p: ChainPoint): string | null {
  return Object.keys(ORIGINS).find((k) => ORIGINS[k] === p) ?? null;
}
