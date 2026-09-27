import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/locales";
import type { ThemeSlug } from "@/features/recommend/themes";
import { THEME_WORK, tmdbImage } from "@/features/recommend/works";
import { DatalabSection } from "./DatalabSection";
import { THEME_INFO } from "./data/info";
import { SECONDARY_LINK_CLASS } from "./place-meta";

/** 작품 제목이 messages(Theme.info.<slug>.workTitle)에 있는 테마 = TMDB 작품이 있는 테마 */
type WorkSlug = Exclude<ThemeSlug, "rescene-route">;

// 여행 정보 탭. 작품 카드(TMDB 포스터) · 축제 상자 · 데이터랩으로 본 지역(백엔드 TFI · 체류시간) · 외부 링크 버튼.
// RESCENE는 이 탭이 팬소통 채널이다(PoC channel 탭): 안내 한 줄 · 전체 일정 보기 · 공식 채널 링크를 먼저 보인다.
// 축제 · 링크 · 일정 주소는 data/info.ts(PoC에서 옮김)
export async function InfoTab({ slug }: { slug: ThemeSlug }) {
  const t = await getTranslations("Theme.info");
  const common = await getTranslations("Common");
  const locale = (await getLocale()) as AppLocale;
  const lang = locale === "ko" ? "ko" : "en";
  const work = THEME_WORK[slug];
  const info = THEME_INFO[slug];

  const linkList = (
    <ul className="mt-3 grid grid-cols-2 gap-2">
      {info.links.map((link) => (
        <li key={link.href + link.label.en}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${SECONDARY_LINK_CLASS} w-full text-center`}
          >
            {link.label[lang]}
            <ExternalLink size={16} className="shrink-0" aria-hidden />
            <span className="sr-only">{t("newWindow")}</span>
          </a>
        </li>
      ))}
    </ul>
  );

  if (info.fanChannel) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-6">
        <section aria-labelledby="fan-heading">
          <h2 id="fan-heading" className="px-1 text-title font-bold">
            {t("fanHeading")}
          </h2>
          <p className="mt-2 px-1 text-body text-fg-muted">{t("fanBody")}</p>
          {linkList}
          <a
            href={info.fanChannel.schedule}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-label font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
          >
            {t("fullSchedule")}
            <ExternalLink size={16} className="shrink-0" aria-hidden />
            <span className="sr-only">{t("newWindow")}</span>
          </a>
        </section>
        <DatalabSection slug={slug} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-6">
      <h2 className="px-1 text-title font-bold">{t("title")}</h2>

      {work && (
        <section aria-labelledby="work-title">
          <div className="flex gap-4 rounded-card p-4 ring-1 ring-line">
            <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-fill">
              <Image
                src={tmdbImage(work.poster[locale], "w500")}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-caption font-semibold text-primary">
                {t("workKicker")}
              </p>
              <h3 id="work-title" className="mt-1 text-body-lg font-semibold">
                {t(`${slug as WorkSlug}.workTitle`)}
              </h3>
            </div>
          </div>
          <p className="mt-2 px-1 text-micro text-fg-subtle">
            {common("tmdbCredit")}
          </p>
        </section>
      )}

      {info.festival && (
        <section className="rounded-card bg-primary-weak p-5">
          <p className="text-caption font-semibold text-primary-strong">
            {info.festival.label[lang]}
          </p>
          <h3 className="mt-1 text-body-lg font-bold">
            {info.festival.title[lang]}
          </h3>
          <p className="mt-2 text-body text-fg-muted">
            {info.festival.body[lang]}
          </p>
        </section>
      )}

      <DatalabSection slug={slug} />

      <section aria-labelledby="links-heading">
        <h3 id="links-heading" className="px-1 text-headline font-bold">
          {t("linksHeading")}
        </h3>
        {linkList}
      </section>
    </div>
  );
}
