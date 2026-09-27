import { getThemePlaces, PLACES_BY_THEME } from "@/features/course/places";
import type { ThemeNameTable } from "./legacy-bookmarks";

// 예전 북마크 옮기기(LegacyBookmarksMigration)에 넘길 테마 장소 이름표. 서버 컴포넌트에서만 부른다(장소 데이터를 브라우저 번들에 싣지 않게)
export function themeNameTable(
  slugs: readonly string[] = Object.keys(PLACES_BY_THEME),
): ThemeNameTable {
  return Object.fromEntries(
    slugs.map((slug) => [
      slug,
      Object.fromEntries(
        getThemePlaces(slug).map((p) => [p.id, { ko: p.ko, en: p.en }]),
      ),
    ]),
  );
}
