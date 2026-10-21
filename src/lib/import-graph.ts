import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// 번들 검사 테스트(planner/info-bundle.test.ts · theme/map-bundle.test.ts)가 쓰는 import 따라가기(node 전용, 화면 코드는 import하지 않는다).
// 파일에서 import(타입만 쓰는 import type은 빼고)를 따라가 닿는 파일을 모은다. 패키지는 따라가지 않는다

/** src 폴더 */
export const SRC = resolve(__dirname, "..");

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

/** roots(src 기준 경로)에서 닿는 파일(절대 경로) */
export function reachable(roots: readonly string[]): Set<string> {
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
