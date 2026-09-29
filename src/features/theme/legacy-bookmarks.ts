import {
  parseSavedPlaces,
  readLocal,
  removeLocal,
  SAVED_PLACES_KEY,
  type SavedPlace,
  writeSavedPlaces,
} from "../../lib/local-store";
import { parseIdList } from "./storage";

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

/**
 * 예전 테마 북마크를 저장한 장소로 옮기고 예전 키를 지운다(테마마다 한 번).
 * 옮겨 쓰기에 실패하면(저장 공간 가득 참 등) 예전 키를 남겨 다음에 다시 옮긴다. 옮길 것이 없으면 바로 지운다
 */
export function migrateLegacyBookmarks(names: ThemeNameTable, now: number) {
  for (const slug of Object.keys(names)) {
    const key = `${LEGACY_BOOKMARKS_PREFIX}${slug}`;
    const raw = readLocal(key);
    if (raw === null) continue;
    const add = legacyToSaved(slug, parseIdList(raw), names, now);
    if (
      add.length > 0 &&
      !writeSavedPlaces(
        mergeSaved(parseSavedPlaces(readLocal(SAVED_PLACES_KEY)), add),
      )
    )
      continue;
    removeLocal(key);
  }
}
