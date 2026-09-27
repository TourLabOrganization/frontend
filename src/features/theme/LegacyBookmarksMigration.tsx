"use client";

import { useEffect } from "react";
import {
  migrateLegacyBookmarks,
  type ThemeNameTable,
} from "./legacy-bookmarks";

// 예전 테마 북마크를 저장한 장소로 한 번 옮기고 예전 키를 지운다(옮겨 쓰기에 성공했을 때만). 그리는 것은 없다(테마 화면 · ME에 둔다)
export function LegacyBookmarksMigration({ names }: { names: ThemeNameTable }) {
  useEffect(() => {
    migrateLegacyBookmarks(names, Date.now());
  }, [names]);
  return null;
}
