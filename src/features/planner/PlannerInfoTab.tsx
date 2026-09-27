import { ExternalLink } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonClassName } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { PLANNER_LINKS } from "./data/info";
import { InfoCitySelect } from "./InfoCitySelect";
import { CITY_HUBS } from "./regions";

const MODE_KEYS = ["ktx", "srt", "bus", "air", "ship", "metro"] as const;
type ModeKey = (typeof MODE_KEYS)[number];
const isModeKey = (m: string): m is ModeKey =>
  (MODE_KEYS as readonly string[]).includes(m);

// 투어 플래너 여행 정보 탭. 선택한 지역(도시)의 광역 관문 · 이동 요령 · 지역별 관광 안내 링크.
// 관문은 Tour Planner.dc.html REGION_HUB(data/regions.json hubs), 이동 요령 문단은 messages(Planner.info.tips), 링크는 data/info.ts
export async function PlannerInfoTab({ city }: { city: string | null }) {
  const t = await getTranslations("Planner.info");
  const locale = await getLocale();
  // 관문 이름은 한국어 · 영어만 있다. 중 · 일 · 스페인어 화면은 영어 이름
  const lang = locale === "ko" ? "ko" : "en";
  const hub = city ? CITY_HUBS[city] : undefined;

  // 관문 이름들: 대표(역 · 공항 · 터미널) · 버스터미널 · 공항 · 여객터미널. 같은 이름은 한 번만
  const hubNames = hub
    ? [
        lang === "ko" ? hub.ko : hub.en || hub.ko,
        ...(
          [
            ["busKo", "busEn"],
            ["airKo", "airEn"],
            ["shipKo", "shipEn"],
          ] as const
        ).map(([ko, en]) => {
          const h = hub as Record<string, unknown>;
          const k = typeof h[ko] === "string" ? (h[ko] as string) : "";
          const e = typeof h[en] === "string" ? (h[en] as string) : "";
          return lang === "ko" ? k : e || k;
        }),
      ].filter((name, i, all) => name && all.indexOf(name) === i)
    : [];
  const modes = hub ? hub.modes.filter(isModeKey) : [];

  return (
    <div className="flex flex-col gap-6 px-5 pt-6">
      <h2 className="px-1 text-title font-bold">{t("title")}</h2>

      <section className="rounded-card bg-fill p-5">
        <label
          htmlFor="planner-info-city"
          className="text-label font-semibold text-fg-muted"
        >
          {t("selectLabel")}
        </label>
        <InfoCitySelect city={city} />

        <div aria-live="polite" className="mt-4">
          {!city ? (
            <p className="text-label text-fg-muted">{t("hubPick")}</p>
          ) : !hub ? (
            <p className="text-label text-fg-muted">{t("hubNone")}</p>
          ) : (
            <>
              <h3 className="text-caption font-semibold text-fg-muted">
                {t("hubHeading")}
              </h3>
              <ul className="mt-1">
                {hubNames.map((name) => (
                  <li key={name} className="text-body font-semibold">
                    {name}
                  </li>
                ))}
              </ul>
              {modes.length > 0 && (
                <ul
                  aria-label={t("modesLabel")}
                  className="mt-3 flex flex-wrap gap-1.5"
                >
                  {modes.map((m) => (
                    <li key={m}>
                      <Chip tone="primary">{t(`modes.${m}`)}</Chip>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="planner-tips-heading">
        <h3 id="planner-tips-heading" className="px-1 text-headline font-bold">
          {t("tipsHeading")}
        </h3>
        <p className="mt-2 px-1 text-body text-fg-muted">{t("tips")}</p>
      </section>

      <section aria-labelledby="planner-links-heading">
        <h3 id="planner-links-heading" className="px-1 text-headline font-bold">
          {t("linksHeading")}
        </h3>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {PLANNER_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${buttonClassName({ variant: "secondary", size: "md" })} w-full text-center`}
              >
                {link.label[locale]}
                <ExternalLink size={16} className="shrink-0" aria-hidden />
                <span className="sr-only">{t("newWindow")}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
