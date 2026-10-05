import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_DEP, DEFAULT_RET } from "../course/params";
import { readLocal, useLocalValue, writeLocal } from "../../lib/local-store";
import {
  insertAfter,
  parseStayOverrides,
  setStayOverride,
  type StayOverrides,
} from "./course-edit";
import { PLANNER_ORIGINS } from "./regions";

// 투어 플래너에서 코스에 담은 장소와 코스 설정. localStorage `tn.planner.course`에 JSON으로 둔다.
//   { city: "경주", placeIds: ["gj2", …],   (담은 순서 = 코스 탭 순서)
//     name, startDate, endDate, origin, originEnd, depTime, retTime, wideMode, localMode,   (코스 설정. 없는 필드는 기본값)
//     routePick: { 경주: "bus" }, gwPick: { ktx: "yongsan" },   (도착 도시별로 고른 광역 경로 · 수단별로 고른 환승 관문. PoC routePick · gwPick)
//     metroLine, metroOrigin, metroEndLine, metroEnd,   (지하철 출발 · 귀가 호선과 역 이름. PoC metroLine · metroOrigin · metroEndLine · metroEnd)
//     jejuResident,   (제주 자가용일 때 「제주도민인가요?」 답. true 도민 · false 카페리 · null 아직. PoC jejuResident)
//     ferryPort: { jeju: "mokpo" },   (배편 시간표 카드에서 고른 출발 항구. PoC ferryPort. 저장된 플랜에는 넣지 않는다)
//     ulNotice,   (항구 섬(울릉 · 백령도 · 연평도) 항로 안내 창이 열려 있는지. PoC ulNotice. 저장된 플랜에는 넣지 않는다)
//     routeSkip: { 경주: true },   (경로 선택 창을 닫은 도착 도시. 다시 스스로 열지 않는다. 저장된 플랜에는 넣지 않는다)
//     stayOv: { gj2: 90, … },   (장소별로 바꾼 체류 분. 추천값과 같으면 두지 않는다. course-edit.ts)
//     planId }   (지금 불러와 보고 있거나 방금 저장한 플랜 id. 「덮어쓰기」 대상. PoC planId)
// 한 코스에 여러 도시의 장소를 담을 수 있다(2026-10-02, 그 전에는 한 도시만). city는 처음 담은 장소의 도시(대표 도시: 추천 코스 후보 · 제목의 기준).
// 도시가 다른 장소 사이는 일정 계산(course/schedule.ts legInfo)이 광역 구간(기차 · 버스 · 광역전철 계수 + 환승 여유)으로 재고,
// 가는 광역 체인은 첫 장소 도시, 돌아오는 체인은 마지막 장소 도시로 잡는다(planner/schedule.ts planTrip).
// 여러 컴포넌트(지도 목록 · 장소 시트 · 코스 탭 · 하단 탭 배지)가 같은 값을 보게
// local-store의 useSyncExternalStore 구독(useLocalValue)으로 읽는다.
// 코스 설정(날짜 · 출발지 · 시각 · 이동수단)은 같은 값에 함께 둔다. 코스를 비워도 설정은 남는다.

const PLANNER_COURSE_KEY = "tn.planner.course";

/** 광역 교통. 기차는 출발지에 따라 ktx · srt */
const WIDE_MODES = [
  "bus",
  "ktx",
  "srt",
  "air",
  "ship",
  "metro",
  "own",
] as const;
export type WideMode = (typeof WIDE_MODES)[number];

/** 현지 이동. driving 렌트카 · transit 대중교통 · own 자가용(광역이 자가용일 때만) */
const LOCAL_MODES = ["driving", "transit", "own"] as const;
export type LocalMode = (typeof LOCAL_MODES)[number];

