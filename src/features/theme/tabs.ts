// 테마 화면의 하단 탭과 주소 규칙.
//   /themes/[themeId]?tab=map|course|film|stamp|info  (없거나 모르는 값이면 map)
//   코스 탭은 ?a=(조건) · ?plan=(3안)을 쓰고, 탭을 바꿔도 두 값은 주소에 남긴다.
//   지도 탭은 ?place={id}로 들어오면 그 장소 시트를 연 채로 시작한다.

export const TAB_IDS = ["map", "course", "film", "stamp", "info"] as const;
export type TabId = (typeof TAB_IDS)[number];

export function parseTab(value: unknown): TabId {
  return (TAB_IDS as readonly unknown[]).includes(value)
    ? (value as TabId)
    : "map";
}

export type ThemeQuery = {
  a?: string;
  plan?: string;
};

/** 테마 화면 주소. a · plan은 그대로 두고 탭(과 장소 · 조각)만 바꾼다 */
export function themeHref(
  slug: string,
  query: ThemeQuery,
  tab: TabId,
  extra: { place?: string; hash?: string } = {},
): string {
  const qs = new URLSearchParams();
  qs.set("tab", tab);
  if (query.a) qs.set("a", query.a);
  if (query.plan) qs.set("plan", query.plan);
  if (extra.place) qs.set("place", extra.place);
  const hash = extra.hash ? `#${extra.hash}` : "";
  return `/themes/${slug}?${qs.toString()}${hash}`;
}
