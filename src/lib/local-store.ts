import { useSyncExternalStore } from "react";

// 브라우저 localStorage에 두는 값. 추천 결과(recommend) · 코스 저장(course) · ME(me) · 머리줄 알림(components/Notifications)이 함께 쓴다.
// 사생활 보호 창처럼 저장소를 막은 브라우저에서도 화면이 깨지지 않게 읽기 · 쓰기를 모두 try/catch로 감싼다.
// 서버 렌더에서는 값이 없는 것(null)으로 그리고, 하이드레이션이 끝난 뒤 저장된 값으로 다시 그린다.

/** 마지막 추천 결과의 답 문자열(결과 화면의 ?a=) */
export const LAST_RECOMMENDATION_KEY = "tn.lastRecommendation";
/**
 * 마지막 추천 결과의 1위 테마. LastTopTheme JSON.
 * 결과 화면이 적합도 지수 1위를 적고, ME는 다시 계산하지 않고 이 값을 읽는다.
 * a가 LAST_RECOMMENDATION_KEY와 다르면(예전 기록) 쓰지 않는다
 */
export const LAST_TOP_THEME_KEY = "tn.lastTopTheme";

export type LastTopTheme = {
  /** 그 추천의 답 문자열(?a=) */
  a: string;
  /** 1위 테마 slug */
  slug: string;
};
/**
 * 저장한 코스 목록. (SavedPlan | PlannerSavedPlan)[] JSON.
 * kind가 없으면 테마 코스(SavedPlan), kind: "planner"면 투어 플래너 코스(PlannerSavedPlan)다
 */
export const SAVED_PLANS_KEY = "tn.savedPlans";

