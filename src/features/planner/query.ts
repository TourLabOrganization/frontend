import { isPlannerCity, type Scope } from "./data";
import { isRegionKey, type RegionKey } from "./regions";

// 투어 플래너 주소 규칙.
//   /planner?city=<도시 한국어 이름>&region=<권역 key>&tab=map|course|info&place=<장소 id>
//   - city가 없거나 장소가 없는 도시면 전국 보기
//   - region은 전국 보기에서만 쓴다(도시 보기면 무시). 없거나 모르는 값이면 권역을 고르지 않은 전국
//   - tab이 없거나 모르는 값이면 map
//   - place는 지도 탭에서 그 장소 시트를 연 채로 시작한다

const PLANNER_TABS = ["map", "course", "info"] as const;
export type PlannerTab = (typeof PLANNER_TABS)[number];

export function parsePlannerTab(value: unknown): PlannerTab {
  return (PLANNER_TABS as readonly unknown[]).includes(value)
    ? (value as PlannerTab)
    : "map";
}

export function parseScope(city: unknown, region: unknown): Scope {
  if (isPlannerCity(city)) return { kind: "city", city };
  return { kind: "nation", region: isRegionKey(region) ? region : null };
}

export type PlannerHrefOptions = {
  city?: string | null;
  region?: RegionKey | null;
  tab?: PlannerTab;
  place?: string;
};

/** 플래너 주소. 기본값(전국 · 지도 탭)은 주소에 적지 않는다 */
export function plannerHref({
  city,
  region,
  tab,
  place,
}: PlannerHrefOptions = {}): string {
  const qs = new URLSearchParams();
  if (city) qs.set("city", city);
  else if (region) qs.set("region", region);
  if (tab && tab !== "map") qs.set("tab", tab);
  if (place) qs.set("place", place);
  const s = qs.toString();
  return s ? `/planner?${s}` : "/planner";
}

/** 범위를 그대로 두고 탭만 바꾼 주소 */
export function scopeHref(scope: Scope, tab: PlannerTab, place?: string) {
  return plannerHref(
    scope.kind === "city"
      ? { city: scope.city, tab, place }
      : { region: scope.region, tab, place },
  );
}
