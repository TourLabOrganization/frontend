import { useSyncExternalStore } from "react";

// 브라우저 localStorage에 두는 값. 추천 결과(recommend) · 코스 저장(course) · ME(me) 세 기능이 함께 쓴다.
// 사생활 보호 창처럼 저장소를 막은 브라우저에서도 화면이 깨지지 않게 읽기 · 쓰기를 모두 try/catch로 감싼다.
// 서버 렌더에서는 값이 없는 것(null)으로 그리고, 하이드레이션이 끝난 뒤 저장된 값으로 다시 그린다.

/** 마지막 추천 결과의 답 문자열(결과 화면의 ?a=) */
export const LAST_RECOMMENDATION_KEY = "tn.lastRecommendation";
/** 저장한 코스 목록. SavedPlan[] JSON */
export const SAVED_PLANS_KEY = "tn.savedPlans";

export type SavedPlan = {
  slug: string;
  /** 코스 화면의 ?a= (없으면 빈 문자열) */
  a: string;
  plan: string;
  /** 저장 시각(ms) */
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

export function parseSavedPlans(raw: string | null): SavedPlan[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (p): p is SavedPlan =>
        typeof p === "object" &&
        p !== null &&
        typeof p.slug === "string" &&
        typeof p.a === "string" &&
        typeof p.plan === "string" &&
        typeof p.savedAt === "number",
    );
  } catch {
    return [];
  }
}

export function writeSavedPlans(plans: readonly SavedPlan[]): void {
  writeLocal(SAVED_PLANS_KEY, JSON.stringify(plans));
}

export function samePlan(
  p: Pick<SavedPlan, "slug" | "a" | "plan">,
  q: Pick<SavedPlan, "slug" | "a" | "plan">,
): boolean {
  return p.slug === q.slug && p.a === q.a && p.plan === q.plan;
}
