// 코스 빌더에서 담은 장소를 고치는 순수 함수. 체류 시간 덮어쓰기와 「이 날에 넣기」.
// 규칙은 PoC Tour Planner.dc.html(setStay · courseList · addCourseAt · dayPlaceHits)을 그대로 옮겼다.
// 일정 계산(course/schedule.ts · scenarios.ts · planner/schedule.ts)은 바꾸지 않는다. 여기서는 그 입력(장소의 min · 담은 순서)만 바꾼다.

/** 체류 시간 한 번에 바꾸는 폭(분). PoC stayDec · stayInc */
export const STAY_STEP = 15;
/** 체류 시간 범위(분). PoC setStay의 Math.max(15, Math.min(600, v)) */
export const STAY_MIN = 15;
export const STAY_MAX = 600;

/** 장소 id → 사용자가 정한 체류 분. 추천값과 같으면 두지 않는다 */
export type StayOverrides = Readonly<Record<string, number>>;

/** 저장된 값을 검사한다. 범위 밖 · 숫자가 아닌 값은 버린다 */
export function parseStayOverrides(v: unknown): Record<string, number> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [id, min] of Object.entries(v as Record<string, unknown>))
    if (
      typeof min === "number" &&
      Number.isInteger(min) &&
      min >= STAY_MIN &&
      min <= STAY_MAX
    )
      out[id] = min;
  return out;
}

/**
 * 체류 시간을 정한다(PoC setStay). v가 null이거나 추천값(rec)과 같으면 덮어쓰기를 지우고,
 * 아니면 15~600분으로 자른 값을 둔다
 */
export function setStayOverride(
  ov: StayOverrides,
  id: string,
  rec: number,
  v: number | null,
): Record<string, number> {
  const next = { ...ov };
  if (v === null || v === rec) delete next[id];
  else next[id] = Math.max(STAY_MIN, Math.min(STAY_MAX, v));
  return next;
}

/** 덮어쓴 체류 시간을 장소의 min에 넣는다(PoC courseList). 일정 계산은 이 min을 그대로 쓴다 */
export function withStayOverrides<T extends { id: string; min: number }>(
  places: readonly T[],
  ov: StayOverrides,
): T[] {
  return places.map((p) => (ov[p.id] != null ? { ...p, min: ov[p.id] } : p));
}

/**
 * 담은 순서에서 afterIdx 자리 뒤에 id를 끼워 넣는다(PoC addCourseAt).
 * 이미 담겨 있으면 먼저 뺀 뒤 넣는다. afterIdx가 null이거나 0보다 작으면 맨 뒤에 넣는다.
 * 날짜 나누기는 시간으로 다시 계산되므로, 그 날이 꽉 차 있으면 다음 날로 밀린다
 */
export function insertAfter(
  ids: readonly string[],
  id: string,
  afterIdx: number | null,
): string[] {
  const arr = ids.filter((x) => x !== id);
  const at =
    afterIdx === null || afterIdx < 0
      ? arr.length
      : Math.min(afterIdx + 1, arr.length);
  arr.splice(at, 0, id);
  return arr;
}

/**
 * 「이 날에 넣기」의 afterIdx(PoC: 그 날 마지막 경유지 뒤, 빈 날이면 맨 뒤).
 * dayStopIds는 그 날 일정의 장소 id(순서대로)
 */
export function dayInsertIndex(
  ids: readonly string[],
  dayStopIds: readonly string[],
): number | null {
  const last = dayStopIds.at(-1);
  if (last === undefined) return null;
  const i = ids.indexOf(last);
  return i < 0 ? null : i;
}
