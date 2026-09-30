/** 로그인 · 가입 뒤 갈 곳이 없거나 받을 수 없을 때 */
export const DEFAULT_NEXT = "/me";

// 제어 문자(탭 · 줄바꿈 등). 브라우저는 주소의 탭 · 줄바꿈을 지우고 읽어서 "/\t/evil.com"이 //evil.com(다른 사이트)이 된다
const CONTROL_CHARS = /\p{Cc}/u;

/**
 * ?next= 값 거르기(열린 리디렉트 막기). "/"로 시작하고 "//" · "/\"로 시작하지 않는 앱 안 경로만 받고, 아니면 /me.
 * 배열(?next=a&next=b) · 제어 문자가 든 값도 받지 않는다
 */
export function safeNext(value: string | string[] | undefined): string {
  if (typeof value !== "string") return DEFAULT_NEXT;
  if (!value.startsWith("/")) return DEFAULT_NEXT;
  if (value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_NEXT;
  if (CONTROL_CHARS.test(value)) return DEFAULT_NEXT;
  return value;
}

/** 로그인 · 가입 화면 주소. next는 늘 붙여서 두 화면을 오가도 돌아갈 곳이 남는다 */
export function authHref(
  path: "/login" | "/signup",
  { next, email, joined }: { next: string; email?: string; joined?: boolean },
): string {
  const query = new URLSearchParams();
  if (email) query.set("email", email);
  if (joined) query.set("joined", "1");
  query.set("next", next);
  return `${path}?${query}`;
}
