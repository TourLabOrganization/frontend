// 관광공사 호출은 모두 캐시 없이("no-store")한다. 홈 · 장소 시트가 쓰는 fetch 캐시(집중률 6시간 · 관광정보 하루)를 같이 쓰면
// 개발 서버에 남은 하루 전 응답(기준 날짜가 지난 집중률 행 · 옛 검색 결과)이 돌아와 「기준 날짜 행 없음」으로 아무것도 모으지 못한다(2026-10-02).
// 모으기는 개발 서버에서 스크립트로 가끔 돌리는 일이라 캐시의 이점이 없다
import { PLANNER_PLACES, type PlannerPlace } from "../features/planner/data";
import type { RegionKey } from "../features/planner/regions";
import {
  fetchTourItems,
  fetchTourPage,
  type TourItem,
  ktoCategory,
  toKtoPlace,
  tourApiUrl,
  tourPlaceSigngu,
  withForeignNames,
} from "./tour-api";
import { odiiThemeUrl } from "./tour-audio";
import toursData from "../features/home/data/citytour.json";
import type { CityTour } from "../features/home/citytour";
import {
  matchStops,
  NOT_SIGHT,
  normalizeName,
  visitPool,
} from "../features/home/citytour-match";
import { POPULAR_CITIES } from "./tour";
import {
  citySigngu,
  districtItems,
  meters,
  nameOverlap,
  nameScore,
  NEAR_SPOT_M,
  NEAR_SPOT_OVERLAP,
  pickSpotItem,
  POPULAR_COUNT,
  rankSpots,
  SAME_SPOT_M,
} from "./tour-popular";
import { seoulDate } from "./weather";

// 인기 관광지(한국관광공사 집중률)에서 앱 장소 목록에 없는 곳을 모아 「추가 장소」(features/planner/data/added-places.json)로 누적한다.
// 홈 「지금 인기 관광지」(tour-popular.ts)와 같은 규칙으로 집중률 상위 관광지를 앱 장소와 잇고, 못 이은 곳을 새 장소로 만든다.
// Data-Analytics 저장소 tools/add_popular_places.py와 같은 규칙 · 같은 id(pop<contentid>)라 두 저장소의 장소 표가 같게 늘어난다.
// 개발 서버의 Route Handler /api/tour/popular/collect가 부르고, scripts/add-popular-places.mjs가 그 결과를 데이터 파일에 합친다.
// 관광지 오디오 가이드(오디) 해설이 있는 관광지도 같은 모양으로 모은다(collectOdii, Data-Analytics tools/add_odii_places.py와 같은 규칙).
// 서버 전용(키를 쓴다). 테스트가 "@/" 경로를 풀지 못해 상대 경로로 import한다

/** 추가 장소 id 접두사. kto:<contentid>(브라우저가 기억하는 신규 관광지)와 달리 데이터 파일에 들어가는 앱 장소다 */
export const ADDED_PREFIX = "pop";

/** 콘텐츠 id → 추가 장소 id(pop<contentid>). 숫자가 아니면 null */
export function addedId(contentid: unknown): string | null {
  const digits = String(contentid ?? "").trim();
  return /^\d{1,12}$/.test(digits) ? `${ADDED_PREFIX}${digits}` : null;
}

export type CollectScope = "all" | "home";

/** 조회 대상 하나: 지역(도시) · 부를 시군구 코드 · 이을 장소 풀(숙박 제외) */
export type CollectTarget = {
  region: string;
  codes: string[];
  pool: PlannerPlace[];
};

/** 홈 칩 8개 도시(앱 홈과 같은 시군구 선택). 풀은 그 도시 장소 */
export function homeTargets(
  regions: readonly string[] = POPULAR_CITIES,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
  signguOf: (id: string) => string = tourPlaceSigngu,
): CollectTarget[] {
  const out: CollectTarget[] = [];
  for (const region of regions) {
    const codes = citySigngu(region, places, signguOf);
    if (codes.length === 0) continue;
    out.push({
      region,
      codes,
      pool: places.filter((p) => p.locKo === region && p.cat !== "stay"),
    });
  }
  return out;
}

/**
 * 전국: 장소(숙박 제외)가 있는 시군구 전부. 한 시군구가 두 도시에 걸치면(기장군: 부산 · 양산) 장소가 많은 도시(같으면 이름 순)에 붙인다.
 * 풀은 그 도시 장소 + 그 시군구 코드의 장소(도시가 달라도)
 */
