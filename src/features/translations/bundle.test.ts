import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 데이터 번역 표(설명 틀 · 운영시간 · 좌표 기준 · 시티투어 · 관광안내소 · 장면)는 서버에서만 읽는다(text.ts 머리 주석).
// 클라이언트 컴포넌트("use client" 파일)에서 import(타입만 쓰는 import type은 빼고)를 따라가 번역 표에 닿지 않는지 본다.
// 플래너 장소의 영어 이름은 places.json의 en에 이미 채워져 있어(scripts/place-names.mjs) 표를 따로 싣지 않는다
const SRC = resolve(__dirname, "../..");
const DATA_DIR = resolve(SRC, "features/translations/data");
const TEXT = resolve(SRC, "features/translations/text.ts");

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = resolve(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // 패키지
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const f = base + ext;
    if (existsSync(f) && statSync(f).isFile()) {
      if (ext === "" && !/\.(json|ts|tsx)$/.test(f)) continue;
      return f;
    }
  }
  return null;
}

function reachable(roots: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (file.endsWith(".json")) continue;
    const code = readFileSync(file, "utf8");
    const re = /^(?:import|export)\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gm;
    for (const m of code.matchAll(re)) {
      const f = resolveImport(file, m[1]);
      if (f) stack.push(f);
    }
  }
  return seen;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const f = join(dir, name);
    if (statSync(f).isDirectory()) return sourceFiles(f);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [f] : [];
  });
}

const CLIENT_FILES = sourceFiles(SRC).filter((f) =>
  /^\s*["']use client["']/.test(readFileSync(f, "utf8")),
);

describe("데이터 번역 표 번들", () => {
  it("클라이언트 컴포넌트는 번역 표(translations/data)와 조회 함수(text.ts)에 닿지 않는다", () => {
    expect(CLIENT_FILES.length).toBeGreaterThan(10);
    const files = reachable(CLIENT_FILES);
    const leaked = [...files].filter(
      (f) => f === TEXT || f.startsWith(DATA_DIR),
    );
    expect(leaked).toEqual([]);
  });

  it("검사가 실제로 번역 표를 찾아낸다", () => {
    expect([...reachable([TEXT])].some((f) => f.startsWith(DATA_DIR))).toBe(
      true,
    );
  });
});
