import { useMemo } from "react";
import { readLocal, useLocalValue, writeLocal } from "../../lib/local-store";
import type { Scope } from "./data";
import { isKtoId, type KtoPlace } from "./kto-place";

// 브라우저가 기억해 둔 신규 관광지(kto:, kto-place.ts). 홈 「지금 인기 관광지」에서 열거나 링크로 받은 곳을 여기에 두면
// 지도 · 목록 · 장소 시트 · 코스가 앱 장소(places.json)처럼 쓴다. 코스는 장소 id만 저장하므로(course-store.ts),
// 담은 신규 관광지를 다시 그리려면 장소 자체를 이곳에 남겨 둔다. 저장소가 막힌 브라우저에서는 이번 화면에서만 쓴다.
// 장소 데이터(places.json)를 import하지 않는다(홈이 쓴다). 앱 장소와 함께 찾는 함수는 place-lookup.ts.
// 테스트(vitest)가 "@/" 경로를 풀지 못해 상대 경로로 import한다

/** 신규 관광지 목록. KtoPlace[] JSON(최근에 연 곳이 뒤) */
export const EXTRA_PLACES_KEY = "tn.extraPlaces";
/** 기억해 두는 최대 수. 넘으면 오래된 곳부터 지운다(코스에 담은 곳은 남긴다) */
export const MAX_EXTRA_PLACES = 200;

// 저장소가 막혔을 때 이번 화면에서만 쓰는 목록
const memory = new Map<string, KtoPlace>();

const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

function isKtoPlace(v: unknown): v is KtoPlace {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    isKtoId(p.id) &&
    typeof p.ko === "string" &&
    typeof p.en === "string" &&
    typeof p.locKo === "string" &&
    typeof p.cat === "string" &&
    typeof p.macro === "string" &&
    typeof p.hrs === "string" &&
    isNum(p.lat) &&
    isNum(p.lng) &&
    isNum(p.min)
  );
}

/** 저장 문자열 → 신규 관광지 목록(모양이 틀린 항목은 버린다) */
export function parseExtraPlaces(raw: string | null): KtoPlace[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter(isKtoPlace) : [];
  } catch {
    return [];
  }
}

let cache: { raw: string | null; byId: Map<string, KtoPlace> } | null = null;

function extraMap(raw: string | null): Map<string, KtoPlace> {
  if (cache?.raw === raw) return cache.byId;
  const byId = new Map(parseExtraPlaces(raw).map((p) => [p.id, p]));
  for (const [id, p] of memory) if (!byId.has(id)) byId.set(id, p);
  cache = { raw, byId };
  return byId;
}

/** 기억해 둔 신규 관광지 한 곳 */
export function extraPlace(id: string): KtoPlace | undefined {
  if (!isKtoId(id)) return undefined;
  return extraMap(readLocal(EXTRA_PLACES_KEY)).get(id) ?? memory.get(id);
}

/**
 * 신규 관광지를 기억한다(같은 id는 새 값으로 바꾸고 맨 뒤로). keep에 든 id(코스에 담은 곳)는 수를 넘어도 지우지 않는다
 */
export function rememberPlace(
  place: KtoPlace,
  keep: ReadonlySet<string> = new Set(),
): void {
  if (!isKtoPlace(place)) return;
  memory.set(place.id, place);
  const list = parseExtraPlaces(readLocal(EXTRA_PLACES_KEY)).filter(
    (p) => p.id !== place.id,
  );
  list.push(place);
  while (list.length > MAX_EXTRA_PLACES) {
    const i = list.findIndex((p) => !keep.has(p.id));
    if (i < 0 || list[i].id === place.id) break;
    list.splice(i, 1);
  }
  const raw = JSON.stringify(list);
  if (!writeLocal(EXTRA_PLACES_KEY, raw)) cache = null;
}

/** 기억해 둔 신규 관광지 전체(바뀌면 다시 그린다). 서버 렌더 · 하이드레이션 중에는 빈 목록 */
export function useExtraPlaces(): readonly KtoPlace[] {
  const raw = useLocalValue(EXTRA_PLACES_KEY);
  return useMemo(() => [...extraMap(raw).values()], [raw]);
}

/** 범위 안의 신규 관광지(도시는 pickCity, 권역은 macro) */
export function extraInScope(
  extras: readonly KtoPlace[],
  scope: Scope,
): KtoPlace[] {
  if (scope.kind === "city")
    return extras.filter((p) => (p.pickCity ?? p.locKo) === scope.city);
  return scope.region
    ? extras.filter((p) => p.macro === scope.region)
    : [...extras];
}
