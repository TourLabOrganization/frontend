// 홈 「지금 인기 관광지」(GET /api/tour/popular?city=&locale=, 서버 전용).
// 한국관광공사 관광지 집중률 방문자 추이 예측(TatsCnctrRateService tatsCnctrRatedList)을 관광지 이름(tAtsNm) 없이 시군구 단위로 불러
// 그 시군구 관광지 전체의 날짜별 집중률을 받고, 기준 날짜(오늘, 없으면 오늘 이후 가장 이른 날)의 집중률이 높은 순으로 10곳을 고른다.
//   - 시군구: 도시의 플래너 장소(숙박 제외)가 많은 시군구 코드 순으로, 장소 5곳 이상인 곳만 최대 4곳(호출 수를 묶는다)
//   - 각 관광지를 앱 장소와 잇는다(장소 id와 화면 언어 이름을 붙인다). 세 단계:
//     ⓞ 수기 대조표(lib/popular-match.ts): 규칙으로 못 잇는 이름(팔각정북악스카이 → 북악스카이웨이 팔각정 …)은 사람이 적은 장소로
//     ① 이름: 장소 시트 방문 집중률과 같은 이름 점수에 표기 차이(앞의 도시 이름 · 해수욕장/해변 · 전통시장/시장)를 맞춘 이름도 본다. 같은 시군구 · 2점 이상.
//        (같은 시군구만. 시군구 경계 장소는 ②에서 같은 시군구 관광정보가 없을 때 본다)
//     ② 위치: 이름으로 못 찾으면 한국관광공사 국문 관광정보(searchKeyword2)에서 같은 관광지를 찾아, 그 좌표 250m 안의 앱 장소
//        (1km 안이면 이름 글자가 절반 이상 겹칠 때) — 이름이 아주 다르게 적힌 같은 곳.
//        같은 시군구 관광정보가 없으면(검색 실패 포함) 시군구 경계 장소로 보고 앱 장소만 찾는다(boundaryMatch): 같은 도시의 이름 같은 장소 →
//        같은 시도의 이름 같은 관광정보 좌표 1km 안에서 이름도 맞는 장소. 1100고지 습지는 집중률이 제주시, 앱 장소 · 관광정보가 서귀포시
//     ③ 신규 관광지: 그래도 없으면 한국관광공사 콘텐츠 id로 신규 관광지(kto:<contentid>)를 만든다. 장소 시트 칸 · 지도 · 코스가 앱 장소처럼 된다
//        (features/planner/kto-place.ts). 한국관광공사에서도 못 찾으면 id 없이 글자만 둔다
//   - 집중률은 방문 예측 지표이고 순위는 「그날 붐빌 것으로 예측된 순서」다(인기 = 방문 집중)
// 테스트(vitest)가 "@/" 경로를 풀지 못해 상대 경로로 import한다. 이름표(중 · 일 · 서)는 Route Handler가 넘긴다.
import { PLANNER_PLACES, type PlannerPlace } from "../features/planner/data";
import type { NameTable } from "../features/names/names";
import { placeName } from "../features/theme/place-meta";
import {
  POPULAR_CITIES,
  type PopularCity,
  TOUR_CROWD_SECONDS,
  type TourPopular,
  type TourPopularItem,
} from "./tour";
import {
  fetchTourItems,
  fetchTourPage,
  inSigngu,
  signguVariants,
  KTO_PLACE_SECONDS,
  publicKtoPlace,
  toKtoPlace,
  tourApiKey,
  tourApiUrl,
  type TourItem,
  tourJson,
  tourNotConfigured,
  type TourPlace,
  tourPlaceSigngu,
  tourUnavailable,
  withForeignNames,
  withoutCity,
  type TourCache,
} from "./tour-api";
import { pinnedPlaceId } from "./popular-match";
import { romanize } from "./romanize";
import { crowdName, crowdScore } from "./tour-crowd";
import { seoulDate } from "./weather";
import { type AppLocale, locales } from "../i18n/locales";