export type PlannerSettings = {
  /** 플랜 이름. 비어 있으면 "" */
  name: string;
  /** 출발일 YYYY-MM-DD. 없으면 null(오늘) */
  startDate: string | null;
  /** 귀가일 YYYY-MM-DD. 없으면 null(출발일과 같은 날, 당일) */
  endDate: string | null;
  /** 출발지. PLANNER_ORIGINS 키 */
  origin: string;
  /** 귀가지. PLANNER_ORIGINS 키. null이면 출발지와 같음(PoC originEnd) */
  originEnd: string | null;
  /** 출발지 출발 시각 HH:MM */
  depTime: string;
  /** 마지막 날 여행지 출발(귀가) 시각 HH:MM */
  retTime: string;
  /** 고른 광역 교통. null이면 고르지 않음(쓸 수 있는 수단을 자동으로 고른다) */
  wideMode: WideMode | null;
  /** 고른 현지 이동 */
  localMode: LocalMode;
  /** 도착 도시(한국어 이름)별로 고른 광역 경로 수단(PoC routePick). 경로 선택 창에서 고른다 */
  routePick: Record<string, string>;
  /** 수단별로 고른 환승 관문(PLANNER_ORIGINS 키, PoC gwPick) */
  gwPick: Record<string, string>;
  /** 지하철 출발 호선 · 역 이름(ko). 비어 있으면 "" (PoC metroLine · metroOrigin) */
  metroLine: string;
  metroOrigin: string;
  /** 지하철 귀가 호선 · 역 이름(ko). 역이 비어 있으면 출발역과 같음 (PoC metroEndLine · metroEnd) */
  metroEndLine: string;
  metroEnd: string;
  /**
   * 제주 자가용일 때 「제주도민인가요?」 답(PoC jejuResident). true 도민(섬 안에서 자가용만, 광역 체인 없음),
   * false 카페리, null 아직 답하지 않음(카페리로 계산한다)
   */
  jejuResident: boolean | null;
};

export type PlannerCourse = PlannerSettings & {
  /** 담은 장소의 도시(한국어 이름). 비어 있으면 null */
  city: string | null;
  placeIds: string[];
  /**
   * 장소별로 바꾼 체류 분(PoC stayOv). 일정 계산은 장소의 min 대신 이 값을 쓴다.
   * 코스를 비워도 남고, 저장된 플랜의 settings에도 함께 둔다
   */
  stayOv: StayOverrides;
  /** 지금 불러와 보고 있거나 방금 저장한 저장된 플랜 id(tn.savedPlans). 없으면 null */
  planId: string | null;
  /** 경로 선택 창을 닫은 도착 도시(PoC routeSkip). 저장된 플랜에는 넣지 않는다 */
  routeSkip: Record<string, true>;
  /** 섬(jeju · ulleung · baengnyeong · yeonpyeong)별로 배편 시간표 카드에서 고른 출발 항구(PoC ferryPort). 저장된 플랜에는 넣지 않는다 */
  ferryPort: Record<string, string>;
  /** 항구 섬(울릉 · 백령도 · 연평도) 항로 안내 창이 열려 있는지(PoC ulNotice). 어느 섬인지는 일정(portIsland)으로 정한다. 저장된 플랜에는 넣지 않는다 */
  ulNotice: boolean;
};

const DEFAULT_ORIGIN = "seoul";

export const DEFAULT_SETTINGS: PlannerSettings = {
  name: "",
  startDate: null,
  endDate: null,
  origin: DEFAULT_ORIGIN,
  originEnd: null,
  depTime: DEFAULT_DEP,
  retTime: DEFAULT_RET,
  wideMode: null,
  localMode: "transit",
  routePick: {},
  gwPick: {},
  metroLine: "",
  metroOrigin: "",
  metroEndLine: "",
  metroEnd: "",
  jejuResident: null,
};

