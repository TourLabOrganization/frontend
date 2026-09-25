import type { Metadata, Viewport } from "next";
import { Archivo, Gowun_Dodum } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "./providers";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

// 한글 글리프는 unicode-range로 나뉘어 필요한 조각만 내려받는다. subsets는 미리 받을 범위다
const gowunDodum = Gowun_Dodum({
  variable: "--font-gowun-dodum",
  weight: "400",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: "#f2ece0",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${archivo.variable} ${gowunDodum.variable} h-full antialiased`}
    >
      {/* break-keep: 한글이 음절 단위로 끊기지 않고 단어 단위로 줄바꿈되게 한다 */}
      <body className="flex min-h-full flex-col bg-cream font-sans break-keep text-ink">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
