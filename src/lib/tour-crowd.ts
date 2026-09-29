// 장소 시트 「방문 집중률 예측」 칸 (GET /api/tour/crowd?id=, 서버 전용).
// 한국관광공사 관광지 집중률 방문자 추이 예측(TatsCnctrRateService tatsCnctrRatedList). PoC Tour Planner.dc.html getCrowd와 같은 규칙:
//   관광지 이름(tAtsNm) 부분일치로 찾고, 못 찾으면 이름이 3글자보다 길 때 정규화한 앞 3글자, 그다음 앞의 도시 이름을 뗀 이름으로 다시 찾는다.
//   결과를 tAtsNm으로 묶어 이름 점수(같은 이름 3 · 한쪽이 다른 쪽을 품음 2)가 가장 높은 한 곳, 점수 0이면 없음. 날짜(baseYmd) → 집중률(cnctrRate)
// 수준(여유 · 보통 · 혼잡)은 화면이 정한다(lib/tour.ts crowdLevel)
import { TOUR_CROWD_SECONDS, type TourCrowd, type TourCrowdDay } from "./tour";
import {
  fetchTourItems,
  parseTourQuery,
  tourApiKey,
  tourApiUrl,
  type TourItem,
  tourJson,
  tourNotConfigured,
  type TourPlace,
  tourUnavailable,
  withoutCity,
} from "./tour-api";
import { seoulDate } from "./weather";

/** 이름 비교용 정규화 (PoC getCrowd nz: 대괄호 · 괄호 · 공백 · 가운뎃점 무시) */
export function crowdName(value: unknown): string {
  return String(value ?? "")
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .replace(/[\s·]/g, "");
}

/** 이름 점수 (PoC getCrowd score): 같은 이름 3 · 한쪽이 다른 쪽을 품음 2 · 아니면 0. 비교할 글자가 없으면 0 */
export function crowdScore(name: unknown, me: string): number {
  const n = crowdName(name);
  if (!n || !me) return 0;
  if (n === me) return 3;
  return n.includes(me) || me.includes(n) ? 2 : 0;
}

/** YYYYMMDD(또는 YYYY-MM-DD) → YYYY-MM-DD. 모양이 다르면 null */
function toYmd(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/**
 * 결과에서 한 곳 고르기 (PoC getCrowd): tAtsNm으로 묶어 점수가 가장 높은 곳(같으면 먼저 나온 곳), 점수 0이면 null.
 * 날짜별 집중률을 오늘(today, YYYY-MM-DD)부터 날짜순으로. 같은 날이 여러 번이면 뒤의 값(PoC와 같다). 숫자가 아닌 값은 뺀다
 */
export function pickCrowd(
  items: readonly TourItem[],
  me: string,
  today: string,
): TourCrowd | null {
  const groups = new Map<string, TourItem[]>();
  for (const x of items) {
    const name = String(x.tAtsNm ?? "");
    const g = groups.get(name);
    if (g) g.push(x);
    else groups.set(name, [x]);
  }
  const best = [...groups.keys()].sort(
    (a, b) => crowdScore(b, me) - crowdScore(a, me),
  )[0];
  if (best === undefined || crowdScore(best, me) === 0) return null;
  const byDate = new Map<string, number>();
  for (const x of groups.get(best) ?? []) {
    const date = toYmd(x.baseYmd);
    const rate = Number(x.cnctrRate);
    if (
      date &&
      String(x.cnctrRate ?? "").trim() !== "" &&
      Number.isFinite(rate)
    )
      byDate.set(date, rate);
  }
  const days: TourCrowdDay[] = [...byDate]
    .filter(([date]) => date >= today)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rate]) => ({ date, rate }));
  return { name: best, days };
}

/** 한국관광공사 집중률 찾기 (PoC getCrowd). 한 곳을 고르지 못하면 null. 외부 실패는 TourApiError */
export async function findCrowd(
  place: TourPlace,
  key: string,
  now = new Date(),
): Promise<TourCrowd | null> {
  const keyword = place.ko.replace(/\s*\(.*?\)\s*/g, "").trim();
  if (keyword.length < 2 || !place.signgu) return null;
  const me = crowdName(keyword);
  const get = (name: string) =>
    fetchTourItems(
      tourApiUrl("TatsCnctrRateService/tatsCnctrRatedList", key, {
        numOfRows: "100",
        pageNo: "1",
        areaCd: place.signgu.slice(0, 2),
        signguCd: place.signgu,
        tAtsNm: name,
      }),
      TOUR_CROWD_SECONDS,
    );
  // 검색어 후보: 이름 → (3글자보다 길면) 정규화한 앞 3글자 → 앞의 도시 이름을 뗀 이름. 앞 후보에서 한 곳을 고르면 멈춘다
  const names = [
    ...new Set(
      [
        keyword,
        keyword.length > 3 ? me.slice(0, 3) : "",
        withoutCity(keyword, place.locKo) ?? "",
      ].filter((n) => n.length >= 2),
    ),
  ];
  const today = seoulDate(now);
  for (const name of names) {
    const crowd = pickCrowd(await get(name), me, today);
    if (crowd) return crowd;
  }
  return null;
}

/** GET /api/tour/crowd 처리. 응답 { name, days } · 결과 없음 { empty: true } */
export async function tourCrowdResponse(request: Request): Promise<Response> {
  const query = parseTourQuery(request, false);
  if ("error" in query) return query.error;
  const key = tourApiKey();
  if (!key) return tourNotConfigured();
  let crowd: TourCrowd | null;
  try {
    crowd = await findCrowd(query.place, key);
  } catch {
    return tourUnavailable();
  }
  return tourJson(
    crowd && crowd.days.length > 0 ? crowd : { empty: true },
    TOUR_CROWD_SECONDS,
  );
}