export function allTargets(
  places: readonly PlannerPlace[] = PLANNER_PLACES,
  signguOf: (id: string) => string = tourPlaceSigngu,
  minPlaces = 1,
  regions?: readonly string[],
): CollectTarget[] {
  const count = new Map<string, number>();
  for (const p of places) {
    const code = signguOf(p.id);
    if (p.cat === "stay" || !/^\d{5}$/.test(code)) continue;
    const k = `${p.locKo}|${code}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const claims = new Map<string, { n: number; region: string }[]>();
  for (const [k, n] of count) {
    if (n < minPlaces) continue;
    const [region, code] = k.split("|");
    const list = claims.get(code) ?? [];
    list.push({ n, region });
    claims.set(code, list);
  }
  const byRegion = new Map<string, string[]>();
  for (const [code, who] of claims) {
    who.sort((a, b) => b.n - a.n || a.region.localeCompare(b.region, "ko"));
    const region = who[0].region;
    byRegion.set(region, [...(byRegion.get(region) ?? []), code]);
  }
  const out: CollectTarget[] = [];
  for (const region of [...byRegion.keys()].sort((a, b) =>
    a.localeCompare(b, "ko"),
  )) {
    if (regions && !regions.includes(region)) continue;
    const codes = byRegion
      .get(region)!
      .sort(
        (a, b) =>
          (count.get(`${region}|${b}`) ?? 0) -
            (count.get(`${region}|${a}`) ?? 0) || a.localeCompare(b),
      );
    out.push({
      region,
      codes,
      pool: places.filter(
        (p) =>
          p.cat !== "stay" &&
          (p.locKo === region || codes.includes(signguOf(p.id))),
      ),
    });
  }
  return out;
}

/** 후보 판정 */
export type CollectVerdict =
  "existing-name" | "existing-location" | "existing-id" | "new" | "missing";

/** 인기 관광지 후보 한 곳과 판정 */
export type CollectCandidate = {
  region: string;
  rank: number;
  name: string;
  district: string;
  signgu: string;
  rate: number;
  date: string;
  verdict: CollectVerdict;
  /** 이은 앱 장소 id 또는 새 장소 id. 못 찾으면 null */
  id: string | null;
};

/** 데이터 파일에 넣을 추가 장소: 앱 장소 필드 + 시군구 코드 · 주소 · 사진 · 출처 */
export type AddedPlace = PlannerPlace & {
  signgu: string;
  contentid: string;
  addr: string;
  photo: string;
  /** 중 · 일 공식 이름(다국어 관광정보). 없으면 빈 값 */
  zh: string;
  ja: string;
  /** 출처 문구(장소 시트 좌표 근거) */
  source: string;
  /** 설명(한국어) */
  desc: string;
};

export type CollectResult = {
  candidates: CollectCandidate[];
  places: AddedPlace[];
};

/** 풀에서 이름이 맞는 장소(같은 시군구, 이름 점수 2 이상 중 가장 높은 곳, 같으면 먼저 나온 곳). matchPlace와 같은 규칙을 풀에 적용한다 */
function matchInPool(
  spot: { name: string; signgu: string },
  region: string,
  pool: readonly PlannerPlace[],
  signguOf: (id: string) => string,
): PlannerPlace | null {
  let best: PlannerPlace | null = null;
  let bestScore = 1;
  for (const p of pool) {
    if (spot.signgu && signguOf(p.id) !== spot.signgu) continue;
    const score = nameScore(spot.name, p.ko, region);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

/** 풀에서 좌표 근처 장소(matchByLocation과 같은 규칙: 250m 안, 또는 1km 안에서 이름 절반 겹침) */
function nearInPool(
  spot: { name: string; lat: number; lng: number },
  pool: readonly PlannerPlace[],
): PlannerPlace | null {
  let best: PlannerPlace | null = null;
  let bestD = Infinity;
  for (const p of pool) {
    const d = meters(spot.lat, spot.lng, p.lat, p.lng);
    if (d > NEAR_SPOT_M || d >= bestD) continue;
    if (d > SAME_SPOT_M && nameOverlap(spot.name, p.ko) < NEAR_SPOT_OVERLAP)
      continue;
    best = p;
    bestD = d;
  }
  return best;
}

/** 지역 장소의 권역(가장 많은 값). 없으면 fallback */
function regionMacro(
  pool: readonly PlannerPlace[],
  region: string,
  fallback: RegionKey,
): RegionKey {
  const counts = new Map<RegionKey, number>();
  for (const p of pool)
    if (p.locKo === region) counts.set(p.macro, (counts.get(p.macro) ?? 0) + 1);
  let best: RegionKey | null = null;
  for (const [k, n] of counts)
    if (best === null || n > counts.get(best)!) best = k;
  return best ?? fallback;
}

/**
 * 조회 대상마다 집중률 상위 top곳을 앱 장소와 잇고, 못 이은 곳을 추가 장소로 만든다.
 * 같은 실행 안에서 만든 장소는 다음 지역의 풀에도 들어가 두 번 만들지 않는다. 한 시군구가 실패해도 나머지로 만든다
 */
export async function collectPopular(
  key: string,
  targets: readonly CollectTarget[],
  options: {
    top?: number;
    now?: Date;
    signguOf?: (id: string) => string;
    log?: (line: string) => void;
  } = {},
): Promise<CollectResult> {
  const top = options.top ?? POPULAR_COUNT;
  const today = seoulDate(options.now ?? new Date());
  const log = options.log ?? (() => {});
  const baseSigngu = options.signguOf ?? tourPlaceSigngu;
  const added = new Map<string, AddedPlace>();
  const signguOf = (id: string) => added.get(id)?.signgu ?? baseSigngu(id);
  const candidates: CollectCandidate[] = [];
  for (const t of targets) {
    const results = await Promise.allSettled(
      t.codes.map((c) => districtItems(c, key, "no-store")),
    );
    if (results.every((r) => r.status === "rejected")) {
      log(`${t.region}: 모든 시군구 실패`);
      continue;
    }
    const items = results.flatMap((r) =>
      r.status === "fulfilled" ? r.value : [],
    );
    const ranked = rankSpots(items, today);
    if (!ranked) {
      log(`${t.region}: 기준 날짜 행 없음`);
      continue;
    }
    const spots = top > 0 ? ranked.spots.slice(0, top) : ranked.spots;
    const pool: PlannerPlace[] = [...t.pool, ...added.values()].filter(
      (p, i, arr) => arr.findIndex((q) => q.id === p.id) === i,
    );
    let made = 0;
    for (const [i, s] of spots.entries()) {
      const base = {
        region: t.region,
        rank: i + 1,
        name: s.name,
        district: s.district,
        signgu: s.signgu,
        rate: s.rate,
        date: ranked.date,
      };
      const byName = matchInPool(s, t.region, pool, signguOf);
      if (byName) {
        candidates.push({ ...base, verdict: "existing-name", id: byName.id });
        continue;
      }
      let item = null;
      try {
        const found = await fetchTourItems(
          tourApiUrl("KorService2/searchKeyword2", key, {
            numOfRows: "30",
            pageNo: "1",
            arrange: "A",
            keyword: s.name,
          }),
          "no-store",
        );
        item = pickSpotItem(found, s);
      } catch {
        log(`${t.region} ${s.name}: 관광정보 검색 실패`);
      }
      const kto = item ? toKtoPlace(item) : null;
      if (!item || !kto) {
        candidates.push({ ...base, verdict: "missing", id: null });
        continue;
      }
      const id = addedId(item.contentid);
      if (!id) {
        candidates.push({ ...base, verdict: "missing", id: null });
        continue;
      }
      if (pool.some((p) => p.id === id)) {
        candidates.push({ ...base, verdict: "existing-id", id });
        continue;
      }
      const near = nearInPool(
        { name: s.name, lat: kto.lat, lng: kto.lng },
        pool,
      );
      if (near) {
        candidates.push({ ...base, verdict: "existing-location", id: near.id });
        continue;
      }
      let named = kto;
      try {
        named = await withForeignNames(
          kto,
          String(item.contenttypeid ?? ""),
          key,
          "no-store",
        );
      } catch {
        // 다국어 이름을 못 찾으면 로마자 영어 이름으로 둔다
      }
      const macro = regionMacro(t.pool, t.region, kto.macro);
      const place: AddedPlace = {
        id,
        n: null,
        ko: named.ko,
        en: named.en,
        locKo: t.region,
        cat: named.cat,
        lat: named.lat,
        lng: named.lng,
        min: named.min,
        hrs: "",
        open: null,
        close: null,
        yt: false,
        off: true,
        k100: false,
        un: false,
        bf: false,
        auto: named.cat !== "stay",
        macro,
        pickCity: t.region,
        signgu: named.signgu || s.signgu,
        contentid: String(item.contentid).trim(),
        addr: named.addr ?? "",
        photo: named.photo ?? "",
        zh: named.names?.zh ?? "",
        ja: named.names?.ja ?? "",
        source: [
          named.addr ?? "",
          `한국관광공사 인기 관광지(집중률 ${s.rate}%, ${ranked.date})`,
          `관광정보 contentid ${String(item.contentid).trim()} 좌표`,
        ]
          .filter(Boolean)
          .join(" · "),
        desc: named.overview
          ? named.overview
          : `${s.district || t.region} 인기 관광지 ${i + 1}위(${ranked.date} 집중률 기준)`,
      };
      added.set(id, place);
      pool.push(place);
      made++;
      candidates.push({ ...base, verdict: "new", id });
    }
    log(
      `${t.region}: 시군구 ${t.codes.length}곳 · 후보 ${spots.length}곳 / 신규 ${made}곳 (기준 ${ranked.date})`,
    );
  }
  return { candidates, places: [...added.values()] };
}

// ---------- 오디(관광지 오디오 가이드) 해설이 있는 관광지 ----------

/** 오디 관광지 목록 한 쪽 수 · 최대 쪽 수(tour-audio.ts themeList와 같다) */
const ODII_ROWS = 1000;
const ODII_MAX_PAGES = 5;
/** 주소로 지역을 못 정할 때 가장 가까운 장소를 찾는 거리(m) */
const ODII_NEAREST_M = 30_000;
/** 오디 관광지로 만든 추가 장소 id 접두사(관광정보에서 못 찾은 곳). 찾으면 pop<contentid> */
export const ODII_PREFIX = "odii";

const METRO: readonly (readonly [string, string])[] = [
  ["서울", "서울"],
  ["부산", "부산"],
  ["대구", "대구"],
  ["인천", "인천"],
  ["광주광역시", "광주"],
  ["대전", "대전"],
  ["울산", "울산"],
  ["세종", "세종"],
];

/**
 * 오디 주소(addr1 시도 · addr2 시군구) → 앱 지역(locKo). 광역시 · 특별시 · 세종은 그 이름, 제주는 「제주」, 그 밖은 시군구 이름에서 시 · 군을 뗀 것.
 * 강원 고성 → 고성(강원), 경기 광주 → 경기광주. 못 정하면 ""
 */
export function odiiRegion(addr1: string, addr2: string): string {
  const a1 = addr1.replace(/\s/g, "");
  for (const [k, v] of METRO) if (a1.startsWith(k)) return v;
  if (a1.startsWith("제주")) return "제주";
  const a2 = addr2.trim().split(/\s+/)[0] ?? "";
  const base = a2.replace(/(시|군)$/, "");
  if (!base) return "";
  if (base === "고성" && a1.startsWith("강원")) return "고성(강원)";
  if (base === "광주" && a1.startsWith("경기")) return "경기광주";
  return base;
}

const CAT_RULES: readonly (readonly [string, RegExp])[] = [
  ["sea", /해수욕장|해변|해안|바다|포구|등대|섬$|도$|항$|갯벌|방파제/],
  ["food", /시장|먹거리|맛|음식|카페거리|포차/],
  [
    "activity",
    /체험|박람회|월드|파크|테마|놀이|레일|케이블카|짚|스키|수목원|동물원|아쿠아|전망대|스카이/,
  ],
  [
    "herit",
    /사$|사지|궁|성$|산성|읍성|릉$|릉|묘|고분|서원|향교|유적|박물관|기념관|문학관|미술관|고택|생가|탑|비$|정$|루$|대$|당$|관$|성당|교회|사당|서당|터$/,
  ],
  [
    "heal",
    /공원|숲|산$|봉$|폭포|호수|저수지|계곡|오름|습지|정원|둘레길|길$|강$|천$|들|평야|농원|목장/,
  ],
];

/** 관광정보에서 못 찾은 오디 관광지의 분류: 이름의 낱말로(없으면 herit). Data-Analytics rule_category와 같다 */
export function odiiRuleCategory(name: string): string {
  for (const [cat, rx] of CAT_RULES) if (rx.test(name)) return cat;
  return "herit";
}

/** 오디 관광지 한 곳(한국어 목록) */
export type OdiiSpot = {
  tid: string;
  name: string;
  lat: number;
  lng: number;
  addr1: string;
  addr2: string;
  theme: string;
};

/** 오디 한국어 관광지 목록 전체(tid마다 하나, 한국 범위 좌표만) */
export async function odiiSpots(key: string): Promise<OdiiSpot[]> {
  const items = [];
  for (let page = 1; page <= ODII_MAX_PAGES; page++) {
    const { items: got, total } = await fetchTourPage(
      odiiThemeUrl(key, "ko", page),
      "no-store",
    );
    items.push(...got);
    if (got.length < ODII_ROWS || items.length >= total) break;
  }
  const seen = new Set<string>();
  const out: OdiiSpot[] = [];
  for (const x of items) {
    const tid = String(x.tid ?? "").trim();
    const name = String(x.title ?? "").trim();
    const lat = Number(x.mapY);
    const lng = Number(x.mapX);
    if (!tid || !name || seen.has(tid)) continue;
    if (!(lat >= 32 && lat <= 39 && lng >= 124 && lng <= 132)) continue;
    seen.add(tid);
    out.push({
      tid,
      name,
      lat,
      lng,
      addr1: String(x.addr1 ?? "").trim(),
      addr2: String(x.addr2 ?? "").trim(),
      theme: String(x.themeCategory ?? "").trim(),
    });
  }
  return out;
}

/** 오디 후보 한 곳과 판정 */
export type OdiiCandidate = {
  tid: string;
  name: string;
  region: string;
  regionBy: "address" | "nearest" | "none";
  verdict: CollectVerdict | "no-region";
  id: string | null;
};

/** 같은 이름(점수 2 이상) · 1km 안의 국문 관광정보 항목(여행코스 · 숙박 제외, 가까운 것). 없으면 null */
async function ktoNear(
  key: string,
  name: string,
  lat: number,
  lng: number,
): Promise<Record<string, unknown> | null> {
  const found = await fetchTourItems(
    tourApiUrl("KorService2/searchKeyword2", key, {
      numOfRows: "30",
      pageNo: "1",
      arrange: "A",
      keyword: name,
    }),
    "no-store",
  );
  let best: Record<string, unknown> | null = null;
  let bestD = Infinity;
  for (const it of found) {
    const type = String(it.contenttypeid ?? "");
    if (type === "25" || type === "32") continue;
    const la = Number(it.mapy);
    const ln = Number(it.mapx);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) continue;
    if (nameScore(name, String(it.title ?? ""), "") < 2) continue;
    const d = meters(lat, lng, la, ln);
    if (d <= 1000 && d < bestD) {
      best = it;
      bestD = d;
    }
  }
  return best;
}

/**
 * 오디 해설이 있는 관광지 가운데 앱 장소에 없는 곳을 추가 장소로 만든다.
 * 지역은 주소로(odiiRegion), 장소 표에 없는 지역이면 30km 안 가장 가까운 장소의 지역. 같은 지역 장소와 이름 → 위치로 잇고,
 * 남는 곳은 관광정보(이름 · 1km)에서 찾으면 pop<contentid>와 그 분류, 못 찾으면 odii<tid>와 이름 낱말 분류
 */
export async function collectOdii(
  key: string,
  options: {
    places?: readonly PlannerPlace[];
    regions?: readonly string[];
    signguOf?: (id: string) => string;
    log?: (line: string) => void;
  } = {},
): Promise<{ candidates: OdiiCandidate[]; places: AddedPlace[] }> {
  const base = options.places ?? PLANNER_PLACES;
  const log = options.log ?? (() => {});
  const spots = await odiiSpots(key);
  log(`오디 관광지 ${spots.length}곳`);
  const known = new Set(base.map((p) => p.locKo));
  const pool: PlannerPlace[] = base.filter((p) => p.cat !== "stay");
  const added = new Map<string, AddedPlace>();
  const ids = new Set(base.map((p) => p.id));
  const candidates: OdiiCandidate[] = [];
  const nearest = (lat: number, lng: number) => {
    let best = "";
    let bestD = Infinity;
    for (const p of pool) {
      const d = meters(lat, lng, p.lat, p.lng);
      if (d < bestD) {
        best = p.locKo;
        bestD = d;
      }
    }
    return bestD <= ODII_NEAREST_M ? best : "";
  };
  for (const s of spots) {
    let region = odiiRegion(s.addr1, s.addr2);
    let regionBy: OdiiCandidate["regionBy"] = "address";
    if (!known.has(region)) {
      region = nearest(s.lat, s.lng);
      regionBy = region ? "nearest" : "none";
    }
    if (options.regions && !options.regions.includes(region)) continue;
    const row = { tid: s.tid, name: s.name, region, regionBy };
    if (!region) {
      candidates.push({ ...row, verdict: "no-region", id: null });
      continue;
    }
    const regionPool = pool.filter((p) => p.locKo === region);
    const byName = matchInPool(
      { name: s.name, signgu: "" },
      region,
      regionPool,
      () => "",
    );
    if (byName) {
      candidates.push({ ...row, verdict: "existing-name", id: byName.id });
      continue;
    }
    const near = nearInPool(
      { name: s.name, lat: s.lat, lng: s.lng },
      regionPool,
    );
    if (near) {
      candidates.push({ ...row, verdict: "existing-location", id: near.id });
      continue;
    }
    let item: Record<string, unknown> | null = null;
    try {
      item = await ktoNear(key, s.name, s.lat, s.lng);
    } catch {
      log(`${s.name}: 관광정보 검색 실패`);
    }
    const cid = item ? String(item.contentid ?? "").trim() : "";
    const kto = item ? toKtoPlace(item, base) : null;
    const id = cid ? addedId(cid) : null;
    if (id && ids.has(id)) {
      candidates.push({ ...row, verdict: "existing-id", id });
      continue;
    }
    const cat = kto ? ktoCategory(item!) : odiiRuleCategory(s.name);
    const lat = kto ? kto.lat : s.lat;
    const lng = kto ? kto.lng : s.lng;
    const pid = id ?? `${ODII_PREFIX}${s.tid}`;
    const macro = regionMacro(regionPool, region, pool[0]?.macro ?? "capital");
    let named = kto;
    if (kto) {
      try {
        named = await withForeignNames(
          kto,
          String(item!.contenttypeid ?? ""),
          key,
          "no-store",
        );
      } catch {
        // 다국어 이름을 못 찾으면 로마자 영어 이름으로 둔다
      }
    }
    const place: AddedPlace = {
      id: pid,
      n: null,
      ko: s.name,
      en: named?.en ?? s.name,
      locKo: region,
      cat,
      lat,
      lng,
      min: kto?.min ?? (cat === "activity" ? 90 : 60),
      hrs: "",
      open: null,
      close: null,
      yt: false,
      off: true,
      k100: false,
      un: false,
      bf: false,
      auto: cat !== "stay",
      macro,
      pickCity: region,
      signgu: kto?.signgu ?? "",
      contentid: cid,
      addr: kto?.addr ?? `${s.addr1} ${s.addr2}`.trim(),
      photo: kto?.photo ?? "",
      zh: named?.names?.zh ?? "",
      ja: named?.names?.ja ?? "",
      source: [
        kto?.addr ?? `${s.addr1} ${s.addr2}`.trim(),
        `한국관광공사 관광지 오디오 가이드(오디 tid ${s.tid})`,
        cid ? `관광정보 contentid ${cid} 좌표` : "오디 좌표",
      ]
        .filter(Boolean)
        .join(" · "),
      desc:
        kto?.overview ??
        `오디오 가이드(오디) 해설이 있는 관광지${s.theme ? ` · ${s.theme}` : ""}`,
    };
    added.set(pid, place);
    pool.push(place);
    ids.add(pid);
    candidates.push({ ...row, verdict: "new", id: pid });
  }
  log(
    `오디: 후보 ${candidates.length}곳 / 신규 ${added.size}곳 / 지역 없음 ${candidates.filter((c) => c.verdict === "no-region").length}곳`,
  );
  return { candidates, places: [...added.values()] };
}

// ---------- 시티투어 경유지 중 앱에 없는 관광지 ----------
// 시티투어 280노선의 경유지 1,999곳 중 앱 장소와 맞는 곳은 약 950곳이다(2026-10-03). 나머지 가운데 관광지로 보이는 곳(식사 · 역 · 터미널 · 안내소 등을 뺀
// 360곳 안팎)을 후보로 삼아 국문 관광정보(searchKeyword2)에서 찾고(그 도시의 시군구 코드와 맞는 결과만), 인기 관광지와 같은 판정으로 추가 장소를 만든다.
// 지역은 노선의 첫 여행지(visits[0], 운영 도시가 아닌 실제 여행지). 좌표 · 분류 · 주소 · 설명은 관광정보 값이다(웹 검색 좌표는 믿기 어려워 쓰지 않는다)

const CITY_TOURS = toursData as readonly CityTour[];

/** 관광지 이름으로 쓸 수 없는 일반 명사뿐인 경유지(「박물관」 · 「2곳」 · 「총1」 같은 것) */
export const CITYTOUR_GENERIC =
  /^(박물관|미술관|시장|전통시장|재래시장|공원|해수욕장|체험|농장체험|농촌체험|체험장|자유선택|관광지|일원|축제장|카페|식당|맛집|쇼핑|아울렛|온천|사찰|해변|항|포구|둘레길|산책로|원도심|시내|도심)$|^\d+곳$|총\s*\d|택\d|^\d+$|안내소|경기장|운동장|시청|군청|구청|주차장|휴게소|터미널|정류장|역\s*경유|경유$|집결|해산|탑승|하차|\S역$/;

/** 앱 장소와 맞지 않는 시티투어 경유지 하나. 같은 지역 · 같은 정규화 이름은 한 번(노선 수를 센다) */
export type CityTourStop = { region: string; name: string; tours: number };

/** 앱 장소와 맞지 않고 관광지로 보이는 경유지(지역 = 노선의 첫 여행지). 노선 많은 순 → 지역 → 이름 */
export function cityTourStops(
  tours: readonly CityTour[] = CITY_TOURS,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
): CityTourStop[] {
  const pool = places.map((p) => ({
    id: p.id,
    ko: p.ko,
    cat: p.cat,
    locKo: p.locKo,
    pickCity: p.pickCity,
    ct: false,
  }));
  const map = new Map<string, CityTourStop>();
  for (const t of tours) {
    const region = t.visits[0] ?? t.region;
    // 실제 여행지 도시의 장소가 풀이다(scripts/build-citytour.mjs와 같다. 서울 출발 EG투어버스는 파주 · 시흥 장소와 맞춘다)
    const { missed } = matchStops(
      t.route,
      visitPool(t.visits, pool),
      t.region,
      pool,
    );
    for (const raw of missed) {
      const stop = raw.trim();
      const key = normalizeName(stop);
      if (
        key.length < 2 ||
        NOT_SIGHT.test(stop) ||
        CITYTOUR_GENERIC.test(key) ||
        key === normalizeName(region)
      )
        continue;
      const k = `${region}|${key}`;
      const cur = map.get(k);
      if (cur) cur.tours++;
      else map.set(k, { region, name: stop, tours: 1 });
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      b.tours - a.tours ||
      a.region.localeCompare(b.region) ||
      a.name.localeCompare(b.name),
  );
}

/** 시티투어 경유지 후보 한 곳과 판정 */
export type CityTourCandidate = CityTourStop & {
  verdict: CollectVerdict;
  id: string | null;
};

/** 도시의 시군구 코드 전부(장소 1곳 이상) */
function cityCodes(
  city: string,
  places: readonly PlannerPlace[],
  signguOf: (id: string) => string,
): Set<string> {
  const out = new Set<string>();
  for (const p of places) {
    if ((p.pickCity ?? p.locKo) !== city) continue;
    const code = signguOf(p.id);
    if (/^\d{5}$/.test(code)) out.add(code);
  }
  return out;
}

/**
 * 시티투어 경유지 중 앱에 없는 관광지를 모은다. 후보마다 그 지역 장소 풀에서 이름 → 관광정보 검색(그 도시 시군구 코드와 맞는 결과만) →
 * 위치 → 추가 장소(pop<contentid>). 인기 관광지(collectPopular)와 같은 판정 · 같은 id라 같은 곳을 두 번 만들지 않는다
 */
export async function collectCityTour(
  key: string,
  options: {
    places?: readonly PlannerPlace[];
    tours?: readonly CityTour[];
    regions?: readonly string[];
    signguOf?: (id: string) => string;
    log?: (line: string) => void;
  } = {},
): Promise<{ candidates: CityTourCandidate[]; places: AddedPlace[] }> {
  const base = options.places ?? PLANNER_PLACES;
  const signguOf = options.signguOf ?? tourPlaceSigngu;
  const log = options.log ?? (() => {});
  let stops = cityTourStops(options.tours ?? CITY_TOURS, base);
  if (options.regions?.length)
    stops = stops.filter((s) => options.regions!.includes(s.region));
  log(`시티투어 미매칭 경유지 ${stops.length}곳`);
  const added = new Map<string, AddedPlace>();
  const ids = new Set(base.map((p) => p.id));
  const candidates: CityTourCandidate[] = [];
  const perRegion = new Map<string, { n: number; made: number }>();
  for (const s of stops) {
    const stat = perRegion.get(s.region) ?? { n: 0, made: 0 };
    stat.n++;
    perRegion.set(s.region, stat);
    const regionPool: PlannerPlace[] = [
      ...base.filter((p) => (p.pickCity ?? p.locKo) === s.region),
      ...[...added.values()].filter((p) => p.locKo === s.region),
    ];
    const byName = matchInPool(
      { name: s.name, signgu: "" },
      s.region,
      regionPool,
      signguOf,
    );
    if (byName) {
      candidates.push({ ...s, verdict: "existing-name", id: byName.id });
      continue;
    }
    const codes = cityCodes(s.region, base, signguOf);
    let item: TourItem | null = null;
    try {
      const found = await fetchTourItems(
        tourApiUrl("KorService2/searchKeyword2", key, {
          numOfRows: "30",
          pageNo: "1",
          arrange: "A",
          keyword: s.name,
        }),
        "no-store",
      );
      // 그 도시 시군구 코드와 맞는 결과만(코드가 없는 행은 둔다)
      const inCity = found.filter((x) => {
        const code = `${String(x.lDongRegnCd ?? "")}${String(x.lDongSignguCd ?? "")}`;
        return !/^\d{5}$/.test(code) || codes.size === 0 || codes.has(code);
      });
      item = pickSpotItem(inCity, { name: s.name, signgu: "" });
    } catch {
      log(`${s.region} ${s.name}: 관광정보 검색 실패`);
    }
    const cid = item ? String(item.contentid ?? "").trim() : "";
    const id = cid ? addedId(cid) : null;
    const kto = item ? toKtoPlace(item, base) : null;
    if (!item || !kto || !id) {
      candidates.push({ ...s, verdict: "missing", id: null });
      continue;
    }
    if (ids.has(id) || added.has(id)) {
      candidates.push({ ...s, verdict: "existing-id", id });
      continue;
    }
    const near = nearInPool(
      { name: s.name, lat: kto.lat, lng: kto.lng },
      regionPool,
    );
    if (near) {
      candidates.push({ ...s, verdict: "existing-location", id: near.id });
      continue;
    }
    let named = kto;
    try {
      named = await withForeignNames(
        kto,
        String(item.contenttypeid ?? ""),
        key,
        "no-store",
      );
    } catch {
      // 다국어 이름을 못 찾으면 로마자 영어 이름으로 둔다
    }
    const macro = regionMacro(regionPool, s.region, kto.macro);
    const place: AddedPlace = {
      id,
      n: null,
      ko: named.ko,
      en: named.en,
      locKo: s.region,
      cat: named.cat,
      lat: named.lat,
      lng: named.lng,
      min: named.min,
      hrs: "",
      open: null,
      close: null,
      yt: false,
      off: true,
      k100: false,
      un: false,
      bf: false,
      auto: named.cat !== "stay",
      macro,
      pickCity: s.region,
      signgu: named.signgu,
      contentid: cid,
      addr: named.addr ?? "",
      photo: named.photo ?? "",
      zh: named.names?.zh ?? "",
      ja: named.names?.ja ?? "",
      source: [
        named.addr ?? "",
        `시티투어 경유지(${s.tours}개 노선)`,
        `관광정보 contentid ${cid} 좌표`,
      ]
        .filter(Boolean)
        .join(" · "),
      desc: named.overview
        ? named.overview
        : `${s.region} 시티투어 경유지(${s.tours}개 노선)`,
    };
    added.set(id, place);
    stat.made++;
    candidates.push({ ...s, verdict: "new", id });
  }
  for (const [region, stat] of perRegion)
    log(`${region}: 후보 ${stat.n}곳 / 신규 ${stat.made}곳`);
  return { candidates, places: [...added.values()] };
}
