import { Info, Map as MapIcon, Route, X } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/ui/LocaleSwitch";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TabBar } from "@/components/ui/TabBar";
import { TopBar } from "@/components/ui/TopBar";
import { CityPicker } from "@/features/planner/CityPicker";
import { CourseCountBadge } from "@/features/planner/CourseCountBadge";
import { placesInScope } from "@/features/planner/data";
import { PlannerCourseTab } from "@/features/planner/PlannerCourseTab";
import { PlannerInfoTab } from "@/features/planner/PlannerInfoTab";
import { PlannerMapTab } from "@/features/planner/PlannerMapTab";
import {
  parsePlannerTab,
  parseScope,
  plannerHref,
  scopeHref,
} from "@/features/planner/query";
import {
  cityName,
  FEATURED_CITIES,
  findRegion,
  regionName,
} from "@/features/planner/regions";
import { loadNameTable } from "@/features/names/server";

// 투어 플래너. 지역 탭(전국 · 서울 · 부산 · 제주 · 도시 ▾)으로 범위를 고르고, 하단 탭 3개(지도 · 코스 · 여행 정보)를 ?tab=으로 고른다.
// 주소 규칙은 features/planner/query.ts 머리 주석에 있다. 장소 · 코스 담기는 클라이언트 컴포넌트가 그린다
export default async function PlannerPage({
  searchParams,
}: PageProps<"/planner">) {
  const query = await searchParams;
  const tab = parsePlannerTab(query.tab);
  const scope = parseScope(query.city, query.region);
  const place = typeof query.place === "string" ? query.place : undefined;
  const planId = typeof query.plan === "string" ? query.plan : undefined;
  const t = await getTranslations("Planner");
  const locale = await getLocale();
  const names = await loadNameTable(locale);

  const city = scope.kind === "city" ? scope.city : null;
  const featured = (FEATURED_CITIES as readonly string[]).includes(city ?? "");
  const region =
    scope.kind === "nation" && scope.region ? findRegion(scope.region) : null;

  function renderTab() {
    switch (tab) {
      case "course":
        return <PlannerCourseTab scope={scope} planId={planId} />;
      case "info":
        return <PlannerInfoTab city={city} />;
      case "map":
        return (
          <PlannerMapTab
            key={`${city ?? ""}|${region?.key ?? ""}|${place ?? ""}`}
            scope={scope}
            initialPlace={place}
          />
        );
    }
  }

  return (
    <Screen>
      <TopBar title={t("title")} backHref="/" right={<LocaleSwitch />} />
      <div className="px-5 pt-1 pb-2">
        <SegmentedControl
          label={t("scopesLabel")}
          items={[
            {
              href: plannerHref({ tab }),
              label: t("nation"),
              selected: city === null,
            },
            ...FEATURED_CITIES.map((c) => ({
              href: plannerHref({ city: c, tab }),
              label: cityName(c, locale, names),
              selected: city === c,
            })),
          ]}
        >
          <CityPicker
            city={city}
            selected={city !== null && !featured}
            tab={tab}
          />
        </SegmentedControl>
        {region && tab === "map" && (
          <div className="mt-3 flex">
            <Link
              href={scopeHref({ kind: "nation", region: null }, tab)}
              replace
              scroll={false}
              aria-label={t("regionChipClear", {
                region: regionName(region, locale, names),
                count: placesInScope(scope).length,
              })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary-weak pr-2.5 pl-4 text-label font-semibold text-primary-strong tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none"
            >
              {t("regionChip", {
                region: regionName(region, locale, names),
                count: placesInScope(scope).length,
              })}
              <X size={20} aria-hidden />
            </Link>
          </div>
        )}
      </div>
      <main className="flex flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {renderTab()}
      </main>
      <TabBar
        label={t("tabsLabel")}
        current={tab}
        items={[
          {
            id: "map",
            icon: MapIcon,
            href: scopeHref(scope, "map"),
            label: t("tabs.map"),
          },
          {
            id: "course",
            icon: Route,
            href: scopeHref(scope, "course"),
            label: t("tabs.course"),
            badge: <CourseCountBadge />,
          },
          {
            id: "info",
            icon: Info,
            href: scopeHref(scope, "info"),
            label: t("tabs.info"),
          },
        ]}
      />
    </Screen>
  );
}
