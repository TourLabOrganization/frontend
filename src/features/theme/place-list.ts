import type { Place } from "../course/places";
import { matchesQuery } from "../../lib/text-search";

// 테마 화면 지도 탭 목록 · 영화 탭 카드의 가공 규칙. 목업(9/27 standalone 테마 화면 5개)과 PoC 테마 파일의 규칙을 옮긴 순수 함수다.

/** 테마 화면의 도시(칩). data/cities.json, PoC DATA의 도시 이름 · center */
export type ThemeCity = { ko: string; en: string; lat: number; lng: number };

type LatLng = { lat: number; lng: number };

/** 두 좌표의 대원거리(km). 목업 hav()와 같은 식(지구 반지름 6371km) */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * 목록 행의 거리(km, 소수 한 자리 문자열). 목업 규칙: 한 도시 보기에서 도시 center부터 장소까지 직선거리.
 * 여러 도시가 섞인 보기(RESCENE 전국)에서는 거리 대신 도시 이름을 보이므로 null
 */
export function distanceLabel(
  place: LatLng,
  city: ThemeCity | null,
): string | null {
  return city ? haversineKm(city, place).toFixed(1) : null;
}

/**
 * 지금 보이는 도시. 도시가 하나뿐인 테마는 늘 그 도시, 여러 도시 테마는 고른 도시(없으면 전국 = null)
 */
export function scopeCity(
  cities: readonly ThemeCity[],
  picked: string | null,
): ThemeCity | null {
  if (cities.length === 1) return cities[0];
  return cities.find((c) => c.ko === picked) ?? null;
}

/** 고른 도시의 장소만. 전국(null)이면 모두 */
export function inCity(place: Pick<Place, "locKo">, city: string | null) {
  return city === null || place.locKo === city;
}

/**
 * 여러 도시 테마(RESCENE)의 전국 목록 순서. 도시 칩 순서(data/cities.json — 경주 · 거제 · 수원 · 정선 · 대전 · 충주 · 동해, 장소 번호 순)대로 묶고,
 * 칩에 없는 도시는 원래 순서대로 뒤에 둔다. 같은 도시 안의 순서(장소 번호)는 그대로다
 */
export function orderByCities<T extends Pick<Place, "locKo">>(
  places: readonly T[],
  cities: readonly Pick<ThemeCity, "ko">[],
): T[] {
  const rank = (p: T) => {
    const i = cities.findIndex((c) => c.ko === p.locKo);
    return i === -1 ? cities.length : i;
  };
  // Array.prototype.sort는 안정 정렬이라 같은 순위끼리는 원래 순서가 유지된다
  return [...places].sort((a, b) => rank(a) - rank(b));
}

/** 목록 순서대로 도시별 장소 수. 「경주 · 7개 장소」 묶음 머리에 쓴다 */
export function cityGroups(
  places: readonly Pick<Place, "locKo">[],
): { city: string; count: number }[] {
  const groups: { city: string; count: number }[] = [];
  for (const p of places) {
    const last = groups.at(-1);
    if (last && last.city === p.locKo) last.count += 1;
    else groups.push({ city: p.locKo, count: 1 });
  }
  return groups;
}

// ── 영화 · 영상 탭 ───────────────────────────────────────────────────

/** 장면순 · 역순(영화 · 드라마), 인기순 · 최신순(RESCENE 영상) */
export type SceneSort = "asc" | "desc" | "popular" | "latest";

/** 조회수 · 게시일을 가진 카드(RESCENE 영상). 영화 · 드라마 카드에는 없다 */
function viewsOf(card: object): number | undefined {
  return "views" in card && typeof card.views === "number"
    ? card.views
    : undefined;
}
function dateOf(card: object): string {
  return "date" in card && typeof card.date === "string" ? card.date : "";
}

/**
 * 카드 정렬. 입력 순서가 장면순이다. 인기순은 조회수가 큰 순(조회수가 없는 영상은 뒤),
 * 최신순은 게시일(YYYY.MM.DD)이 늦은 순. 같은 값이면 입력 순서를 지킨다. 입력 배열은 바꾸지 않는다
 */
export function sortCards<T extends object>(
  cards: readonly T[],
  sort: SceneSort,
): T[] {
  const list = [...cards];
  switch (sort) {
    case "asc":
      return list;
    case "desc":
      return list.reverse();
    case "popular":
      return list.sort((a, b) => (viewsOf(b) ?? -1) - (viewsOf(a) ?? -1));
    case "latest":
      return list.sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  }
}

/** 장면 · 장소 검색. texts(장면 제목 · 장소 이름 등) 중 하나라도 검색어를 품으면 남긴다 */
export function searchCards<T extends { texts: readonly string[] }>(
  cards: readonly T[],
  query: string,
): T[] {
  return cards.filter((c) => matchesQuery(c.texts, query));
}

/** 인기순 칩을 둘 수 있는지. 조회수가 원본에 하나라도 있어야 한다 */
export function hasViews(cards: readonly object[]): boolean {
  return cards.some((c) => viewsOf(c) !== undefined);
}
