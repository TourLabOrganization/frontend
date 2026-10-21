import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { reachable, SRC } from "../../lib/import-graph";

// 테마 화면(/themes/[themeId])이 장소 · 일정 데이터 JSON을 브라우저로 받지 않는지(2026-10-21 검토).
// 코스 탭 지도(ThemeMap)의 도로 경로 조회는 planner/road-legs.ts만 쓰고, 플래너 일정(planner/schedule.ts) · 숙소(stays.ts)는 싣지 않는다.
// 이 화면의 클라이언트 컴포넌트에서 import(import type은 빼고)를 따라가 데이터 JSON에 닿는지 본다(lib/import-graph.ts)
const ROOTS = [
  "features/theme/ThemeMap.tsx",
  "features/theme/MapTab.tsx",
  "features/theme/FilmTab.tsx",
  "features/theme/StampTab.tsx",
  "features/theme/ThemePlaceSheet.tsx",
  "features/theme/ThemePlans.tsx",
  "features/theme/LegacyBookmarksMigration.tsx",
];
const DATA = [
  "features/course/data/places.json",
  "features/course/data/hubs.json",
  "features/planner/data/places.json",
  "features/planner/data/stays.json",
  "features/planner/data/regions.json",
  "features/planner/data/wide.json",
].map((f) => resolve(SRC, f));

describe("테마 화면 번들", () => {
  it("테마 화면의 클라이언트 컴포넌트는 장소 · 숙소 · 권역 · 광역 데이터 JSON을 import하지 않는다", () => {
    const files = reachable(ROOTS);
    expect(files.has(resolve(SRC, "features/planner/road-legs.ts"))).toBe(true);
    expect(DATA.filter((f) => files.has(f))).toEqual([]);
  });

  it("검사가 실제로 데이터 JSON을 찾아낸다(플래너 course-map.ts는 일정 · 숙소를 싣는다)", () => {
    const files = reachable(["features/planner/course-map.ts"]);
    expect(DATA.filter((f) => files.has(f)).length).toBeGreaterThan(3);
  });
});