/** 도시당 부르는 시군구 수 상한 */
export const POPULAR_MAX_DISTRICTS = 4;
/** 부를 시군구의 최소 장소 수(숙박 제외). 서울 · 부산처럼 장소가 여러 구에 퍼진 도시도 주요 구를 고르게 */
export const POPULAR_MIN_PLACES = 5;
/** 보여 줄 관광지 수 */
export const POPULAR_COUNT = 10;
/** 같은 장소로 이어진 줄을 합친 뒤에도 POPULAR_COUNT를 채우려고 더 보는 순위 수(이중섭 문화거리 · 서귀포 이중섭거리처럼 한 장소가 두 이름으로 나온다) */
export const POPULAR_SCAN_EXTRA = 5;
/** 한 시군구에서 받는 쪽 수 상한(쪽당 1,000행: 관광지 수 × 약 30일) */
const MAX_PAGES = 5;
const ROWS = 1000;

export function isPopularCity(v: unknown): v is PopularCity {
  return (POPULAR_CITIES as readonly unknown[]).includes(v);
}

/**
 * 장소 수로 고르지 않고 못 박은 시군구. 서울은 보물 소재지(박물관 · 절, 2026-10-04)가 용산 · 성북에 몰려
 * 장소 수 순서가 바뀌어도 관광 중심인 종로 · 마포 · 영등포 · 중구를 그대로 부른다
 */
export const POPULAR_DISTRICTS: Readonly<Record<string, readonly string[]>> = {
  서울: ["11110", "11440", "11560", "11140"],
};

