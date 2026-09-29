// 장소 시트 「함께 많이 가는 관광지 Top」 칸 (GET /api/tour/related?id=&locale=, 서버 전용).
// 한국관광공사 관광지별 연관 관광지(TarRlteTarService1). PoC shared.js getRelatedSpots와 같은 규칙:
//   검색어 후보(전체 이름 → 첫 단어 → 정규화한 앞 3글자) × 기준월(2 → 3 → 4개월 전)로 searchKeyword1, 없으면 그달 areaBasedList1.
//   결과를 관광지 이름(tAtsNm)으로 묶어 이름 점수가 가장 높은 한 곳의 연관 관광지를 rlteRank 순으로, 이름이 겹치거나 자기 자신이면 빼고 8개.
//   PoC 화면처럼 영화관 · 주차장 · 화장실은 빼고 보인다(d_rlte).
// 각 항목은 우리 장소(같은 이름 · 같은 도시)와 이어 placeId를 단다. 외국어 화면은 이어진 항목만,
// 그 언어 장소 이름(장소 시트와 같은 placeName 규칙)과 우리 분류 이름으로 보낸다(한국관광공사 분류 · 한국어 이름을 보내지 않는다).
import { loadNameTable } from "../features/names/server";
import { PLANNER_PLACES, type PlannerPlace } from "../features/planner/data";
import { cityName } from "../features/planner/regions";
import { isCategoryKey, placeName } from "../features/theme/place-meta";
import type { AppLocale } from "../i18n/locales";
import { hasHangul } from "./hangul";
import {
  TOUR_DAY_SECONDS,
  type TourRelated,
  type TourRelatedItem,
} from "./tour";
import {
  fetchTourItems,
  parseTourQuery,
  tourApiKey,
  tourApiUrl,
  type TourItem,
  tourJson,
  tourNotConfigured,
  type TourPlace,
  tourPlaceSigngu,
  tourUnavailable,
} from "./tour-api";
import { seoulDate } from "./weather";

/** 보이는 최대 수 (PoC 8) */
export const RELATED_LIMIT = 8;

