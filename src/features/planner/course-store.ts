import { useSyncExternalStore } from "react";
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
//     routeSkip: { 경주: true },   (경로 선택 창을 닫은 도착 도시. 다시 스스로 열지 않는다. 저장된 플랜에는 넣지 않는다)
//     stayOv: { gj2: 90, … },   (장소별로 바꾼 체류 분. 추천값과 같으면 두지 않는다. course-edit.ts)
//     planId }   (지금 불러와 보고 있거나 방금 저장한 플랜 id. 「덮어쓰기」 대상. PoC planId)
// 한 코스는 한 도시의 장소만 담는다. 다른 도시 장소가 섞이면 일정 계산(course/schedule.ts)이 틀어진다.
// 그래서 다른 도시 장소를 담으려 하면 쓰는 쪽이 먼저 비울지 묻는다(needsCityChange).
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
};

const EMPTY: PlannerCourse = {
  city: null,
  placeIds: [],
  ...DEFAULT_SETTINGS,
  stayOv: {},
  planId: null,
  routeSkip: {},
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** YYYY-MM-DD가 실제 있는 날짜인지 */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const isTime = (value: unknown): value is string =>
  typeof value === "string" && TIME_RE.test(value);

const isOriginKey = (value: unknown): value is string =>
  typeof value === "string" && value in PLANNER_ORIGINS;

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
    depTime: isTime(v.depTime) ? v.depTime : d.depTime,
    retTime: isTime(v.retTime) ? v.retTime : d.retTime,
    wideMode: (WIDE_MODES as readonly unknown[]).includes(v.wideMode)
      ? (v.wideMode as WideMode)
      : d.wideMode,
    localMode: (LOCAL_MODES as readonly unknown[]).includes(v.localMode)
      ? (v.localMode as LocalMode)
      : d.localMode,
    routePick: stringMap(v.routePick),
    gwPick: stringMap(v.gwPick, (k) => k in PLANNER_ORIGINS),
    metroLine: text(v.metroLine),
    metroOrigin: text(v.metroOrigin),
    metroEndLine: text(v.metroEndLine),
    metroEnd: text(v.metroEnd),
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
  };
}

function parseCourse(raw: string | null): PlannerCourse {
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
    };
  } catch {
    return EMPTY;
  }
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

/** 이 도시의 장소를 담으려면 담아 둔 다른 도시 장소를 먼저 비워야 하는지 */
export function needsCityChange(course: PlannerCourse, city: string): boolean {
  return course.placeIds.length > 0 && course.city !== city;
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

/** 코스에 담은 장소와 담기 · 빼기 · 순서 바꾸기. 서버 렌더와 하이드레이션 중에는 빈 코스 */
export function usePlannerCourse() {
  const course = parseCourse(useLocalValue(PLANNER_COURSE_KEY));
  const { placeIds } = course;

  return {
    course,
    has: (id: string) => placeIds.includes(id),
    /** 담는다. 다른 도시 장소가 담겨 있으면 그것을 비우고 담는다(묻기는 쓰는 쪽에서) */
    add: (id: string, city: string) =>
      write(
        needsCityChange(course, city)
          ? { city, placeIds: [id] }
          : {
              city,
              placeIds: placeIds.includes(id) ? placeIds : [...placeIds, id],
            },
      ),
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
     * 도시는 그대로 둔다(그 날 도시의 장소만 넣는다). 비어 있던 코스면 city가 코스 도시가 된다
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
    /** from 자리의 장소를 to 자리로 옮긴다 */
    move: (from: number, to: number) => {
      if (to < 0 || to >= placeIds.length) return;
      const next = [...placeIds];
      const [id] = next.splice(from, 1);
      next.splice(to, 0, id);
      write({ ...course, placeIds: next });
    },
  };
}