/** 도시의 시군구 코드: POPULAR_DISTRICTS에 있으면 그 값, 아니면 플래너 장소(숙박 제외)가 많은 순(같으면 코드 순), 장소 5곳 이상, 최대 4곳 */
export function citySigngu(
  city: string,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
  signguOf: (id: string) => string = tourPlaceSigngu,
): string[] {
  const pinned = POPULAR_DISTRICTS[city];
  if (pinned && places === PLANNER_PLACES) return [...pinned];
  const counts = new Map<string, number>();
  for (const p of places) {
    if (p.locKo !== city || p.cat === "stay") continue;
    const code = signguOf(p.id);
    if (!/^\d{5}$/.test(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= POPULAR_MIN_PLACES)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, POPULAR_MAX_DISTRICTS)
    .map(([code]) => code);
}

/** YYYYMMDD → YYYY-MM-DD. 모양이 다르면 null */
function ymd(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 8
    ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`
    : null;
}

/** 순위를 매길 한 곳(이름 · 시군구 · 집중률) */
export type RankedSpot = {
  name: string;
  district: string;
  signgu: string;
  rate: number;
};

/**
 * 시군구 결과 → 기준 날짜의 집중률 높은 순. 기준 날짜는 today가 있으면 today, 없으면 today 이후 가장 이른 날(없으면 null).
 * 같은 시군구 · 같은 이름이 여러 번이면 뒤의 값(PoC getCrowd와 같다). 숫자가 아닌 값은 뺀다. 같은 집중률이면 이름 순
 */
export function rankSpots(
  items: readonly TourItem[],
  today: string,
): { date: string; spots: RankedSpot[] } | null {
  const rows = items.flatMap((x) => {
    const date = ymd(x.baseYmd);
    const rate = Number(x.cnctrRate);
    const name = String(x.tAtsNm ?? "").trim();
    if (!date || !name || !Number.isFinite(rate) || date < today) return [];
    return [
      {
        date,
        rate,
        name,
        district: String(x.signguNm ?? "").trim(),
        signgu: String(x.signguCd ?? "").trim(),
      },
    ];
  });
  if (rows.length === 0) return null;
  const date = rows.some((r) => r.date === today)
    ? today
    : rows.map((r) => r.date).sort()[0];
  const byName = new Map<string, RankedSpot>();
  for (const r of rows) {
    if (r.date !== date) continue;
    byName.set(`${r.signgu}|${r.name}`, {
      name: r.name,
      district: r.district,
      signgu: r.signgu,
      rate: r.rate,
    });
  }
  const spots = [...byName.values()].sort(
    (a, b) => b.rate - a.rate || a.name.localeCompare(b.name, "ko"),
  );
  return { date, spots };
}

/** 표기 차이를 맞춘 이름: 괄호 · 공백 · 가운뎃점을 빼고(crowdName) 같은 뜻의 끝말을 하나로(해수욕장 · 해안 → 해변, 전통시장 · 재래시장 → 시장) */
export function spotName(value: unknown): string {
  return crowdName(value)
    .replace(/(해수욕장|해안)$/, "해변")
    .replace(/(전통시장|재래시장)$/, "시장");
}

/** 비교할 이름들: 그대로 · 앞의 도시 이름을 뗀 이름, 각각 표기 차이를 맞춘다(2글자 이상) */
function nameVariants(name: string, city: string): string[] {
  const raw = [name, city ? (withoutCity(name, city) ?? "") : ""];
  return [...new Set(raw.map(spotName))].filter((n) => n.length >= 2);
}

/**
 * 이름 점수(3 같음 · 2 한쪽이 다른 쪽을 품음 · 0 아님). 장소 시트 방문 집중률의 점수(crowdScore)에 더해
 * 표기 차이를 맞춘 이름끼리도 비교한다. 맞춘 이름으로 품는지 볼 때는 짧은 쪽이 3글자 이상이어야 한다(「해변」 같은 끝말만 겹치지 않게)
 */
export function nameScore(spot: string, place: string, city: string): number {
  let best = crowdScore(spot, crowdName(place));
  if (best === 3) return 3;
  for (const a of nameVariants(spot, city))
    for (const b of nameVariants(place, city)) {
      if (a === b) return 3;
      const short = a.length <= b.length ? a : b;
      if (short.length >= 3 && (a.includes(b) || b.includes(a))) best = 2;
    }
  return best;
}

/** 두 이름의 글자쌍(bigram) 겹침(Dice, 0~1). 표기 차이를 맞춘 이름으로 본다 */
export function nameOverlap(a: string, b: string): number {
  const pairs = (s: string) => {
    const n = spotName(s);
    const out: string[] = [];
    for (let i = 0; i < n.length - 1; i++) out.push(n.slice(i, i + 2));
    return out;
  };
  const x = pairs(a);
  const y = pairs(b);
  if (x.length === 0 || y.length === 0) return 0;
  const rest = [...y];
  let hit = 0;
  for (const p of x) {
    const i = rest.indexOf(p);
    if (i >= 0) {
      hit++;
      rest.splice(i, 1);
    }
  }
  return (2 * hit) / (x.length + y.length);
}

/** 위치로 같은 곳을 보는 거리(m). 이 안이면 이름이 달라도 같은 곳 */
export const SAME_SPOT_M = 250;
/** 이 거리(m) 안이면 이름 글자가 절반 이상 겹칠 때 같은 곳 */
export const NEAR_SPOT_M = 1000;
/** NEAR_SPOT_M 안에서 같은 곳으로 볼 이름 겹침 */
export const NEAR_SPOT_OVERLAP = 0.5;

export function meters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) *
      Math.cos(lat2 * r) *
      Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

/**
 * 한국관광공사 좌표 근처의 앱 장소(같은 도시, 숙박 제외): 250m 안에서 가장 가까운 곳,
 * 없으면 1km 안에서 이름 글자가 절반 이상 겹치는 가장 가까운 곳. 없으면 null
 */
export function matchByLocation(
  spot: { name: string; lat: number; lng: number },
  city: string,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
): PlannerPlace | null {
  let best: PlannerPlace | null = null;
  let bestD = Infinity;
  for (const p of places) {
    if (p.locKo !== city || p.cat === "stay") continue;
    const d = meters(spot.lat, spot.lng, p.lat, p.lng);
    if (d > NEAR_SPOT_M || d >= bestD) continue;
    if (d > SAME_SPOT_M && nameOverlap(spot.name, p.ko) < NEAR_SPOT_OVERLAP)
      continue;
    best = p;
    bestD = d;
  }
  return best;
}

/** 관광지 검색에서 뺄 콘텐츠 타입: 여행코스 25 · 숙박 32 */
const SKIP_TYPES = new Set(["25", "32"]);
/** 같은 점수면 앞에 둘 타입: 관광지 12 · 문화시설 14 · 레포츠 28 · 쇼핑 38 */
const SPOT_TYPES = new Set(["12", "14", "28", "38"]);

/**
 * 국문 관광정보 검색 결과에서 인기 관광지와 같은 곳 하나: 시군구 코드(법정동)가 있으면 같은 시군구만,
 * 이름 점수 2 이상 중 높은 곳 → 관광지 타입 → 먼저 나온 곳. 없으면 null
 */
export function pickSpotItem(
  items: readonly TourItem[],
  spot: Pick<RankedSpot, "name" | "signgu">,
): TourItem | null {
  const scored = items.flatMap((x, i) => {
    if (SKIP_TYPES.has(String(x.contenttypeid ?? ""))) return [];
    const code = `${String(x.lDongRegnCd ?? "")}${String(x.lDongSignguCd ?? "")}`;
    if (
      /^\d{5}$/.test(spot.signgu) &&
      /^\d{5}$/.test(code) &&
      code !== spot.signgu
    )
      return [];
    const score = nameScore(spot.name, String(x.title ?? ""), "");
    if (score < 2) return [];
    const typed = SPOT_TYPES.has(String(x.contenttypeid ?? "")) ? 0 : 1;
    return [{ x, score, typed, i }];
  });
  scored.sort((a, b) => b.score - a.score || a.typed - b.typed || a.i - b.i);
  return scored[0]?.x ?? null;
}

/**
 * 같은 시군구에 없을 때의 예비 후보: 같은 시도(코드 앞 두 자리) · 이름이 같은(3점) 관광정보. 시군구 경계에 걸친 장소가 집중률과 관광정보에서
 * 다른 시군구로 적힌 경우다. 이 후보는 앱 장소를 위치로 찾는 데만 쓰고 신규 관광지로 만들지 않는다(다른 구의 같은 이름일 수 있다)
 */
export function pickSpotItemLoose(
  items: readonly TourItem[],
  spot: Pick<RankedSpot, "name" | "signgu">,
): TourItem | null {
  if (!/^\d{5}$/.test(spot.signgu)) return null;
  const sido = spot.signgu.slice(0, 2);
  const inSido = items.filter((x) => {
    const regn = String(x.lDongRegnCd ?? "");
    return (
      (!regn || regn === sido) &&
      nameScore(spot.name, String(x.title ?? ""), "") === 3
    );
  });
  return pickSpotItem(inSido, { name: spot.name, signgu: "" });
}

/**
 * 이름으로 못 찾은 관광지: 한국관광공사에서 찾아 위치로 앱 장소를, 없으면 신규 관광지를 돌려준다. 못 찾으면 null.
 * 같은 시군구 관광정보가 없으면 경계 장소 대조(boundaryMatch)로 앱 장소만 찾는다. 같은 시군구 관광정보가 있으면 그것이 먼저다
 * (다른 구에 같은 이름 앱 장소가 있어도, 그 구의 관광지는 신규 관광지로)
 */
export async function resolveSpot(
  spot: Pick<RankedSpot, "name" | "signgu">,
  city: string,
  key: string,
): Promise<PlannerPlace | TourPlace | null> {
  const items = await fetchTourItems(
    tourApiUrl("KorService2/searchKeyword2", key, {
      numOfRows: "30",
      pageNo: "1",
      arrange: "A",
      keyword: spot.name,
    }),
    KTO_PLACE_SECONDS,
  );
  const item = pickSpotItem(items, spot);
  if (!item) return boundaryMatch(spot, city, items)?.place ?? null;
  const kto = toKtoPlace(item);
  if (!kto) return null;
  const near = matchByLocation(
    { name: spot.name, lat: kto.lat, lng: kto.lng },
    city,
  );
  if (near) return near;
  // 지도 · 목록은 고른 도시(칩)로 연다. 외국어 이름은 다국어 관광정보에서 찾는다
  return withForeignNames(
    { ...kto, pickCity: city },
    String(item?.contenttypeid ?? ""),
    key,
  );
}

/**
 * 이름이 맞는 플래너 장소. 수기 대조표(popular-match.ts)에 있으면 그 장소, 아니면
 * 같은 도시 · 같은 시군구에서 이름 점수 2 이상 중 가장 높은 곳(같으면 먼저 나온 곳)
 */
export function matchPlace(
  spot: Pick<RankedSpot, "name" | "signgu">,
  city: string,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
  signguOf: (id: string) => string = tourPlaceSigngu,
): PlannerPlace | null {
  const pinned = pinnedPlaceId(city, spot.name);
  if (pinned) {
    const p = places.find((x) => x.id === pinned);
    if (p) return p;
  }
  let best: PlannerPlace | null = null;
  let bestScore = 1;
  for (const p of places) {
    if (p.locKo !== city || p.cat === "stay") continue;
    if (spot.signgu && signguOf(p.id) !== spot.signgu) continue;
    const score = nameScore(spot.name, p.ko, city);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

/**
 * 시군구 경계 장소의 이름 대조: 같은 도시(숙박 제외)에서 이름이 같은(3점) 첫 장소. 시군구는 보지 않는다.
 * 같은 시군구 이름(matchPlace)과 같은 시군구 관광정보(pickSpotItem)로 못 찾았을 때만 쓴다(boundaryMatch).
 * 1100고지 습지: 집중률은 제주시(50110), 앱 장소 · 관광정보는 서귀포시(50130)
 */
export function matchPlaceElsewhere(
  spot: Pick<RankedSpot, "name">,
  city: string,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
): PlannerPlace | null {
  for (const p of places) {
    if (p.locKo !== city || p.cat === "stay") continue;
    if (nameScore(spot.name, p.ko, city) === 3) return p;
  }
  return null;
}

/**
 * 경계 장소의 위치 대조(같은 시도의 이름 같은 관광정보 좌표): 1km 안 · 같은 도시(숙박 제외)에서 이름도 맞는
 * (이름 점수 2 이상 또는 글자쌍 절반 이상 겹침) 가장 가까운 앱 장소. 이름 없는 250m 규칙(matchByLocation)은 쓰지 않는다 —
 * 그 관광정보가 다른 구의 같은 이름일 수 있어, 근처의 다른 장소(영등포 새마을시장 → 은평 대림시장)에 잇지 않게
 */
export function matchByLocationNamed(
  spot: { name: string; lat: number; lng: number },
  city: string,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
): PlannerPlace | null {
  let best: PlannerPlace | null = null;
  let bestD = Infinity;
  for (const p of places) {
    if (p.locKo !== city || p.cat === "stay") continue;
    const d = meters(spot.lat, spot.lng, p.lat, p.lng);
    if (d > NEAR_SPOT_M || d >= bestD) continue;
    if (
      nameScore(spot.name, p.ko, city) < 2 &&
      nameOverlap(spot.name, p.ko) < NEAR_SPOT_OVERLAP
    )
      continue;
    best = p;
    bestD = d;
  }
  return best;
}

/**
 * 같은 시군구 관광정보가 없을 때(검색 실패 포함, items = [])의 경계 장소 대조. 앱 장소만 돌려주고 신규 관광지는 만들지 않는다.
 *  ① 같은 도시 · 다른 시군구의 이름 같은 앱 장소(matchPlaceElsewhere)
 *  ② 같은 시도의 이름 같은 관광정보(pickSpotItemLoose) 좌표 근처에서 이름도 맞는 앱 장소(matchByLocationNamed)
 * 모으기(tour-collect.ts)는 풀(그 도시 장소 + 이번 실행에서 만든 장소)을 넘긴다. 다른 도시 장소는 보지 않는다
 */
export function boundaryMatch(
  spot: Pick<RankedSpot, "name" | "signgu">,
  city: string,
  items: readonly TourItem[],
  places: readonly PlannerPlace[] = PLANNER_PLACES,
): { place: PlannerPlace; how: "name" | "location" } | null {
  const byName = matchPlaceElsewhere(spot, city, places);
  if (byName) return { place: byName, how: "name" };
  const loose = pickSpotItemLoose(items, spot);
  const kto = loose ? toKtoPlace(loose) : null;
  const near = kto
    ? matchByLocationNamed(
        { name: spot.name, lat: kto.lat, lng: kto.lng },
        city,
        places,
      )
    : null;
  return near ? { place: near, how: "location" } : null;
}

/**
 * 한 시군구의 집중률 행. 받은 행 중 그 시군구(옛 · 새 코드 포함) 것만 남기고 signguCd를 앱 코드로 맞춘다(matchPlace가 앱 코드로 비교한다).
 * 새 코드(강원 51 · 전북 52)로 불러 그 시군구 행이 없으면 옛 코드(42 · 45)로 한 번 더 부른다
 */
export async function districtItems(
  code: string,
  key: string,
  /** 캐시. 홈은 집중률 캐시(6시간), 모으기(tour-collect)는 "no-store"(하루 전 응답이 남아 「기준 날짜 행 없음」이 되지 않게) */
  cache: TourCache = TOUR_CROWD_SECONDS,
): Promise<TourItem[]> {
  for (const query of signguVariants(code)) {
    const all: TourItem[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { items, total } = await fetchTourPage(
        tourApiUrl("TatsCnctrRateService/tatsCnctrRatedList", key, {
          numOfRows: String(ROWS),
          pageNo: String(page),
          areaCd: query.slice(0, 2),
          signguCd: query,
        }),
        cache,
      );
      all.push(...items);
      if (items.length < ROWS || all.length >= total) break;
    }
    const mine = all
      .filter((x) => inSigngu(x, code))
      .map((x) => ({ ...x, signguCd: code }));
    if (mine.length > 0) return mine;
  }
  return [];
}

/** 도시의 인기 관광지. 한 시군구가 실패해도 나머지로 만든다(모두 실패면 오류) */
export async function findPopular(
  city: PopularCity,
  key: string,
  locale: AppLocale,
  names: NameTable | undefined,
  now = new Date(),
): Promise<TourPopular | null> {
  const codes = citySigngu(city);
  if (codes.length === 0) return null;
  const results = await Promise.allSettled(
    codes.map((c) => districtItems(c, key)),
  );
  const ok = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (results.every((r) => r.status === "rejected"))
    throw new Error("popular: all districts failed");
  const ranked = rankSpots(ok, seoulDate(now));
  if (!ranked) return null;
  const scanned: TourPopularItem[] = await Promise.all(
    ranked.spots.slice(0, POPULAR_COUNT + POPULAR_SCAN_EXTRA).map(async (s) => {
      let place: PlannerPlace | TourPlace | null = matchPlace(s, city);
      if (!place) {
        try {
          place = await resolveSpot(s, city, key);
        } catch {
          // 한국관광공사 검색이 막히면 경계 장소 이름 대조만(없으면 글자만 둔다)
          place = boundaryMatch(s, city, [])?.place ?? null;
        }
      }
      const base = { district: s.district, rate: s.rate };
      // 앱 장소가 없는 이름은 외국어 화면에서 로마자로(한글을 보이지 않는다)
      if (!place)
        return {
          ...base,
          name: locale === "ko" ? s.name : romanize(s.name),
          id: null,
        };
      if ("signgu" in place)
        return {
          ...base,
          name: locale === "ko" ? s.name : placeName(place, locale, names),
          id: place.id,
          place: publicKtoPlace(place),
        };
      return { ...base, name: placeName(place, locale, names), id: place.id };
    }),
  );
  // 같은 장소로 이어진 줄은 순위가 높은(먼저 나온) 한 줄만 남기고 다음 순위로 채운다. 이어지지 않은 줄(id 없음)은 그대로
  const seen = new Set<string>();
  const items = scanned
    .filter((x) => {
      if (!x.id) return true;
      if (seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    })
    .slice(0, POPULAR_COUNT);
  return { date: ranked.date, items };
}

/** GET /api/tour/popular 처리 */
export async function tourPopularResponse(
  request: Request,
  loadNames: (locale: AppLocale) => Promise<NameTable>,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const city = params.get("city");
  const raw = params.get("locale") ?? "ko";
  if (!isPopularCity(city))
    return Response.json({ message: "invalid city" }, { status: 400 });
  if (!(locales as readonly string[]).includes(raw))
    return Response.json({ message: "invalid locale" }, { status: 400 });
  const locale = raw as AppLocale;
  const key = tourApiKey();
  if (!key) return tourNotConfigured();
  try {
    const names = locale === "ko" ? undefined : await loadNames(locale);
    const popular = await findPopular(city, key, locale, names);
    return tourJson(
      popular && popular.items.length > 0 ? popular : { empty: true },
      TOUR_CROWD_SECONDS,
    );
  } catch {
    return tourUnavailable();
  }
}
