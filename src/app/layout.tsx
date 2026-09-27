import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ReplayButton } from "@/features/home/ReplayButton";
import { NamesProvider } from "@/features/names/NamesProvider";
import { loadNameTable } from "@/features/names/server";
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

export const viewport: Viewport = {
  themeColor: "#ffffff",
  // 아이폰 하단 홈 인디케이터 영역을 env(safe-area-inset-*)로 받으려면 cover여야 한다
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  // 중 · 일 · 스페인어 화면일 때만 그 언어의 권역 · 도시 · 장소 이름표를 싣는다(features/names)
  const names = await loadNameTable(locale);

  return (
    <html lang={locale} className="h-full antialiased">
      {/* break-keep: 한글이 음절 단위로 끊기지 않고 단어 단위로 줄바꿈되게 한다.
          중 · 일은 띄어쓰기가 없어 keep-all이면 줄이 안 바뀌고 넘치므로 기본 줄바꿈을 쓴다 */}
      <body
        className={`min-h-full bg-fill-weak font-sans text-fg ${locale === "zh" || locale === "ja" ? "" : "break-keep"}`}
      >
        <NextIntlClientProvider>
          <NamesProvider names={names}>
            <Providers>{children}</Providers>
          </NamesProvider>
          <ReplayButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
