import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import plannerPlaces from "../features/planner/data/places.json";
import signgu from "../features/planner/data/signgu.json";
import emptyRes from "./fixtures/tour/empty.json";
import invalidKey from "./fixtures/tour/invalid-key.json";
import odiiKo from "./fixtures/tour/odii-ko-bulguksa.json";
import {
  parseTourItems,
  tourApiUrl,
  withoutCity,
  withoutSpaces,
} from "./tour-api";

// 공공데이터포털 실제 응답(2026-09-29 받음, fixtures/tour). 저장 전에 키를 지웠다
describe("공공데이터포털 응답 파싱 (parseTourItems)", () => {
  it("items.item 배열 (오디 「불국사」 10건)", () => {
    const items = parseTourItems(odiiKo);
    expect(items).toHaveLength(10);
    expect(items?.[0]).toMatchObject({ title: "경주 불국사", langCode: "ko" });
  });

  it("items.item 객체 하나도 배열로 (실제 응답은 1건이어도 배열로 왔다 — PoC처럼 객체 하나도 받는다)", () => {
    const one = odiiKo.response.body.items.item[0];
    const body = {
      response: {
        ...odiiKo.response,
        body: { ...odiiKo.response.body, items: { item: one } },
      },
    };
    expect(parseTourItems(body)).toEqual([one]);
  });

  it("결과 없음: items가 빈 문자열 (오디 「효우당」 실제 응답)", () => {
    expect(emptyRes.response.body.items).toBe("");
    expect(parseTourItems(emptyRes)).toEqual([]);
  });

  it("resultCode가 0000 · 00이 아니거나 없으면 실패(null)", () => {
    // 등록되지 않은 키의 실제 응답(HTTP 403): response.header가 없다
    expect(parseTourItems(invalidKey)).toBeNull();
    // 일일 한도 초과(22) 같은 오류 코드는 실제로 만들 수 없어, 실제 빈 응답의 resultCode만 바꿔 본다
    const withCode = (resultCode: string) => ({
      response: { ...emptyRes.response, header: { resultCode, resultMsg: "" } },
    });
    expect(parseTourItems(withCode("22"))).toBeNull();
    expect(parseTourItems(withCode("00"))).toEqual([]);
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

describe("앞의 도시 이름을 뗀 검색어 (withoutCity)", () => {
  it("장소 이름이 도시 이름(locKo)으로 시작하면 뗀다, 떼고 2글자 이상일 때만", () => {
    expect(withoutCity("전주한옥마을", "전주")).toBe("한옥마을");
    expect(withoutCity("경주 양남 주상절리", "경주")).toBe("양남 주상절리");
    expect(withoutCity("고성 통일전망대", "고성(강원)")).toBe("통일전망대");
    expect(withoutCity("불국사", "경주")).toBeNull();
    expect(withoutCity("정동심곡 바다부채길", "강릉")).toBeNull();
    expect(withoutCity("경주역", "경주")).toBeNull();
  });
});

describe("공백을 뺀 검색어 (withoutSpaces)", () => {
  it("이름에 공백이 있을 때만 공백을 뺀 이름, 도시 이름을 뗀 이름에도 공백이 있으면 그것도", () => {
    expect(withoutSpaces("정동심곡 바다부채길", "강릉")).toEqual([
      "정동심곡바다부채길",
    ]);
    expect(withoutSpaces("경주 양남 주상절리", "경주")).toEqual([
      "경주양남주상절리",
      "양남주상절리",
    ]);
    // 도시 이름을 뗀 이름(「통일전망대」)에 공백이 없으면 전체 이름의 것 하나
    expect(withoutSpaces("고성 통일전망대", "고성(강원)")).toEqual([
      "고성통일전망대",
    ]);
    expect(withoutSpaces("전주한옥마을", "전주")).toEqual([]);
    expect(withoutSpaces("불국사", "경주")).toEqual([]);
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
  "lib/tour-photo.ts",
  "lib/tour-popular.ts",
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
    const routes = ["audio", "related", "crowd", "photo", "popular"].map((k) =>
      resolve(SRC, `app/api/tour/${k}/route.ts`),
    );
    const files = reachable(routes);
    for (const f of SERVER_ONLY) expect(files.has(f)).toBe(true);
  });
});