const EMPTY: PlannerCourse = {
  city: null,
  placeIds: [],
  ...DEFAULT_SETTINGS,
  stayOv: {},
  planId: null,
  routeSkip: {},
  ferryPort: {},
  ulNotice: false,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function halfHours(from: number, to: number): string[] {
  const out: string[] = [];
  for (let h = from; h <= to; h++)
    for (const m of ["00", "30"])
      out.push(`${String(h).padStart(2, "0")}:${m}`);
  return out;
}

/** 출발 시각 보기: 05:00~20:30, 30분 간격 (PoC depTimeOptions). 코스 탭이 보이고, 저장값도 이 목록으로 검사한다 */
export const DEP_TIMES: readonly string[] = halfHours(5, 20);
/** 여행지 출발 시각 보기: 10:00~23:30, 30분 간격 (PoC retTimeOptions). 코스 탭이 보이고, 저장값도 이 목록으로 검사한다 */
export const RET_TIMES: readonly string[] = halfHours(10, 23);

/** YYYY-MM-DD가 실제 있는 날짜인지 */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** 화면에서 고를 수 있는 시각인지(목록 밖 · 「99:99」는 기본값으로) */
const isTimeIn =
  (list: readonly string[]) =>
  (value: unknown): value is string =>
    typeof value === "string" && list.includes(value);
const isDepTime = isTimeIn(DEP_TIMES);
const isRetTime = isTimeIn(RET_TIMES);

/** 출발지 키인지. in 대신 Object.hasOwn — 「constructor」 같은 Object 원형의 키를 받지 않는다 */
const isOriginKey = (value: unknown): value is string =>
  typeof value === "string" && Object.hasOwn(PLANNER_ORIGINS, value);

/** 문자열 값만 남긴 객체. check로 값을 거른다 */
function stringMap(
  v: unknown,
  check: (value: string) => boolean = () => true,
): Record<string, string> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v))
    if (typeof x === "string" && check(x)) out[k] = x;
  return out;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

/** 경로 선택 창을 닫은 도착 도시(true 값만) */
function parseRouteSkip(v: unknown): Record<string, true> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out: Record<string, true> = {};
  for (const [k, x] of Object.entries(v)) if (x === true) out[k] = true;
  return out;
}

/** 저장된 설정 필드를 검사해 채운다. 모르는 값 · 없는 필드는 기본값 */
export function parseSettings(v: Record<string, unknown>): PlannerSettings {
  const d = DEFAULT_SETTINGS;
  return {
    name: typeof v.name === "string" ? v.name : d.name,
    startDate: isIsoDate(v.startDate) ? v.startDate : d.startDate,
    endDate: isIsoDate(v.endDate) ? v.endDate : d.endDate,
    origin: isOriginKey(v.origin) ? v.origin : d.origin,
    originEnd: isOriginKey(v.originEnd) ? v.originEnd : d.originEnd,
    depTime: isDepTime(v.depTime) ? v.depTime : d.depTime,
    retTime: isRetTime(v.retTime) ? v.retTime : d.retTime,
    wideMode: (WIDE_MODES as readonly unknown[]).includes(v.wideMode)
      ? (v.wideMode as WideMode)
      : d.wideMode,
    localMode: (LOCAL_MODES as readonly unknown[]).includes(v.localMode)
      ? (v.localMode as LocalMode)
      : d.localMode,
    routePick: stringMap(v.routePick),
    gwPick: stringMap(v.gwPick, isOriginKey),
    metroLine: text(v.metroLine),
    metroOrigin: text(v.metroOrigin),
    metroEndLine: text(v.metroEndLine),
    metroEnd: text(v.metroEnd),
    jejuResident:
      typeof v.jejuResident === "boolean" ? v.jejuResident : d.jejuResident,
  };
}

/** 설정 필드만 정해진 순서로 뽑는다(저장 · 비교용) */
export function pickSettings(v: PlannerSettings): PlannerSettings {
  return {
    name: v.name,
    startDate: v.startDate,
    endDate: v.endDate,
    origin: v.origin,
    originEnd: v.originEnd,
    depTime: v.depTime,
    retTime: v.retTime,
    wideMode: v.wideMode,
    localMode: v.localMode,
    routePick: v.routePick,
    gwPick: v.gwPick,
    metroLine: v.metroLine,
    metroOrigin: v.metroOrigin,
    metroEndLine: v.metroEndLine,
    metroEnd: v.metroEnd,
    jejuResident: v.jejuResident,
  };
}

/**
 * 저장된 플랜에 넣는 설정(PoC planSave): 고른 그대로 둔다. 날짜를 고르지 않았으면 startDate · endDate가 null이라
 * 불러오는 날의 오늘 · 당일로 계산된다(저장한 날로 고정되지 않는다). 이름은 앞뒤 공백을 뗀다
 */
