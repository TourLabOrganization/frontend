import { PLANNER_PLACES, type PlannerPlace } from "../features/planner/data";
import type { RegionKey } from "../features/planner/regions";
import {
  fetchTourItems,
  KTO_PLACE_SECONDS,
  toKtoPlace,
  tourApiUrl,
  tourPlaceSigngu,
  withForeignNames,
} from "./tour-api";
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
      t.codes.map((c) => districtItems(c, key)),
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
          KTO_PLACE_SECONDS,
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
