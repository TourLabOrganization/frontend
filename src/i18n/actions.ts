"use server";

import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { LOCALE_COOKIE, locales } from "./locales";

// 화면 언어 바꾸기. 서버 함수에서 쿠키를 바꾸면 Next.js가 지금 화면을 새 언어로 다시 그린다
export async function setLocale(locale: string) {
  if (!hasLocale(locales, locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
