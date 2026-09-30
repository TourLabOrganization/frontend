import { describe, expect, it } from "vitest";
import {
  EMAIL_MAX,
  NICKNAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  validateEmail,
  validateLogin,
  validateNickname,
  validatePassword,
  validateSignup,
} from "./validate";

// 가입 규칙은 백엔드 AuthSignupRequest DTO(2026-09-30 /v3/api-docs)와 같다

/** local@example.com 꼴로 전체 길이가 length인 이메일 */
function emailOfLength(length: number): string {
  const domain = "@example.com";
  return "a".repeat(length - domain.length) + domain;
}

describe("validateEmail", () => {
  it("빈 값 · 공백뿐이면 emailRequired", () => {
    expect(validateEmail("")).toBe("emailRequired");
    expect(validateEmail("   ")).toBe("emailRequired");
  });

  it("앞뒤 공백을 떼고 본다", () => {
    expect(validateEmail("  user@example.com  ")).toBeNull();
  });

  it("흔한 이메일은 받는다", () => {
    for (const email of [
      "user@example.com",
      "first.last+tag@sub.example.co.kr",
      "홍길동@example.com",
      // 백엔드 @Email도 점 없는 도메인을 받는다(가입된 계정을 로그인에서 막지 않게)
      "test@localhost",
    ]) {
      expect(validateEmail(email), email).toBeNull();
    }
  });

  it("형식이 틀리면 emailInvalid", () => {
    for (const email of [
      "user",
      "user@",
      "@example.com",
      "user@@example.com",
      "us er@example.com",
      "user@exa mple.com",
      "user@example..com",
      "user@.example.com",
      "user@example.com.",
      ".user@example.com",
      "user.@example.com",
    ]) {
      expect(validateEmail(email), email).toBe("emailInvalid");
    }
  });

  it("255자까지 받고 넘으면 emailTooLong(공백을 뗀 길이)", () => {
    expect(validateEmail(emailOfLength(EMAIL_MAX))).toBeNull();
    expect(validateEmail(` ${emailOfLength(EMAIL_MAX)} `)).toBeNull();
    expect(validateEmail(emailOfLength(EMAIL_MAX + 1))).toBe("emailTooLong");
  });

  it("형식을 길이보다 먼저 본다", () => {
    expect(validateEmail("a".repeat(EMAIL_MAX + 1))).toBe("emailInvalid");
  });

  it("긴 입력도 바로 끝난다(정규식 되짚기가 늘지 않는다)", () => {
    const started = performance.now();
    validateEmail(`a@${".".repeat(50_000)}@`);
    validateEmail(`${"a.".repeat(50_000)}@`);
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe("validatePassword", () => {
  it("빈 값 · 공백뿐이면 passwordRequired(@NotBlank)", () => {
    expect(validatePassword("")).toBe("passwordRequired");
    expect(validatePassword(" ".repeat(PASSWORD_MIN))).toBe("passwordRequired");
    expect(validatePassword("", "login")).toBe("passwordRequired");
    expect(validatePassword("   ", "login")).toBe("passwordRequired");
  });

  it("가입은 8~64자, 벗어나면 passwordLength", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN - 1))).toBe(
      "passwordLength",
    );
    expect(validatePassword("a".repeat(PASSWORD_MIN))).toBeNull();
    expect(validatePassword("a".repeat(PASSWORD_MAX))).toBeNull();
    expect(validatePassword("a".repeat(PASSWORD_MAX + 1))).toBe(
      "passwordLength",
    );
  });

  it("공백을 떼지 않고 공백까지 센다", () => {
    // 앞 공백 1 + 7글자 = 8자
    expect(validatePassword(" abcdefg")).toBeNull();
    // 공백을 떼면 5자라 모자라지만 떼지 않아 8자다
    expect(validatePassword("  abcde ")).toBeNull();
    expect(validatePassword(" abcde ")).toBe("passwordLength");
  });

  it("로그인은 빈 값만 본다(길이는 서버가 판단)", () => {
    expect(validatePassword("short", "login")).toBeNull();
    expect(validatePassword("a".repeat(PASSWORD_MAX + 1), "login")).toBeNull();
  });
});

describe("validateNickname", () => {
  it("빈 값 · 공백뿐이면 nicknameRequired", () => {
    expect(validateNickname("")).toBe("nicknameRequired");
    expect(validateNickname("  ")).toBe("nicknameRequired");
  });

  it("앞뒤 공백을 뗀 뒤 20자까지 받는다", () => {
    expect(validateNickname("여행자")).toBeNull();
    expect(validateNickname("가".repeat(NICKNAME_MAX))).toBeNull();
    expect(validateNickname(`  ${"가".repeat(NICKNAME_MAX)}  `)).toBeNull();
    expect(validateNickname("가".repeat(NICKNAME_MAX + 1))).toBe(
      "nicknameTooLong",
    );
  });
});

describe("validateLogin · validateSignup", () => {
  it("칸마다 오류 키(없으면 null)를 돌려준다", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: "emailRequired",
      password: "passwordRequired",
    });
    expect(
      validateLogin({ email: "user@example.com", password: "short" }),
    ).toEqual({ email: null, password: null });
    expect(
      validateSignup({ email: "user", password: "short", nickname: " " }),
    ).toEqual({
      email: "emailInvalid",
      password: "passwordLength",
      nickname: "nicknameRequired",
    });
    expect(
      validateSignup({
        email: "user@example.com",
        password: "password1234",
        nickname: "홍길동",
      }),
    ).toEqual({ email: null, password: null, nickname: null });
  });
});