export function planSaveSettings(s: PlannerSettings): PlannerSettings {
  return pickSettings({ ...s, name: s.name.trim() });
}

/**
 * 「저장됨」 비교 키. 담은 장소 · 저장할 설정(planSaveSettings) · 체류 시간(키 순서와 무관)이 같으면 같은 키.
 * 코스와 저장된 플랜을 같은 값(날짜를 고르지 않았으면 null)으로 비교한다
 */
export function planContentKey(
  placeIds: readonly string[],
  settings: PlannerSettings,
  stayOv: StayOverrides,
): string {
  const stay = Object.entries(stayOv).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return JSON.stringify([placeIds, pickSettings(settings), stay]);
}

export function parseCourse(raw: string | null): PlannerCourse {
  if (!raw) return EMPTY;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return EMPTY;
    const rec = v as Record<string, unknown>;
    const { city, placeIds } = rec;
    const ids = Array.isArray(placeIds)
      ? placeIds.filter((id): id is string => typeof id === "string")
      : [];
    return {
      ...parseSettings(rec),
      city: typeof city === "string" && ids.length > 0 ? city : null,
      placeIds: [...new Set(ids)],
      stayOv: parseStayOverrides(rec.stayOv),
      planId: typeof rec.planId === "string" ? rec.planId : null,
      routeSkip: parseRouteSkip(rec.routeSkip),
      ferryPort: stringMap(rec.ferryPort),
      ulNotice: rec.ulNotice === true,
    };
  } catch {
    return EMPTY;
  }
}

/**
 * 데이터에 없는 id(데이터에서 빠진 장소)를 거르고, 합쳐서 뺀 옛 id는 남긴 장소 id로 바꾼(canonical, 같은 장소가 두 번이면 하나) 코스.
 * 화면 목록(담은 장소)과 순번 · 개수를 맞춘다. 다 없어졌으면 도시도 비운다
 */
export function withKnownPlaces(
  course: PlannerCourse,
  isKnown: (id: string) => boolean,
  canonical: (id: string) => string = (id) => id,
): PlannerCourse {
  const placeIds = [...new Set(course.placeIds.filter(isKnown).map(canonical))];
  if (
    placeIds.length === course.placeIds.length &&
    placeIds.every((id, i) => id === course.placeIds[i])
  )
    return course;
  return {
    ...course,
    placeIds,
    city: placeIds.length > 0 ? course.city : null,
  };
}

/** from 자리의 id를 to 자리로 옮긴 새 목록. 범위 밖이면 그대로 */
export function moveAt(
  ids: readonly string[],
  from: number,
  to: number,
): string[] {
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length)
    return [...ids];
  const next = [...ids];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** 저장된 값에 필드를 덮어쓴다. 모르는 필드도 지우지 않는다 */
function patch(fields: Partial<PlannerCourse>): void {
  let rest: Record<string, unknown> = {};
  try {
    const prev: unknown = JSON.parse(readLocal(PLANNER_COURSE_KEY) ?? "{}");
    if (typeof prev === "object" && prev !== null)
      rest = prev as Record<string, unknown>;
  } catch {
    rest = {};
  }
  writeLocal(PLANNER_COURSE_KEY, JSON.stringify({ ...rest, ...fields }));
}

function write(course: Pick<PlannerCourse, "city" | "placeIds">): void {
  patch({
    city: course.placeIds.length > 0 ? course.city : null,
    placeIds: course.placeIds,
  });
}

const noop = () => () => {};

/** 하이드레이션이 끝났는지. 서버 렌더와 하이드레이션 중에는 false */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** 오늘 날짜(YYYY-MM-DD, 기기 시간대). 서버 렌더와 하이드레이션 중에는 빈 문자열 */
export function useToday(): string {
  return useSyncExternalStore(
    noop,
    () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    },
    () => "",
  );
}