/** 테마 코스. (slug, a, plan)이 같은 코스는 하나만 둔다(samePlan) */
export type SavedPlan = {
  slug: string;
  /** 코스 화면의 ?a= (없으면 빈 문자열) */
  a: string;
  plan: string;
  /** 저장 시각(ms). 덮어쓰면 그 시각으로 바뀐다 */
  savedAt: number;
  /** 플랜 이름(테마 코스 탭 「내 플랜」). 이름 없이 저장한 예전 항목에는 없다 */
  name?: string;
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

/**
 * 읽은 알림 id 목록. string[] JSON. 알림 id는 내용이 바뀌면 달라져서(lib/notifications.ts) 새 내용은 다시 안 읽음이 된다
 */
export const NOTIFICATIONS_READ_KEY = "tn.notifications.read";

// 같은 탭 안의 쓰기를 알리는 이벤트. storage 이벤트는 다른 탭에서 바꿀 때만 온다
const CHANGE_EVENT = "tn:local-store";

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 값을 쓴다. 썼으면 true, 저장소가 막혔거나 가득 차 못 썼으면 false(대부분의 호출부는 무시해도 된다) */
export function writeLocal(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

export function removeLocal(key: string): void {
  try {
    window.localStorage.removeItem(key);
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

/** 마지막 추천의 1위 테마. 답 문자열(a)이 다르거나 모양이 틀리면 null */
export function parseLastTopTheme(
  raw: string | null,
  a: string | null,
): string | null {
  if (!raw || !a) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const v = value as Record<string, unknown>;
    return v.a === a && typeof v.slug === "string" ? v.slug : null;
  } catch {
    return null;
  }
}

/** 읽은 알림 id. 모양이 틀리면 빈 목록 */
export function parseReadIds(raw: string | null): string[] {
  return parseList(raw).filter((id): id is string => typeof id === "string");
}

/** 읽은 알림 id를 쓴다 */
export function writeReadIds(ids: readonly string[]): void {
  writeLocal(NOTIFICATIONS_READ_KEY, JSON.stringify([...new Set(ids)]));
}

/** 저장한 테마 코스. 이름이 문자열이 아니면 이름만 뺀다 */
export function parseSavedPlans(raw: string | null): SavedPlan[] {
  return parseList(raw)
    .filter(isThemePlan)
    .map(({ slug, a, plan, savedAt, name }) =>
      typeof name === "string" && name.trim()
        ? { slug, a, plan, savedAt, name }
        : { slug, a, plan, savedAt },
    );
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

/** 테마 코스를 하나 더한다. 저장 시각은 여기서 붙인다. 이름이 비어 있으면 name을 두지 않는다 */
export function addThemePlan(
  plan: Pick<SavedPlan, "slug" | "a" | "plan">,
  name: string,
): void {
  const trimmed = name.trim();
  writeSavedPlans([
    ...parseSavedPlans(readLocal(SAVED_PLANS_KEY)),
    { ...plan, savedAt: Date.now(), ...(trimmed ? { name: trimmed } : {}) },
  ]);
}

/** 테마 코스 하나(target)를 지금 코스로 덮어쓴다(overwriteThemePlan). 저장 시각은 여기서 붙인다 */
export function saveThemeOverwrite(
  target: Pick<SavedPlan, "slug" | "a" | "plan">,
  next: Pick<SavedPlan, "slug" | "a" | "plan">,
): void {
  writeSavedPlans(
    overwriteThemePlan(
      parseSavedPlans(readLocal(SAVED_PLANS_KEY)),
      target,
      next,
      Date.now(),
    ),
  );
}

/** 투어 플래너 코스를 하나 더한다. id · 저장 시각은 여기서 붙인다. 붙인 id를 돌려준다 */
export function addPlannerPlan(
  plan: Omit<PlannerSavedPlan, "kind" | "id" | "savedAt">,
): string {
  const now = Date.now();
  const id = `pl${now.toString(36)}`;
  writePlannerPlans([
    ...parsePlannerPlans(readLocal(SAVED_PLANS_KEY)),
    { kind: "planner", id, ...plan, savedAt: now },
  ]);
  return id;
}

/**
 * 저장된 플래너 플랜 하나를 지금 코스로 덮어쓴 목록(PoC planUpdate). 이름 · id는 그대로, 저장 시각은 now
 */
export function overwritePlannerPlan(
  list: readonly PlannerSavedPlan[],
  id: string,
  next: Pick<PlannerSavedPlan, "city" | "placeIds" | "settings">,
  now: number,
): PlannerSavedPlan[] {
  return list.map((p) =>
    p.id === id
      ? {
          ...p,
          city: next.city,
          placeIds: [...next.placeIds],
          settings: { ...next.settings, name: p.name },
          savedAt: now,
        }
      : p,
  );
}

/** 저장된 플래너 플랜 하나를 뺀 목록 */
export function removePlannerPlan(
  list: readonly PlannerSavedPlan[],
  id: string,
): PlannerSavedPlan[] {
  return list.filter((p) => p.id !== id);
}

/**
 * 저장된 테마 코스 하나(target)를 지금 코스(next)로 덮어쓴 목록. 이름은 그대로, 저장 시각은 now.
 * 지금 코스와 같은 다른 항목이 있으면 빼서 같은 코스가 둘이 되지 않게 한다
 */
export function overwriteThemePlan(
  list: readonly SavedPlan[],
  target: Pick<SavedPlan, "slug" | "a" | "plan">,
  next: Pick<SavedPlan, "slug" | "a" | "plan">,
  now: number,
): SavedPlan[] {
  return list
    .filter((p) => samePlan(p, target) || !samePlan(p, next))
    .map((p) =>
      samePlan(p, target)
        ? { ...p, slug: next.slug, a: next.a, plan: next.plan, savedAt: now }
        : p,
    );
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

/**
 * 저장한 장소(장소 시트의 「저장」 북마크). SavedPlace[] JSON.
 * 테마 화면과 투어 플래너 장소 시트가 쓰고, ME · 테마 스탬프 탭이 읽는다.
 * 같은 장소라도 출처(source)가 다르면 따로 저장한다(테마 스탬프 탭은 그 테마에서 저장한 것만 보인다)
 */
export const SAVED_PLACES_KEY = "tn.savedPlaces";

/** 투어 플래너에서 저장한 장소의 출처 */
export const PLANNER_SOURCE = "planner";

export type SavedPlace = {
  /** 장소 id */
  id: string;
  /** 저장한 곳. 테마 slug 또는 PLANNER_SOURCE */
  source: string;
  /** 저장 시각(ms) */
  savedAt: number;
  /** 저장할 때의 장소 이름(한 · 영). ME가 장소 데이터를 불러오지 않고 이름을 보이려고 둔다 */
  name: { ko: string; en: string };
};

const isSavedPlace = (p: unknown): p is SavedPlace => {
  if (typeof p !== "object" || p === null) return false;
  const v = p as Record<string, unknown>;
  const name = v.name as Record<string, unknown> | null | undefined;
  return (
    typeof v.id === "string" &&
    typeof v.source === "string" &&
    typeof v.savedAt === "number" &&
    typeof name === "object" &&
    name !== null &&
    typeof name.ko === "string" &&
    typeof name.en === "string"
  );
};

/** 저장한 장소. 모양이 틀린 항목은 버린다 */
export function parseSavedPlaces(raw: string | null): SavedPlace[] {
  return parseList(raw).filter(isSavedPlace);
}

export function isPlaceSaved(
  list: readonly SavedPlace[],
  id: string,
  source: string,
): boolean {
  return list.some((p) => p.id === id && p.source === source);
}

/** 저장돼 있으면 빼고, 없으면 끝에 더한 새 목록 */
export function toggleSavedPlace(
  list: readonly SavedPlace[],
  place: Omit<SavedPlace, "savedAt">,
  now: number,
): SavedPlace[] {
  return isPlaceSaved(list, place.id, place.source)
    ? list.filter((p) => !(p.id === place.id && p.source === place.source))
    : [...list, { ...place, savedAt: now }];
}

export function writeSavedPlaces(list: readonly SavedPlace[]): boolean {
  return writeLocal(SAVED_PLACES_KEY, JSON.stringify(list));
}

/** 저장한 장소 목록과 토글 · 지우기. 서버 렌더와 하이드레이션 중에는 빈 목록 */
export function useSavedPlaces() {
  const list = parseSavedPlaces(useLocalValue(SAVED_PLACES_KEY));
  return {
    list,
    has: (id: string, source: string) => isPlaceSaved(list, id, source),
    toggle: (place: Omit<SavedPlace, "savedAt">) =>
      writeSavedPlaces(toggleSavedPlace(list, place, Date.now())),
    remove: (id: string, source: string) =>
      writeSavedPlaces(
        list.filter((p) => !(p.id === id && p.source === source)),
      ),
  };
}
