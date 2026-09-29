/**
 * 로고 시작 화면을 브라우저 세션당 한 번만 보이게 하는 쿠키.
 * 홈(서버)이 읽고 Splash(클라이언트)가 쓴다. "use client" 파일의 값은 서버에서 읽을 수 없어 따로 둔다
 */
export const SPLASH_COOKIE = "tn_splash";