/**
 * 코스에 담은 장소와 담기 · 빼기 · 순서 바꾸기. 서버 렌더와 하이드레이션 중에는 빈 코스.
 * isKnown(장소 데이터에 있는 id인지)을 주면 데이터에 없는 id를 걸러 화면 목록과 같은 순번 · 개수로 쓰고,
 * 저장값에서도 지운다(배지 · 알림 개수가 화면 목록과 같아진다). 장소 데이터(places.json)를 싣는 화면(플래너 지도 · 코스 탭)만 준다
 */
export function usePlannerCourse(
  isKnown?: (id: string) => boolean,
  canonical?: (id: string) => string,
) {
  const stored = parseCourse(useLocalValue(PLANNER_COURSE_KEY));
  const course = isKnown ? withKnownPlaces(stored, isKnown, canonical) : stored;
  const { placeIds } = course;
  const stale = course !== stored;
  useEffect(() => {
    if (stale) write(course);
  });

  return {
    course,
    has: (id: string) => placeIds.includes(id),
    /** 담는다. 비어 있던 코스면 이 장소의 도시가 대표 도시가 되고, 다른 도시 장소도 그대로 뒤에 담긴다 */
    add: (id: string, city: string) =>
      write({
        city: course.city ?? city,
        placeIds: placeIds.includes(id) ? placeIds : [...placeIds, id],
      }),
    remove: (id: string) =>
      write({ ...course, placeIds: placeIds.filter((x) => x !== id) }),
    /** 담은 장소를 통째로 바꾼다(추천 코스 불러오기) */
    replace: (city: string | null, ids: string[]) =>
      write({ city, placeIds: [...new Set(ids)] }),
    /** 담은 장소를 비운다. 설정은 남긴다 */
    clear: () => write({ city: null, placeIds: [] }),
    /** 코스 설정을 바꾼다 */
    setSettings: (fields: Partial<PlannerSettings>) => patch(fields),
    /**
     * 「이 날에 넣기」. 담은 순서의 afterIdx 자리 뒤에 끼워 넣는다(course-edit.ts insertAfter).
     * 대표 도시는 그대로 둔다(다른 도시 장소도 넣을 수 있다). 비어 있던 코스면 city가 대표 도시가 된다
     */
    insertAt: (id: string, afterIdx: number | null, city: string) =>
      write({
        city: course.city ?? city,
        placeIds: insertAfter(placeIds, id, afterIdx),
      }),
    /** 장소의 체류 분을 바꾼다. v가 null이거나 추천값(rec)과 같으면 추천값으로 되돌린다 */
    setStay: (id: string, rec: number, v: number | null) =>
      patch({ stayOv: setStayOverride(course.stayOv, id, rec, v) }),
    /** 이 도착 도시의 경로 선택 창을 닫았다(다시 스스로 열지 않는다) */
    skipRoute: (city: string) =>
      patch({ routeSkip: { ...course.routeSkip, [city]: true } }),
    /** 배편 시간표 카드의 출발 항구를 고른다(섬별) */
    setFerryPort: (island: string, port: string) =>
      patch({ ferryPort: { ...course.ferryPort, [island]: port } }),
    /** 항구 섬 항로 안내 창을 열고 닫는다 */
    setUlNotice: (open: boolean) => patch({ ulNotice: open }),
    /** 덮어쓰기 대상 플랜을 정한다(저장한 뒤 · 지운 뒤) */
    setPlanId: (planId: string | null) => patch({ planId }),
    /** 저장된 플랜을 통째로 불러온다(장소 · 설정 · 체류 시간 · 플랜 id) */
    load: (
      next: Pick<PlannerCourse, "city" | "placeIds" | "stayOv" | "planId"> &
        PlannerSettings,
    ) =>
      patch({
        ...next,
        city: next.placeIds.length > 0 ? next.city : null,
      }),
    /** from 자리의 장소를 to 자리로 옮긴다(자리는 isKnown으로 거른 화면 목록의 순번) */
    move: (from: number, to: number) => {
      if (to < 0 || to >= placeIds.length) return;
      write({ ...course, placeIds: moveAt(placeIds, from, to) });
    },
  };
}
