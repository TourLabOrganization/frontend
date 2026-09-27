// 테스트(Vitest)가 @ 경로를 풀지 않아 상대 경로로 가져온다
import { krUnits } from "../../lib/kr-units";
import type { PlannerPlace } from "./data";

// 투어 플래너 지도 탭의 배지 필터 · 배지 문구. 데이터 파일을 import하지 않는다.
// 데이터랩 인기(pop)는 한국관광 데이터랩 인기관광지 순위(popRank)가 있는 곳(173곳),
// 유네스코(un) · 한국관광 100선(k100) · 열린관광지(bf)는 장소의 배지 값,
// 관광특구 · 관광단지(zone)는 지정구역 문구(vz, data-server zone)가 있는 곳 전부다(관광특구 · 관광단지 · 지정관광지 210곳).

export const BADGE_KEYS = ["pop", "un", "k100", "bf", "zone"] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

export function hasBadge(
  place: Pick<PlannerPlace, "un" | "k100" | "bf" | "vz" | "popRank">,
  badge: BadgeKey,
): boolean {
  switch (badge) {
    case "pop":
      return place.popRank !== undefined;
    case "un":
      return place.un;
    case "k100":
      return place.k100;
    case "bf":
      return place.bf;
    case "zone":
      return Boolean(place.vz);
  }
}

export type Zone = {
  /** 종류. 데이터 문구 그대로(관광특구 · 관광단지 · 관광지) */
  kind: string;
  /** 지정 연도. 데이터가 「0000」이면 모른다는 뜻이라 null */
  year: string | null;
};

/** 지정구역 문구(「경주시 관광단지 (2008 지정)」) → 종류 · 연도. 꼴이 다르면 null */
export function parseZone(vz: string): Zone | null {
  const m = vz.match(/(관광특구|관광단지|관광지) \((\d{4}) 지정\)$/);
  if (!m) return null;
  return { kind: m[1], year: m[2] === "0000" ? null : m[2] };
}

/**
 * 장소 배지 문구: 종류와 지정 연도(「관광단지 (2008 지정)」, 연도를 모르면 「관광단지」).
 * 외국어는 kr-units의 관광특구 · 관광단지 · 관광지 · 지정 치환(「Tourist Complex (designated 2008)」)
 */
export function zoneLabel(vz: string, locale: string): string {
  const zone = parseZone(vz);
  if (!zone) return krUnits(vz, locale);
  const kind = krUnits(zone.kind, locale);
  return zone.year ? `${kind} (${krUnits(`${zone.year} 지정`, locale)})` : kind;
}
