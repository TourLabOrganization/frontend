import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 여행 정보 탭만 연 페이지가 장소 전체 JSON(data/places.json, 약 850KB)을 브라우저로 받지 않는지.
// 그 탭에 그려지는 클라이언트 컴포넌트에서 import(타입만 쓰는 import type은 빼고)를 따라가 places.json에 닿는지 본다
const SRC = resolve(__dirname, "../..");
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

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = resolve(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // 패키지
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const f = base + ext;
    if (existsSync(f) && !f.endsWith("/")) {
      if (ext === "" && !/\.(json|ts|tsx)$/.test(f)) continue;
      return f;
    }
  }
  return null;
}

function reachable(roots: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = roots.map((r) => resolve(SRC, r));
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (file.endsWith(".json")) continue;
    const code = readFileSync(file, "utf8");
    // import … from "x" / export … from "x" (import type · export type은 번들에 들어가지 않는다)
    const re = /^(?:import|export)\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gm;
    for (const m of code.matchAll(re)) {
      const f = resolveImport(file, m[1]);
      if (f) stack.push(f);
    }
  }
  return seen;
}

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
