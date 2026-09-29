import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ReplayButton } from "@/features/home/ReplayButton";
import { NamesProvider } from "@/features/names/NamesProvider";
import { loadNameTable } from "@/features/names/server";
import { TourApiProvider } from "@/components/ui/tour-api-context";
import {
  DISPLAY_MODE_COOKIE,
  type DisplayMode,
  isDisplayMode,
  THEME_COLOR,
} from "@/lib/display-mode";
import { Providers } from "./providers";
// 한글 글리프를 unicode-range로 나눠 둔 동적 서브셋. 화면에 쓰인 글자 조각만 내려받는다
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

/** 쿠키의 화면 모드(없거나 모르는 값이면 기본) */
async function displayMode(): Promise<DisplayMode> {
  const saved = (await cookies()).get(DISPLAY_MODE_COOKIE)?.value;
  return isDisplayMode(saved) ? saved : "light";
}

export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: THEME_COLOR[await displayMode()],
    // 아이폰 하단 홈 인디케이터 영역을 env(safe-area-inset-*)로 받으려면 cover여야 한다
    viewportFit: "cover",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  // 중 · 일 · 스페인어 화면일 때만 그 언어의 권역 · 도시 · 장소 이름표를 싣는다(features/names)
  const names = await loadNameTable(locale);
  // 공공데이터포털 키(서버 전용)가 있는지만 내려 준다. 없으면 장소 시트의 한국관광공사 칸이 Route Handler를 부르지 않는다(lib/tour-api.ts)
  const tourApi = Boolean(process.env.DATA_GO_KR_KEY?.trim());
  // 화면 모드(기본 · 블랙)는 쿠키로 처음부터 그린다(globals.css :root[data-mode])
  const mode = await displayMode();

  return (
    <html lang={locale} data-mode={mode} className="h-full antialiased">
      {/* break-keep: 한글이 음절 단위로 끊기지 않고 단어 단위로 줄바꿈되게 한다.
          중 · 일은 띄어쓰기가 없어 keep-all이면 줄이 안 바뀌고 넘치므로 기본 줄바꿈을 쓴다 */}
      <body
        className={`min-h-full bg-fill-weak font-sans text-fg ${locale === "zh" || locale === "ja" ? "" : "break-keep"}`}
      >
        <NextIntlClientProvider>
          <NamesProvider names={names}>
            <TourApiProvider enabled={tourApi}>
              <Providers>{children}</Providers>
            </TourApiProvider>
          </NamesProvider>
          <ReplayButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
