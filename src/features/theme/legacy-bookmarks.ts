import type { SavedPlace } from "@/lib/local-store";

// 예전 테마 북마크(tn.bookmarks.{slug}, 장소 id 배열)를 저장한 장소(tn.savedPlaces) 형식으로 옮기는 규칙.
// 예전 형식에는 이름이 없어서, 서버가 넘겨준 테마 장소 이름표로 채운다. 이름표에 없는 id(데이터에서 빠진 장소)는 버린다

export const LEGACY_BOOKMARKS_PREFIX = "tn.bookmarks.";

/** 테마 slug → 장소 id → 이름(한 · 영) */
export type ThemeNameTable = Readonly<
  Record<string, Readonly<Record<string, { ko: string; en: string }>>>
>;

export function legacyToSaved(
  slug: string,
  ids: readonly string[],
  names: ThemeNameTable,
  now: number,
): SavedPlace[] {
  const table = names[slug] ?? {};
  return ids.flatMap((id) =>
    table[id]
      ? [{ id, source: slug, savedAt: now, name: { ...table[id] } }]
      : [],
  );
}

/** 이미 저장한 것(같은 id · 출처)은 건너뛰고 뒤에 더한 새 목록 */
export function mergeSaved(
  list: readonly SavedPlace[],
  add: readonly SavedPlace[],
): SavedPlace[] {
  const next = [...list];
  for (const p of add)
    if (!next.some((q) => q.id === p.id && q.source === p.source)) next.push(p);
  return next;
}
