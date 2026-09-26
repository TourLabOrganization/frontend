import { useSyncExternalStore } from "react";
import { readLocal, useLocalValue, writeLocal } from "@/lib/local-store";

// 투어 플래너에서 코스에 담은 장소. localStorage `tn.planner.course`에 JSON으로 둔다.
//   { city: "경주", placeIds: ["gj2", …] }  (담은 순서 = 코스 탭 순서)
// 한 코스는 한 도시의 장소만 담는다. 다른 도시 장소가 섞이면 일정 계산(course/schedule.ts)이 틀어진다.
// 그래서 다른 도시 장소를 담으려 하면 쓰는 쪽이 먼저 비울지 묻는다(needsCityChange).
// 여러 컴포넌트(지도 목록 · 장소 시트 · 코스 탭 · 하단 탭 배지)가 같은 값을 보게
// local-store의 useSyncExternalStore 구독(useLocalValue)으로 읽는다.
// US-203이 이 값에 코스 설정(날짜 · 출발지 등)을 더한다.

export const PLANNER_COURSE_KEY = "tn.planner.course";

export type PlannerCourse = {
  /** 담은 장소의 도시(한국어 이름). 비어 있으면 null */
  city: string | null;
  placeIds: string[];
};

const EMPTY: PlannerCourse = { city: null, placeIds: [] };

export function parseCourse(raw: string | null): PlannerCourse {
  if (!raw) return EMPTY;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return EMPTY;
    const { city, placeIds } = v as Record<string, unknown>;
    const ids = Array.isArray(placeIds)
      ? placeIds.filter((id): id is string => typeof id === "string")
      : [];
    return {
      city: typeof city === "string" && ids.length > 0 ? city : null,
      placeIds: [...new Set(ids)],
    };
  } catch {
    return EMPTY;
  }
}

function write(course: PlannerCourse): void {
  // 뒤에 붙을 설정(US-203)을 지우지 않게 저장된 다른 필드는 남긴다
  let rest: Record<string, unknown> = {};
  try {
    const prev: unknown = JSON.parse(readLocal(PLANNER_COURSE_KEY) ?? "{}");
    if (typeof prev === "object" && prev !== null)
      rest = prev as Record<string, unknown>;
  } catch {
    rest = {};
  }
  writeLocal(
    PLANNER_COURSE_KEY,
    JSON.stringify({
      ...rest,
      city: course.placeIds.length > 0 ? course.city : null,
      placeIds: course.placeIds,
    }),
  );
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
