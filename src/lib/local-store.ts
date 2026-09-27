import { useSyncExternalStore } from "react";

// 브라우저 localStorage에 두는 값. 추천 결과(recommend) · 코스 저장(course) · ME(me) 세 기능이 함께 쓴다.
// 사생활 보호 창처럼 저장소를 막은 브라우저에서도 화면이 깨지지 않게 읽기 · 쓰기를 모두 try/catch로 감싼다.
// 서버 렌더에서는 값이 없는 것(null)으로 그리고, 하이드레이션이 끝난 뒤 저장된 값으로 다시 그린다.

/** 마지막 추천 결과의 답 문자열(결과 화면의 ?a=) */
export const LAST_RECOMMENDATION_KEY = "tn.lastRecommendation";
/**
 * 저장한 코스 목록. (SavedPlan | PlannerSavedPlan)[] JSON.
 * kind가 없으면 테마 코스(SavedPlan), kind: "planner"면 투어 플래너 코스(PlannerSavedPlan)다
 */
export const SAVED_PLANS_KEY = "tn.savedPlans";

/** 테마 코스 */
export type SavedPlan = {
  slug: string;
  /** 코스 화면의 ?a= (없으면 빈 문자열) */
  a: string;
  plan: string;
  /** 저장 시각(ms) */
  savedAt: number;
};

/** 투어 플래너 코스. settings는 features/planner/course-store.ts의 PlannerSettings(읽는 쪽이 검사한다) */
export type PlannerSavedPlan = {
  kind: "planner";
  id: string;
  name: string;
  /** 담은 장소의 도시(한국어 이름) */
  city: string | null;
  placeIds: string[];
  settings: Record<string, unknown>;
  savedAt: number;
};

// 같은 탭 안의 쓰기를 알리는 이벤트. storage 이벤트는 다른 탭에서 바꿀 때만 온다
const CHANGE_EVENT = "tn:local-store";

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** 저장된 문자열. 서버 렌더와 하이드레이션 중에는 null */
export function useLocalValue(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readLocal(key),
    () => null,
  );
}

function parseList(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const isThemePlan = (p: unknown): p is SavedPlan =>
  typeof p === "object" &&
  p !== null &&
  !("kind" in p) &&
  typeof (p as SavedPlan).slug === "string" &&
  typeof (p as SavedPlan).a === "string" &&
  typeof (p as SavedPlan).plan === "string" &&
  typeof (p as SavedPlan).savedAt === "number";

const isPlannerPlan = (p: unknown): p is PlannerSavedPlan => {
  if (typeof p !== "object" || p === null) return false;
  const v = p as Record<string, unknown>;
  return (
    v.kind === "planner" &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    (v.city === null || typeof v.city === "string") &&
    Array.isArray(v.placeIds) &&
    v.placeIds.every((id) => typeof id === "string") &&
    typeof v.settings === "object" &&
    v.settings !== null &&
    typeof v.savedAt === "number"
  );
};

/** 저장한 테마 코스 */
export function parseSavedPlans(raw: string | null): SavedPlan[] {
  return parseList(raw).filter(isThemePlan);
}

/** 저장한 투어 플래너 코스 */
export function parsePlannerPlans(raw: string | null): PlannerSavedPlan[] {
  return parseList(raw).filter(isPlannerPlan);
}

/** 테마 코스 목록을 쓴다. 저장된 투어 플래너 코스는 그대로 둔다 */
export function writeSavedPlans(plans: readonly SavedPlan[]): void {
  const others = parseList(readLocal(SAVED_PLANS_KEY)).filter(
    (p) => !isThemePlan(p),
  );
  writeLocal(SAVED_PLANS_KEY, JSON.stringify([...plans, ...others]));
}

/** 투어 플래너 코스를 하나 더한다. id · 저장 시각은 여기서 붙인다 */
export function addPlannerPlan(
  plan: Omit<PlannerSavedPlan, "kind" | "id" | "savedAt">,
): void {
  const now = Date.now();
  writePlannerPlans([
    ...parsePlannerPlans(readLocal(SAVED_PLANS_KEY)),
    { kind: "planner", id: `pl${now.toString(36)}`, ...plan, savedAt: now },
  ]);
}

/** 투어 플래너 코스 목록을 쓴다. 저장된 테마 코스는 그대로 둔다 */
export function writePlannerPlans(plans: readonly PlannerSavedPlan[]): void {
  const others = parseList(readLocal(SAVED_PLANS_KEY)).filter(
    (p) => !isPlannerPlan(p),
  );
  writeLocal(SAVED_PLANS_KEY, JSON.stringify([...others, ...plans]));
}

export function samePlan(
  p: Pick<SavedPlan, "slug" | "a" | "plan">,
  q: Pick<SavedPlan, "slug" | "a" | "plan">,
): boolean {
  return p.slug === q.slug && p.a === q.a && p.plan === q.plan;
}
