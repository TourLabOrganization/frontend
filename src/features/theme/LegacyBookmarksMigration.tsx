"use client";

import { useEffect } from "react";
import {
  parseSavedPlaces,
  readLocal,
  removeLocal,
  SAVED_PLACES_KEY,
  writeSavedPlaces,
} from "@/lib/local-store";
import {
  LEGACY_BOOKMARKS_PREFIX,
  legacyToSaved,
  mergeSaved,
  type ThemeNameTable,
} from "./legacy-bookmarks";
import { parseIdList } from "./storage";

// 예전 테마 북마크를 저장한 장소로 한 번 옮기고 예전 키를 지운다. 그리는 것은 없다(테마 화면 · ME에 둔다)
export function LegacyBookmarksMigration({ names }: { names: ThemeNameTable }) {
  useEffect(() => {
    for (const slug of Object.keys(names)) {
      const key = `${LEGACY_BOOKMARKS_PREFIX}${slug}`;
      const raw = readLocal(key);
      if (raw === null) continue;
      const add = legacyToSaved(slug, parseIdList(raw), names, Date.now());
      if (add.length > 0)
        writeSavedPlaces(
          mergeSaved(parseSavedPlaces(readLocal(SAVED_PLACES_KEY)), add),
        );
      removeLocal(key);
    }
  }, [names]);
  return null;
}
