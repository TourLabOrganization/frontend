// 지원 언어. 추가할 때는 messages/<언어>.json도 같이 만든다 (docs/i18n.md)
export const locales = ["ko", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "ko";

// 사용자가 고른 언어를 담는 쿠키 이름
export const LOCALE_COOKIE = "locale";