/** 이름 비교용 정규화 (PoC nz: '/부제' · 괄호 · 공백 · 가운뎃점 · 문장부호 무시, 소문자) */
export function relatedName(value: unknown): string {
  return String(value ?? "")
    .replace(/\/.*$/, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[\s·\-_.,'"]/g, "")
    .toLowerCase();
}

/**
 * 이름 점수 (PoC score): 같은 이름 3 · 한쪽이 다른 쪽으로 시작 2 · 한쪽이 다른 쪽을 품음 1 · 아니면 0.
 * 시작 · 품음은 둘 다 3글자 이상일 때만. me는 relatedName으로 정규화한 장소 이름
 */
export function relatedScore(name: unknown, me: string): number {
  const n = relatedName(name);
  if (!n || !me) return 0;
  if (n === me) return 3;
  const long = me.length >= 3 && n.length >= 3;
  if (long && (n.startsWith(me) || me.startsWith(n))) return 2;
  if (long && (n.includes(me) || me.includes(n))) return 1;
  return 0;
}

/**
 * 한 곳 고르기 (PoC pick): 관광지 이름(tAtsNm)으로 묶어 점수가 가장 높은 묶음, 같은 점수면 행이 많은 묶음(먼저 나온 쪽 우선).
 * 점수가 모두 0이면 []
 */
export function pickRelated(
  items: readonly TourItem[],
  me: string,
): TourItem[] {
  const groups = new Map<string, TourItem[]>();
  for (const x of items) {
    const name = String(x.tAtsNm ?? "");
    const g = groups.get(name);
    if (g) g.push(x);
    else groups.set(name, [x]);
  }
  let best: TourItem[] = [];
  let bestScore = 0;
  for (const [name, g] of groups) {
    const s = relatedScore(name, me);
    if (s > bestScore || (s === bestScore && s > 0 && g.length > best.length)) {
      bestScore = s;
      best = g;
    }
  }
  return bestScore > 0 ? best : [];
}

/** 검색어 후보 (PoC kws): 전체 이름 → 첫 단어 → 정규화한 앞 3글자. 2글자 이상, 겹치면 한 번 */
export function relatedKeywords(keyword: string): string[] {
  return [
    ...new Set(
      [
        keyword,
        keyword.split(/\s+/)[0],
        relatedName(keyword).slice(0, 3),
      ].filter((k) => k && k.length >= 2),
    ),
  ];
}

/** 기준월 후보(YYYYMM): 한국 날짜 기준 2 · 3 · 4개월 전 (PoC와 같은 순서, 해가 바뀌면 전해) */
export function relatedMonths(now: Date): string[] {
  const [y, m] = seoulDate(now).split("-").map(Number);
  return [2, 3, 4].map((back) => {
    const d = new Date(Date.UTC(y, m - 1 - back, 1));
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** 연관 관광지 한 곳 */
export type RelatedRow = {
  rank: number;
  /** 한국관광공사 이름 */
  name: string;
  /** 한국관광공사 분류(소 → 중 → 대분류 중 있는 것) */
  category: string;
  /** 시도 · 시군구 이름 */
  region: string;
  /** 시군구 코드(rlteSignguCd). 없으면 "" */
  regionCd: string;
};

/** PoC 화면(d_rlte)에서 빼는 이름인지: 영화관 · 주차장 · 화장실 */
export function hiddenRelatedName(name: string): boolean {
  return /^(CGV|메가박스|롯데시네마)|주차장|화장실/.test(name);
}

/**
 * 고른 묶음 → 보일 줄 (PoC getRelatedSpots 뒷부분): rlteRank 순(없으면 99), 이름이 없거나 겹치거나 자기 자신(점수 3)이면 빼고 8개,
 * 그 뒤 PoC 화면처럼 영화관 · 주차장 · 화장실을 뺀다
 */
export function relatedRows(
  rows: readonly TourItem[],
  me: string,
): RelatedRow[] {
  const rank = (x: TourItem) => {
    const n = Number(x.rlteRank || 99);
    return Number.isFinite(n) ? n : 99;
  };
  const out: RelatedRow[] = [];
  const seen = new Set<string>();
  for (const x of [...rows].sort((a, b) => rank(a) - rank(b))) {
    const name = String(x.rlteTatsNm ?? "").trim();
    if (!name || seen.has(name) || relatedScore(name, me) === 3) continue;
    seen.add(name);
    out.push({
      rank: Number(x.rlteRank) || out.length + 1,
      name,
      category: String(
        x.rlteCtgrySclsNm || x.rlteCtgryMclsNm || x.rlteCtgryLclsNm || "",
      ),
      region: [x.rlteRegnNm, x.rlteSignguNm].filter(Boolean).join(" "),
      regionCd: String(x.rlteSignguCd ?? ""),
    });
  }
  return out
    .slice(0, RELATED_LIMIT)
    .filter((row) => !hiddenRelatedName(row.name));
}

/** 우리 장소와 비교하는 이름 (relatedName에 대괄호 빼기를 더한 것, PoC d_rlte open) */
function linkName(value: unknown): string {
  return relatedName(String(value ?? "").replace(/\[.*?\]/g, ""));
}

let placesByName: Map<string, PlannerPlace[]> | null = null;

function placesNamed(name: string): readonly PlannerPlace[] {
  if (!placesByName) {
    placesByName = new Map();
    for (const p of PLANNER_PLACES) {
      const k = linkName(p.ko);
      const list = placesByName.get(k);
      if (list) list.push(p);
      else placesByName.set(k, [p]);
    }
  }
  return placesByName.get(linkName(name)) ?? [];
}

/**
 * 연관 관광지 → 우리 장소. 이름(정규화)이 같은 플래너 장소 중 같은 도시인 곳.
 * 같은 도시 = 시군구 코드가 같거나(signgu.json) 한국관광공사 시도 · 시군구 이름에 장소 도시 이름(locKo)이 들어 있다.
 * 한국관광공사 행에 지역 정보가 없을 때만 이름만 보고 잇는다(다른 도시의 같은 이름 장소로 잘못 잇지 않게). 자기 자신은 잇지 않는다
 */
export function linkPlace(
  row: Pick<RelatedRow, "name" | "region" | "regionCd">,
  self: string,
): PlannerPlace | null {
  const same = placesNamed(row.name).filter((p) => p.id !== self);
  if (same.length === 0) return null;
  if (!row.region && !row.regionCd) return same[0];
  const code = row.regionCd.slice(0, 5);
  return (
    same.find((p) => {
      const city = p.locKo.replace(/\(.*?\)/g, "");
      return (
        (code.length === 5 && tourPlaceSigngu(p.id) === code) ||
        (city.length > 0 && row.region.includes(city))
      );
    }) ?? null
  );
}

/** 우리 장소와 이은 줄 */
export type LinkedRow = RelatedRow & { place: PlannerPlace | null };

/** 분류 이름표(messages Course.categories) — 외국어 화면의 우리 분류 이름 */
async function categoryNames(
  locale: AppLocale,
): Promise<Readonly<Record<string, string>>> {
  const messages = (await import(`../../messages/${locale}.json`)) as {
    default: { Course: { categories: Record<string, string> } };
  };
  return messages.default.Course.categories;
}

/**
 * 화면 언어로 옮긴 항목. 한국어 화면은 한국관광공사 값 그대로(이어진 곳은 placeId),
 * 외국어 화면은 이어진 우리 장소만 그 언어 이름 · 우리 분류 이름 · 우리 도시 이름으로(한글이 남으면 뺀다, 같은 장소는 한 번)
 */
export async function localizeRelated(
  rows: readonly LinkedRow[],
  locale: AppLocale,
): Promise<TourRelatedItem[]> {
  if (locale === "ko")
    return rows.map(({ rank, name, category, region, place }) => ({
      rank,
      name,
      category,
      region,
      ...(place ? { placeId: place.id } : {}),
    }));
  const names = await loadNameTable(locale);
  const categories = await categoryNames(locale);
  const out: TourRelatedItem[] = [];
  const seen = new Set<string>();
  for (const { rank, place } of rows) {
    if (!place || seen.has(place.id)) continue;
    const name = placeName(place, locale, names);
    if (!name || hasHangul(name)) continue;
    seen.add(place.id);
    const category = isCategoryKey(place.cat)
      ? (categories[place.cat] ?? "")
      : "";
    const region = cityName(place.locKo, locale, names);
    out.push({
      rank,
      name,
      category: hasHangul(category) ? "" : category,
      region: hasHangul(region) ? "" : region,
      placeId: place.id,
    });
  }
  return out;
}

/** 시군구 전체 목록을 서버 메모리에 두는 수. 넘으면 오래된 것부터 지운다 */
const BULK_MAX = 20;
const bulkCache = new Map<string, { at: number; items: Promise<TourItem[]> }>();

/**
 * 시군구 전체 목록(areaBasedList1, 최대 2,000행 — 경주 202607은 약 0.9MB). Next 데이터 캐시는 한 항목 2MB가 한도이고
 * 넘으면 캐시 경고가 키가 든 주소를 찍어, 서버 fetch 캐시 대신 서버 메모리에 하루 둔다(PoC _rlteCache와 같다).
 * 같은 시군구 · 기준월은 한 번만 부른다(부르는 중인 것도 같이 기다린다). 실패는 두지 않는다
 */
function bulkItems(key: string, signgu: string, ym: string) {
  const id = `${signgu}|${ym}`;
  const hit = bulkCache.get(id);
  if (hit && Date.now() - hit.at < TOUR_DAY_SECONDS * 1000) return hit.items;
  const items = fetchTourItems(
    tourApiUrl("TarRlteTarService1/areaBasedList1", key, {
      numOfRows: "2000",
      pageNo: "1",
      baseYm: ym,
      areaCd: signgu.slice(0, 2),
      signguCd: signgu,
    }),
    "no-store",
  );
  bulkCache.delete(id);
  bulkCache.set(id, { at: Date.now(), items });
  items.catch(() => bulkCache.delete(id));
  while (bulkCache.size > BULK_MAX)
    bulkCache.delete(bulkCache.keys().next().value!);
  return items;
}

/** 테스트용: 서버 메모리의 시군구 전체 목록을 비운다 */
export function clearRelatedCache(): void {
  bulkCache.clear();
}

/**
 * 한국관광공사 연관 관광지 찾기 (PoC getRelatedSpots). 기준월마다 검색어 후보로 searchKeyword1, 없으면 areaBasedList1.
 * 찾으면 { month, rows }(우리 장소와 이은 줄), 끝까지 없으면 null. 외부 실패는 TourApiError
 */
export async function findRelated(
  place: TourPlace,
  key: string,
  now = new Date(),
): Promise<{ month: string; rows: LinkedRow[] } | null> {
  const keyword = place.ko.replace(/\s*\(.*?\)\s*/g, "").trim();
  if (!keyword || !place.signgu) return null;
  const me = relatedName(keyword);
  const search = (ym: string, k: string) =>
    fetchTourItems(
      tourApiUrl("TarRlteTarService1/searchKeyword1", key, {
        numOfRows: "100",
        pageNo: "1",
        baseYm: ym,
        areaCd: place.signgu.slice(0, 2),
        signguCd: place.signgu,
        keyword: k,
      }),
      TOUR_DAY_SECONDS,
    );
  for (const ym of relatedMonths(now)) {
    let rows: TourItem[] = [];
    for (const k of relatedKeywords(keyword)) {
      rows = pickRelated(await search(ym, k), me);
      if (rows.length > 0) break;
    }
    if (rows.length === 0)
      rows = pickRelated(await bulkItems(key, place.signgu, ym), me);
    if (rows.length > 0)
      return {
        month: ym,
        rows: relatedRows(rows, me).map((row) => ({
          ...row,
          place: linkPlace(row, place.id),
        })),
      };
  }
  return null;
}

/** GET /api/tour/related 처리. 응답 { month, items } · 결과 없음 { empty: true } */
export async function tourRelatedResponse(request: Request): Promise<Response> {
  const query = parseTourQuery(request, true);
  if ("error" in query) return query.error;
  const { place, locale } = query;
  const key = tourApiKey();
  if (!key) return tourNotConfigured();
  let found: Awaited<ReturnType<typeof findRelated>>;
  try {
    found = await findRelated(place, key);
  } catch {
    return tourUnavailable();
  }
  const items = found ? await localizeRelated(found.rows, locale) : [];
  const body: TourRelated | { empty: true } =
    found && items.length > 0 ? { month: found.month, items } : { empty: true };
  return tourJson(body, TOUR_DAY_SECONDS);
}
