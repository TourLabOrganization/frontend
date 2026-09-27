// 지원 언어. 추가할 때는 messages/<언어>.json도 같이 만든다 (docs/i18n.md)
export const locales = ["ko", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "ko";

// 사용자가 고른 언어를 담는 쿠키 이름
export const LOCALE_COOKIE = "locale";

/**
 * 언어 메뉴에 보이는 언어 이름(그 언어로 쓴 이름이라 화면 언어와 상관없이 같다).
 * 목표 5개 언어를 모두 적어 두고, 메뉴에는 locales에 있는 언어만 보인다(docs/i18n.md)
 */
export const LOCALE_NAMES: Readonly<Record<string, string>> = {
  ko: "한국어",
  en: "English",
  zh: "简体中文",
  ja: "日本語",
  es: "Español",
};
