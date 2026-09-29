import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import plannerPlaces from "../features/planner/data/places.json";
import signgu from "../features/planner/data/signgu.json";
import { parseTourItems, tourApiUrl } from "./tour-api";

const wrap = (header: unknown, items: unknown) => ({
  response: { header, body: { items, numOfRows: 10, pageNo: 1 } },
});
const OK = { resultCode: "0000", resultMsg: "OK" };

describe("공공데이터포털 응답 파싱 (parseTourItems)", () => {
  it("items.item 배열", () => {
    expect(parseTourItems(wrap(OK, { item: [{ a: 1 }, { a: 2 }] }))).toEqual([
      { a: 1 },
      { a: 2 },
    ]);
  });

  it("items.item 객체 하나", () => {
    expect(parseTourItems(wrap(OK, { item: { a: 1 } }))).toEqual([{ a: 1 }]);
  });

  it("결과 없음: items가 빈 문자열이거나 item이 없다", () => {
    expect(parseTourItems(wrap(OK, ""))).toEqual([]);
    expect(parseTourItems(wrap(OK, {}))).toEqual([]);
    expect(parseTourItems({ response: { header: OK } })).toEqual([]);
  });

  it("resultCode 00도 성공", () => {
    expect(
      parseTourItems(wrap({ resultCode: "00" }, { item: [{ a: 1 }] })),
    ).toEqual([{ a: 1 }]);
  });

  it("resultCode가 0000 · 00이 아니거나 없으면 실패(null)", () => {
    expect(
      parseTourItems(
        wrap(
          { resultCode: "30", resultMsg: "SERVICE_KEY_IS_NOT_REGISTERED" },
          "",
        ),
      ),
    ).toBeNull();
    expect(parseTourItems(wrap({ resultCode: "22" }, { item: [] }))).toBeNull();
    expect(parseTourItems(wrap({}, { item: [{ a: 1 }] }))).toBeNull();
    expect(parseTourItems({ response: {} })).toBeNull();
    expect(parseTourItems(null)).toBeNull();
    expect(parseTourItems("<OpenAPI_ServiceResponse>")).toBeNull();
  });
});

describe("공공데이터포털 주소 (tourApiUrl)", () => {
  it("호스트 · 경로는 고정, 공통 인자와 값은 쿼리로", () => {
    const url = new URL(
      tourApiUrl("Odii/storySearchList", "a+b/c=", { keyword: "첨성대" }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://apis.data.go.kr/B551011/Odii/storySearchList",
    );
    // 디코딩 키의 +, /, =도 인코딩되어 그대로 전해진다
    expect(url.searchParams.get("serviceKey")).toBe("a+b/c=");
    expect(url.searchParams.get("MobileOS")).toBe("ETC");
    expect(url.searchParams.get("MobileApp")).toBe("TourNavigator");
    expect(url.searchParams.get("_type")).toBe("json");
    expect(url.searchParams.get("keyword")).toBe("첨성대");
  });
});

describe("시군구 코드 데이터 (scripts/build-signgu.mjs)", () => {
  const codes = signgu as Record<string, string>;

  it("플래너 장소마다 값이 있고, 값은 5자리 숫자 또는 빈 값", () => {
    expect(Object.keys(codes).sort()).toEqual(
      plannerPlaces.map((p) => p.id).sort(),
    );
    for (const code of Object.values(codes))
      expect(code === "" || /^\d{5}$/.test(code)).toBe(true);
  });

  it("옛 강원(42) · 전북(45) 코드는 남지 않았다", () => {
    for (const code of Object.values(codes)) expect(code).not.toMatch(/^4[25]/);
  });
});

// 시군구 코드 · 스토리텔링 데이터와 서버 모듈(키를 읽는 곳)은 Route Handler에서만 읽는다(클라이언트 번들에 넣지 않는다).
// 클라이언트 컴포넌트("use client" 파일)에서 import(타입만 쓰는 import type은 빼고)를 따라가 닿지 않는지 본다
const SRC = resolve(__dirname, "..");
const SERVER_ONLY = [
  "features/planner/data/signgu.json",
  "features/planner/data/stories.json",
  "lib/tour-api.ts",
  "lib/tour-audio.ts",
  "lib/tour-related.ts",
  "lib/tour-crowd.ts",
].map((f) => resolve(SRC, f));

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

describe("서버 전용 데이터 번들", () => {
  const clientFiles = sourceFiles(SRC).filter((f) =>
    /^\s*["']use client["']/.test(readFileSync(f, "utf8")),
  );

  it("클라이언트 컴포넌트는 시군구 코드 · 스토리텔링 · 공공데이터포털 서버 모듈에 닿지 않는다", () => {
    expect(clientFiles.length).toBeGreaterThan(10);
    const files = reachable(clientFiles);
    expect([...files].filter((f) => SERVER_ONLY.includes(f))).toEqual([]);
  });

  it("검사가 실제로 서버 전용 파일을 찾아낸다(Route Handler는 닿는다)", () => {
    const routes = ["audio", "related", "crowd"].map((k) =>
      resolve(SRC, `app/api/tour/${k}/route.ts`),
    );
    const files = reachable(routes);
    for (const f of SERVER_ONLY) expect(files.has(f)).toBe(true);
  });
});
