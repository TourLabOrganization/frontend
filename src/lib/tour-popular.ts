// 홈 「지금 인기 관광지」(GET /api/tour/popular?city=&locale=, 서버 전용).
// 한국관광공사 관광지 집중률 방문자 추이 예측(TatsCnctrRateService tatsCnctrRatedList)을 관광지 이름(tAtsNm) 없이 시군구 단위로 불러
// 그 시군구 관광지 전체의 날짜별 집중률을 받고, 기준 날짜(오늘, 없으면 오늘 이후 가장 이른 날)의 집중률이 높은 순으로 10곳을 고른다.
//   - 시군구: 도시의 플래너 장소(숙박 제외)가 많은 시군구 코드 순으로, 장소 5곳 이상인 곳만 최대 4곳(호출 수를 묶는다)
//   - 이름이 맞는 플래너 장소가 있으면(장소 시트 방문 집중률과 같은 이름 점수, 같은 시군구 · 2점 이상) 그 장소 id와 화면 언어 이름을 붙인다
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
  fetchTourPage,
  tourApiKey,
  tourApiUrl,
  type TourItem,
  tourJson,
  tourNotConfigured,
  tourPlaceSigngu,
  tourUnavailable,
} from "./tour-api";
import { crowdName, crowdScore } from "./tour-crowd";
import { seoulDate } from "./weather";
import { type AppLocale, locales } from "../i18n/locales";

/** 도시당 부르는 시군구 수 상한 */
export const POPULAR_MAX_DISTRICTS = 4;
/** 부를 시군구의 최소 장소 수(숙박 제외). 서울 · 부산처럼 장소가 여러 구에 퍼진 도시도 주요 구를 고르게 */
export const POPULAR_MIN_PLACES = 5;
/** 보여 줄 관광지 수 */
export const POPULAR_COUNT = 10;
/** 한 시군구에서 받는 쪽 수 상한(쪽당 1,000행: 관광지 수 × 약 30일) */
const MAX_PAGES = 5;
const ROWS = 1000;

export function isPopularCity(v: unknown): v is PopularCity {
  return (POPULAR_CITIES as readonly unknown[]).includes(v);
}

/** 도시의 시군구 코드: 플래너 장소(숙박 제외)가 많은 순(같으면 코드 순), 장소 5곳 이상, 최대 4곳 */
export function citySigngu(
  city: string,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
  signguOf: (id: string) => string = tourPlaceSigngu,
): string[] {
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

/** 이름이 맞는 플래너 장소(같은 도시 · 같은 시군구, 이름 점수 2 이상 중 가장 높은 곳, 같으면 먼저 나온 곳) */
export function matchPlace(
  spot: Pick<RankedSpot, "name" | "signgu">,
  city: string,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
  signguOf: (id: string) => string = tourPlaceSigngu,
): PlannerPlace | null {
  let best: PlannerPlace | null = null;
  let bestScore = 1;
  for (const p of places) {
    if (p.locKo !== city || p.cat === "stay") continue;
    if (spot.signgu && signguOf(p.id) !== spot.signgu) continue;
    const score = crowdScore(spot.name, crowdName(p.ko));
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

async function districtItems(code: string, key: string): Promise<TourItem[]> {
  const all: TourItem[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { items, total } = await fetchTourPage(
      tourApiUrl("TatsCnctrRateService/tatsCnctrRatedList", key, {
        numOfRows: String(ROWS),
        pageNo: String(page),
        areaCd: code.slice(0, 2),
        signguCd: code,
      }),
      TOUR_CROWD_SECONDS,
    );
    all.push(...items);
    if (items.length < ROWS || all.length >= total) break;
  }
  return all;
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
  const items: TourPopularItem[] = ranked.spots
    .slice(0, POPULAR_COUNT)
    .map((s) => {
      const place = matchPlace(s, city);
      return {
        name: place ? placeName(place, locale, names) : s.name,
        district: s.district,
        rate: s.rate,
        id: place?.id ?? null,
      };
    });
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
