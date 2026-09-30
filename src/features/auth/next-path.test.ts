import { describe, expect, it } from "vitest";
import { authHref, DEFAULT_NEXT, safeNext } from "./next-path";

describe("safeNext", () => {
  it("앱 안 경로는 그대로 둔다", () => {
    for (const path of [
      "/",
      "/me",
      "/planner?tab=course&plan=abc",
      "/themes/rescene?tab=map#scene-1",
      "/login",
    ]) {
      expect(safeNext(path)).toBe(path);
    }
  });

  it("없거나 여러 개면 /me", () => {
    expect(DEFAULT_NEXT).toBe("/me");
    expect(safeNext(undefined)).toBe("/me");
    expect(safeNext("")).toBe("/me");
    expect(safeNext(["/planner", "/me"])).toBe("/me");
  });

  it("다른 사이트로 나가는 주소는 막는다(열린 리디렉트)", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "me",
      " /me",
      // 브라우저는 탭 · 줄바꿈을 지우고 읽는다 → //evil.example
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r/evil.example",
    ]) {
      expect(safeNext(value), JSON.stringify(value)).toBe("/me");
    }
  });
});

describe("authHref", () => {
  it("next는 늘 붙인다", () => {
    const url = new URL(authHref("/login", { next: "/me" }), "http://app");
    expect(url.pathname).toBe("/login");
    expect([...url.searchParams]).toEqual([["next", "/me"]]);
  });

  it("가입 뒤 자동 로그인 실패: email · joined · next", () => {
    const href = authHref("/login", {
      email: "user+tag@example.com",
      joined: true,
      next: "/planner?tab=course&plan=abc",
    });
    const url = new URL(href, "http://app");
    expect(url.pathname).toBe("/login");
    expect([...url.searchParams]).toEqual([
      ["email", "user+tag@example.com"],
      ["joined", "1"],
      ["next", "/planner?tab=course&plan=abc"],
    ]);
  });

  it("가입 화면 주소", () => {
    expect(authHref("/signup", { next: "/me" })).toBe("/signup?next=%2Fme");
  });
});
