// 화면 모드(머리줄 「화면 모드」 메뉴). 기본(밝은 화면) · 블랙 · 포레스트 · 선셋 코랄(대표가 후보 5안 중 ④ · ⑤를 고름, 2026-09-29).
// 고른 모드는 쿠키에 두어 서버가 <html data-mode>를 처음부터 그리게 한다(깜빡임 없음). 색은 app/globals.css의 :root[data-mode=…] 토큰

export const DISPLAY_MODES = ["light", "dark", "forest", "sunset"] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const DISPLAY_MODE_COOKIE = "display_mode";

export function isDisplayMode(value: unknown): value is DisplayMode {
  return (DISPLAY_MODES as readonly unknown[]).includes(value);
}

/** 모드별 브라우저 머리 색(viewport themeColor). 페이지 바탕(fill-weak)과 같게 */
export const THEME_COLOR: Readonly<Record<DisplayMode, string>> = {
  light: "#ffffff",
  dark: "#0b0c0e",
  forest: "#edf4ee",
  sunset: "#fff3ec",
};

/** 브라우저에서 모드를 바꾼다: <html data-mode>를 바로 바꾸고 쿠키(1년)에 적는다 */
export function applyDisplayMode(mode: DisplayMode): void {
  document.documentElement.dataset.mode = mode;
  document.cookie = `${DISPLAY_MODE_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[mode]);
}
