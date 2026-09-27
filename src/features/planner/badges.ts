import type { PlannerPlace } from "./data";

// 투어 플래너 지도 탭의 배지 필터. 데이터 파일을 import하지 않는다.
// 유네스코(un) · 한국관광 100선(k100) · 열린관광지(bf)는 장소의 배지 값, 관광특구(zone)는 지정구역 문구(vz)에 「관광특구」가 있는 곳이다.
// (vz에는 관광단지 · 지정관광지도 있다. PoC 목록 칩이 「관광특구」라고 붙이는 곳만 고른다)

export const BADGE_KEYS = ["un", "k100", "bf", "zone"] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

export function hasBadge(
  place: Pick<PlannerPlace, "un" | "k100" | "bf" | "vz">,
  badge: BadgeKey,
): boolean {
  switch (badge) {
    case "un":
      return place.un;
    case "k100":
      return place.k100;
    case "bf":
      return place.bf;
    case "zone":
      return place.vz?.includes("관광특구") ?? false;
  }
}
