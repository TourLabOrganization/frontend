import {
  api,
  ApiError,
  type AuthTokens,
  readTokens,
  saveTokens,
} from "@/lib/api/client";

// 로그인 · 회원가입 · 로그아웃 · 내 정보(백엔드 Auth · User API). 토큰 저장과 401 재발급은 lib/api/client.ts가 한다(docs/api.md 「인증」).
// 필드 설명은 백엔드 명세(/v3/api-docs)의 description을 옮겼다

/** 백엔드 호출 시간 제한(ms) */
const TIMEOUT_MS = 8000;

/** 로그인 요청 */
export type AuthLoginRequest = {
  /** 이메일 */
  email: string;
  /** 비밀번호 */
  password: string;
};

/** 회원가입 요청 */
export type AuthSignupRequest = {
  /** 이메일 */
  email: string;
  /** 비밀번호 */
  password: string;
  /** 닉네임 */
  nickname: string;
};

/** 회원가입 응답(토큰은 주지 않는다) */
export type AuthSignupResponse = {
  /** 생성된 사용자 ID */
  userId: number;
  /** 이메일 */
  email: string;
};

/** 내 정보 응답 */
export type UserMeResponse = {
  /** 사용자 ID */
  id: number;
  /** 이메일 */
  email: string;
  /** 닉네임 */
  nickname: string;
  /** 권한 */
  role: "USER" | "ADMIN";
};

export function login(body: AuthLoginRequest) {
  return api<AuthTokens>("/api/v1/auth/login", {
    method: "POST",
    body,
    auth: false,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export function signup(body: AuthSignupRequest) {
  return api<AuthSignupResponse>("/api/v1/auth/signup", {
    method: "POST",
    body,
    auth: false,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** 이 사용자의 refresh token을 모두 폐기한다(Bearer 필요) */
export function logout() {
  return api<null>("/api/v1/auth/logout", {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * 내 정보. 로그아웃 상태면 null이다: 토큰이 없으면 부르지 않고, 401(재발급까지 실패)이면 남은 토큰을 지운다.
 * 그 밖의 실패(시간 초과 · 네트워크 · 404 USER_NOT_FOUND 등)는 던진다
 */
export async function fetchMe(): Promise<UserMeResponse | null> {
  if (!readTokens()) return null;
  try {
    return await api<UserMeResponse>("/api/v1/users/me", {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      if (readTokens()) saveTokens(null);
      return null;
    }
    throw error;
  }
}
