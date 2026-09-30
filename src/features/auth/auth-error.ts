import { ApiError } from "../../lib/api/client";

/** 로그인 · 가입 실패를 화면 문구(messages Auth.errors의 키)로 나눈 것 */
export type AuthErrorKind =
  "loginFailed" | "emailTaken" | "invalidInput" | "unavailable";

/**
 * 실패 → 화면 문구. 분기는 ApiError.code로 한다(message 아님, AGENTS.md 2).
 * 시간 초과(TimeoutError) · 네트워크 오류(TypeError) · 모르는 코드 · 5xx는 모두 unavailable이다
 */
export function authErrorKind(error: unknown): AuthErrorKind {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "AUTH_LOGIN_FAILED":
        return "loginFailed";
      case "USER_EMAIL_DUPLICATED":
        return "emailTaken";
      case "INVALID_INPUT_VALUE":
        return "invalidInput";
    }
  }
  return "unavailable";
}
