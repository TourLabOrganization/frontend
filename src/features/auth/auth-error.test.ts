import { describe, expect, it } from "vitest";
import { ApiError } from "../../lib/api/client";
import { authErrorKind } from "./auth-error";

// 코드는 백엔드 응답(2026-09-30 실제 호출 · /v3/api-docs)과 같다

describe("authErrorKind", () => {
  it("백엔드 코드로 나눈다", () => {
    expect(
      authErrorKind(new ApiError(401, "AUTH_LOGIN_FAILED", "login failed")),
    ).toBe("loginFailed");
    expect(
      authErrorKind(new ApiError(409, "USER_EMAIL_DUPLICATED", "duplicated")),
    ).toBe("emailTaken");
    expect(
      authErrorKind(new ApiError(400, "INVALID_INPUT_VALUE", "invalid")),
    ).toBe("invalidInput");
  });

  it("message가 아니라 code로 나눈다", () => {
    expect(
      authErrorKind(
        new ApiError(401, "AUTH_TOKEN_INVALID", "AUTH_LOGIN_FAILED"),
      ),
    ).toBe("unavailable");
  });

  it("시간 초과 · 네트워크 오류 · 모르는 코드 · 그 밖은 unavailable", () => {
    for (const error of [
      new DOMException("signal timed out", "TimeoutError"),
      new TypeError("Failed to fetch"),
      new ApiError(500, "INTERNAL_SERVER_ERROR", "server error"),
      new ApiError(502, "UNKNOWN_ERROR", "Bad Gateway"),
      new Error("NEXT_PUBLIC_API_BASE_URL is not set"),
      null,
      undefined,
    ]) {
      expect(authErrorKind(error), String(error)).toBe("unavailable");
    }
  });
});
