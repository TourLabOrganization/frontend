"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cityName, PLACE_COUNT_BY_CITY, REGIONS, regionName } from "./data";
import { plannerHref } from "./query";

// 여행 정보 탭의 「선택한 지역」. 도시를 고르면 ?city=를 바꿔 그 도시의 관문을 보인다(여행 정보 탭 그대로).
// 도시는 권역별 optgroup으로 묶고, 장소가 있는 도시만 넣는다
export function InfoCitySelect({ city }: { city: string | null }) {
  const t = useTranslations("Planner.info");
  const locale = useLocale();
  const router = useRouter();

  return (
    <div className="relative mt-2">
      <select
        id="planner-info-city"
        value={city ?? ""}
        onChange={(e) =>
          router.replace(
            plannerHref({ city: e.target.value || null, tab: "info" }),
            { scroll: false },
          )
        }
        className="h-12 w-full appearance-none rounded-xl bg-surface pr-11 pl-4 text-body-lg font-semibold text-fg ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
      >
        <option value="">{t("selectPlaceholder")}</option>
        {REGIONS.map((r) => (
          <optgroup key={r.key} label={regionName(r, locale)}>
            {r.cities
              .filter((c) => PLACE_COUNT_BY_CITY.has(c))
              .map((c) => (
                <option key={c} value={c}>
                  {cityName(c, locale)}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown
        size={20}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-fg-muted"
      />
    </div>
  );
}
