// 여행 정보 탭 「{도시} 축제 · 행사」 칸 (GET /api/tour/festival?city=&locale=, 서버 전용).
// 한국관광공사 관광정보 축제공연행사 조회(KorService2/searchFestival2, 외국어는 EngService2 · ChsService2 · JpnService2 · SpnService2).
//   - 도시의 시군구 코드(앱 장소의 signgu.json, 장소가 1곳 이상인 시군구 전부)마다 법정동 코드(lDongRegnCd 2자리 + lDongSignguCd 3자리)로 부른다.
//     옛 · 새 코드(signguVariants)는 새 코드로 결과가 없을 때만 한 번 더
//   - eventStartDate는 이달 1일: 이미 시작해 진행 중인 축제까지 받고, 끝난 것(종료일 < 오늘)은 뺀다
//   - 오늘 기준 진행 중(시작일 ≤ 오늘)이 먼저(종료일 가까운 순), 그다음 예정(시작일 가까운 순). 같은 contentid는 한 번. 최대 20건
//   - 외국어 화면은 그 언어 서비스 결과만(한국어로 대신 보내지 않는다). 사진 주소는 https로
import { PLANNER_PLACES, type PlannerPlace } from "../features/planner/data";
import { isPlannerCity } from "../features/planner/regions";
import { type AppLocale, locales } from "../i18n/locales";
import {
  TOUR_FESTIVAL_SECONDS,
  type TourFestival,
  type TourFestivalItem,
} from "./tour";
import {
  fetchTourItems,
  KTO_LANG_SERVICES,
  signguVariants,
  tourApiKey,
  tourApiUrl,
  type TourItem,
  tourJson,
  tourNotConfigured,
  tourPlaceSigngu,
  tourUnavailable,
} from "./tour-api";
import { seoulDate } from "./weather";

/** 한 도시에 보이는 최대 건수 */
export const FESTIVAL_LIMIT = 20;
/** 시군구 한 곳에서 받는 행 수(한 쪽만 본다) */
const ROWS = 100;

/** 도시의 시군구 코드(장소가 1곳 이상, 장소 많은 순). 도시 고르기 도시(pickCity)도 그 도시로 본다 */
export function festivalDistricts(
  city: string,
  places: readonly PlannerPlace[] = PLANNER_PLACES,
  signguOf: (id: string) => string = tourPlaceSigngu,
): string[] {
  const counts = new Map<string, number>();
  for (const p of places) {
    if ((p.pickCity ?? p.locKo) !== city || p.cat === "stay") continue;
    const code = signguOf(p.id);
    if (!/^\d{5}$/.test(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code]) => code);
}

/** YYYYMMDD → YYYY-MM-DD. 8자리가 아니면 null */
export function festivalYmd(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 8
    ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`
    : null;
}

/** 호출 주소. 언어별 서비스 · 법정동 코드 · 시작일(YYYYMMDD) */
export function festivalUrl(
  key: string,
  locale: AppLocale,
  code: string,
  fromYmd: string,
): string {
  const service =
    locale === "ko"
      ? "KorService2"
      : KTO_LANG_SERVICES[locale as keyof typeof KTO_LANG_SERVICES];
  return tourApiUrl(`${service}/searchFestival2`, key, {
    numOfRows: String(ROWS),
    pageNo: "1",
    arrange: "A",
    eventStartDate: fromYmd,
    lDongRegnCd: code.slice(0, 2),
    lDongSignguCd: code.slice(2),
  });
}

/**
 * 응답 행 → 화면 항목. 끝난 것(종료일 < 오늘)과 날짜 · 제목이 없는 행은 뺀다.
 * 진행 중(시작일 ≤ 오늘)이 먼저 종료일 순, 예정은 시작일 순. 같은 contentid는 한 번. 최대 limit건
 */
export function parseFestivals(
  items: readonly TourItem[],
  today: string,
  limit = FESTIVAL_LIMIT,
): TourFestivalItem[] {
  const seen = new Set<string>();
  const out: TourFestivalItem[] = [];
  for (const x of items) {
    const id = String(x.contentid ?? "").trim();
    const title = String(x.title ?? "").trim();
    const start = festivalYmd(x.eventstartdate);
    const end = festivalYmd(x.eventenddate);
    if (!id || !title || !start || !end || end < today || seen.has(id))
      continue;
    seen.add(id);
    const lat = Number(x.mapy);
    const lng = Number(x.mapx);
    const image = String(x.firstimage ?? "").trim();
    out.push({
      id,
      title,
      start,
      end,
      ongoing: start <= today,
      addr: [x.addr1, x.addr2]
        .map((a) => String(a ?? "").trim())
        .filter(Boolean)
        .join(" "),
      ...(Number.isFinite(lat) && Number.isFinite(lng) && lat && lng
        ? { lat, lng }
        : {}),
      ...(image ? { image: image.replace(/^http:/, "https:") } : {}),
      ...(String(x.tel ?? "").trim() ? { tel: String(x.tel).trim() } : {}),
    });
  }
  out.sort((a, b) =>
    a.ongoing !== b.ongoing
      ? a.ongoing
        ? -1
        : 1
      : a.ongoing
        ? a.end.localeCompare(b.end) || a.title.localeCompare(b.title)
        : a.start.localeCompare(b.start) || a.title.localeCompare(b.title),
  );
  return out.slice(0, limit);
}

/** 도시의 축제 · 행사. 시군구마다 부르고(새 코드로 없으면 옛 코드) 합친다 */
export async function findFestivals(
  city: string,
  locale: AppLocale,
  key: string,
  now = new Date(),
): Promise<TourFestivalItem[]> {
  const today = seoulDate(now);
  const fromYmd = `${today.slice(0, 7).replace("-", "")}01`;
  const all: TourItem[] = [];
  for (const code of festivalDistricts(city)) {
    for (const query of signguVariants(code)) {
      const items = await fetchTourItems(
        festivalUrl(key, locale, query, fromYmd),
        TOUR_FESTIVAL_SECONDS,
      );
      if (items.length > 0) {
        all.push(...items);
        break;
      }
    }
  }
  return parseFestivals(all, today);
}

export async function tourFestivalResponse(
  request: Request,
  now = new Date(),
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const city = params.get("city")?.trim() ?? "";
  if (!isPlannerCity(city))
    return Response.json({ message: "invalid city" }, { status: 400 });
  const raw = params.get("locale") ?? "ko";
  if (!(locales as readonly string[]).includes(raw))
    return Response.json({ message: "invalid locale" }, { status: 400 });
  const locale = raw as AppLocale;
  const key = tourApiKey();
  if (!key) return tourNotConfigured();
  try {
    const items = await findFestivals(city, locale, key, now);
    const body: TourFestival | { empty: true } =
      items.length > 0 ? { city, items } : { empty: true };
    return tourJson(body, TOUR_FESTIVAL_SECONDS);
  } catch {
    return tourUnavailable();
  }
}
