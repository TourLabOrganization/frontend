import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { reachable, SRC } from "../../lib/import-graph";

// 여행 정보 탭만 연 페이지가 장소 전체 JSON(data/places.json, 약 850KB)을 브라우저로 받지 않는지.
// 그 탭에 그려지는 클라이언트 컴포넌트에서 import(타입만 쓰는 import type은 빼고)를 따라가 places.json에 닿는지 본다(lib/import-graph.ts)
const ROOTS = [
  "features/planner/InfoCitySelect.tsx",
  "features/planner/CityPicker.tsx",
  "features/planner/InfoCenters.tsx",
  "features/planner/InfoCityTours.tsx",
  "features/planner/InfoStays.tsx",
  "features/planner/InfoFestivals.tsx",
  "features/planner/RoutingHowTo.tsx",
  "features/planner/CourseCountBadge.tsx",
];
const PLACES_JSON = resolve(SRC, "features/planner/data/places.json");

describe("여행 정보 탭 번들", () => {
  it("여행 정보 탭의 클라이언트 컴포넌트는 places.json을 import하지 않는다", () => {
    const files = reachable(ROOTS);
    expect(files.size).toBeGreaterThan(ROOTS.length);
    expect(files.has(PLACES_JSON)).toBe(false);
  });

  it("검사가 실제로 places.json을 찾아낸다(지도 탭은 싣는다)", () => {
    expect(
      reachable(["features/planner/PlannerMapTab.tsx"]).has(PLACES_JSON),
    ).toBe(true);
  });
});
