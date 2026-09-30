// 로그인 · 회원가입 입력 검사(순수 함수). 가입 규칙은 백엔드 AuthSignupRequest DTO 그대로다:
// email @NotBlank @Email @Size(max=255) · password @NotBlank @Size(min=8, max=64) · nickname @NotBlank @Size(max=20).
// 결과는 messages Auth.errors의 키이고, 문제가 없으면 null이다. 길이는 백엔드(Java String.length)처럼 UTF-16 단위로 센다

export const EMAIL_MAX = 255;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;
export const NICKNAME_MAX = 20;

/** 오류 문구 · 도움말(Auth.errors · Auth.passwordHelp)에 넣는 숫자 */
export const LIMITS = {
  emailMax: EMAIL_MAX,
  passwordMin: PASSWORD_MIN,
  passwordMax: PASSWORD_MAX,
  nicknameMax: NICKNAME_MAX,
};

export type FieldError =
  | "emailRequired"
  | "emailInvalid"
  | "emailTooLong"
  | "passwordRequired"
  | "passwordLength"
  | "nicknameRequired"
  | "nicknameTooLong";

export type LoginField = "email" | "password";
export type SignupField = LoginField | "nickname";
export type FieldErrors<F extends string> = Record<F, FieldError | null>;

// 점으로 이은 조각 @ 점으로 이은 조각(조각에는 공백 · @ · 점이 없다). 백엔드 @Email보다 느슨하게 둬 점 없는 도메인도 받는다.
// 가입된 이메일을 로그인에서 막지 않고, 더 엄격한 검사는 백엔드에 맡긴다(막히면 invalidInput 문구).
// 조각이 점을 품지 않아 긴 입력에서도 되짚기가 늘지 않는다
const EMAIL_PATTERN = /^[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)*$/;

/** 이메일. 앞뒤 공백을 뗀 값으로 빈 값 → 형식 → 255자 순서로 본다(보낼 때도 뗀 값을 보낸다) */
export function validateEmail(value: string): FieldError | null {
  const email = value.trim();
  if (email === "") return "emailRequired";
  if (!EMAIL_PATTERN.test(email)) return "emailInvalid";
  if (email.length > EMAIL_MAX) return "emailTooLong";
  return null;
}

/**
 * 비밀번호. 값을 다듬지 않는다: 공백뿐이면 빈 값(@NotBlank)이고 길이는 공백까지 센다.
 * 로그인은 빈 값만 본다. 8~64자는 가입 규칙이라 규칙 밖의 기존 계정도 로그인할 수 있게 판단을 서버(401)에 맡긴다
 */
export function validatePassword(
  value: string,
  rule: "signup" | "login" = "signup",
): FieldError | null {
  if (value.trim() === "") return "passwordRequired";
  if (rule === "login") return null;
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX)
    return "passwordLength";
  return null;
}

/** 닉네임. 앞뒤 공백을 뗀 값으로 빈 값 → 20자 순서로 본다 */
export function validateNickname(value: string): FieldError | null {
  const nickname = value.trim();
  if (nickname === "") return "nicknameRequired";
  if (nickname.length > NICKNAME_MAX) return "nicknameTooLong";
  return null;
}

export function validateLogin(
  values: Record<LoginField, string>,
): FieldErrors<LoginField> {
  return {
    email: validateEmail(values.email),
    password: validatePassword(values.password, "login"),
  };
}

export function validateSignup(
  values: Record<SignupField, string>,
): FieldErrors<SignupField> {
  return {
    email: validateEmail(values.email),
    password: validatePassword(values.password),
    nickname: validateNickname(values.nickname),
  };
}
