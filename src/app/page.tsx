import { useTranslations } from "next-intl";

// 자리표시 화면. 실제 홈은 디자인 확정 후 만든다.
export default function HomePage() {
  const t = useTranslations("Home");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 md:px-10 md:py-14">
      <header className="border-b-2 border-ink pb-4">
        <p className="text-sm font-bold tracking-[0.2em]">TOUR NAVIGATOR</p>
      </header>
      <section className="py-10 md:py-16">
        <h1 className="text-3xl leading-tight font-bold md:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-base md:text-lg">{t("description")}</p>
      </section>
    </main>
  );
}
