/**
 * 공용 테스트 계정(로그인 화면 「테스트 계정으로 로그인」). 서버 환경변수 DEMO_LOGIN_EMAIL · DEMO_LOGIN_PASSWORD에서만 읽는다.
 * 비밀번호를 브라우저 코드 · 공개 리포에 싣지 않으려고 로그인은 Route Handler(app/api/auth/demo)가 대신 한다(AGENTS.md 3).
 * 둘 중 하나라도 없으면 null이고, 로그인 화면은 버튼을 숨긴다
 */
export function demoAccount(): { email: string; password: string } | null {
  const email = process.env.DEMO_LOGIN_EMAIL;
  const password = process.env.DEMO_LOGIN_PASSWORD;
  return email && password ? { email, password } : null;
}
