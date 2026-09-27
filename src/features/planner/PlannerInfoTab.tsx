import { ExternalLink } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonClassName } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import type { CityTour } from "@/features/home/citytour";
import toursData from "@/features/home/data/citytour.json";
import { loadNameTable } from "@/features/names/server";
import { PLANNER_LINKS } from "./data/info";
import ticData from "./data/tic.json";
import { InfoCenters } from "./InfoCenters";
import { InfoCitySelect } from "./InfoCitySelect";
import { InfoCityTours } from "./InfoCityTours";
import { CITY_HUBS, cityName } from "./regions";
import { RoutingHowTo } from "./RoutingHowTo";
import type { InfoCenter } from "./tic";

const TOURS = toursData as CityTour[];
const CENTERS = ticData as InfoCenter[];
/** 도시를 고르지 않았을 때 시티투어 · 관광안내소에 보이는 도시(PoC key 기본값) */
const DEFAULT_CITY = "서울";

const MODE_KEYS = ["ktx", "srt", "bus", "air", "ship", "metro"] as const;
type ModeKey = (typeof MODE_KEYS)[number];
const isModeKey = (m: string): m is ModeKey =>
  (MODE_KEYS as readonly string[]).includes(m);

// 투어 플래너 여행 정보 탭. 선택한 지역(도시)의 광역 관문 · 시티투어 · 관광안내소 · 이동 요령 · 지역별 관광 안내 링크.
// 관문은 Tour Planner.dc.html REGION_HUB(data/regions.json hubs), 이동 요령은 코스 탭과 같은 접이식 6단계(RoutingHowTo), 링크는 data/info.ts.
// 시티투어(홈과 같은 카드) · 관광안내소(data/tic.json)는 PoC처럼 도시를 고르지 않으면 서울을 「기본 지역」으로 보인다.
// 두 데이터는 서버에서 그 도시 것만 골라 넘긴다(클라이언트 번들에 전국 데이터를 싣지 않는다)
export async function PlannerInfoTab({ city }: { city: string | null }) {
  const t = await getTranslations("Planner.info");
  const locale = await getLocale();
  const names = await loadNameTable(locale);
  const infoCity = city ?? DEFAULT_CITY;
  const infoCityLabel = cityName(infoCity, locale, names);
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

      <InfoCityTours
        key={`ct|${infoCity}`}
        cityLabel={infoCityLabel}
        isDefault={city === null}
        tours={TOURS.filter((tour) => tour.region === infoCity)}
      />

      <InfoCenters
        key={`tic|${infoCity}`}
        city={infoCity}
        cityLabel={infoCityLabel}
        isDefault={city === null}
        centers={CENTERS.filter((c) => c.city === infoCity)}
      />

      <RoutingHowTo />

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
