// 시티투어 경유지 → 투어 플래너 장소 대조. 순수 함수만 둔다.
// 규칙은 팀장 목업(2026-09-27 standalone 「Tour Navigator.html」)의 투어 플래너 addCityTour를 그대로 옮겼다.
// scripts/build-citytour.mjs가 이 파일을 불러 노선마다 담을 장소를 미리 계산한다(Node 형식 제거로 바로 읽는다).
// 그래서 이 파일은 다른 모듈을 import하지 않고, 형식 제거로 지울 수 없는 문법(enum 등)을 쓰지 않는다.

/** 대조에 쓰는 장소 필드. PlannerPlace + 장소.csv 시티투어경유(ct) */
export type MatchPlace = {
  id: string;
  ko: string;
  cat: string;
  locKo: string;
  /** 도시 고르기 도시(전용 화면 장소만 전용 화면 도시 이름) */
  pickCity?: string;
  /** 시티투어 경유지로 추가된 장소 */
  ct?: boolean;
};

/** 전용 화면이 있는 도시. 목업은 이 도시의 노선이면 그 화면 장소만 후보로 본다 */
export const DEDICATED_CITIES: readonly string[] = [
  "경주",
  "거제",
  "영월",
  "서울",
  "제주",
  "부산",
];

/** 이름 비교용으로 괄호 · 끝말(출발 · 도착 · 입구 …) · 띄어쓰기 · 문장부호를 뗀다 */
export function normalizeName(value: string): string {
  return value
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/(출발|도착|경유|하차|승차|정류장|입구|주차장)$/g, "")
    .replace(/[\s·.,]/g, "");
}

/** 경유지 문자열을 정류장 이름 목록으로 나눈다. 번호 · 괄호 · 소요 시간 · 「구간:」 머리를 뗀다 */
export function splitStops(route: string): string[] {
  return route
    .split(/→|->|>|⇒|,|\/|&|및/)
    .map((s) =>
      s
        .replace(/[①-⑳❶-❿]/g, "")
        .replace(/\(.*?\)|\[.*?\]/g, "")
        .replace(/[()（）]/g, " ")
        .replace(/^\d+[.)]\s*/, "")
        .replace(/\d+\s*분.*$/, "")
        .replace(/^[^:：]*[:：]\s*/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((s) => s.length >= 2);
}

/** 관광지가 아닌 정류장(관공서 · 역 · 터미널 · 식사 · 숙소 · 집결 …). 대조하지 않는다 */
const NOT_SIGHT =
  /(시청|군청|구청|도청|청사|주민센터|역$|공항|터미널|정류장|정류소|승강장|주차장|휴게소|중식|점심|석식|조식|식당|자유시간|휴식|하차|승차|환승|출발|도착|호텔|리조트|숙소|귀가|해산|집결|탑승)/;

/**
 * 노선의 후보 장소. 전용 화면 도시면 그 화면 장소(pickCity),
 * 아니면 그 시군(locKo) 장소, 그것도 없으면 전체 장소(목업 places() · inReg 규칙)
 */
export function stopPool<T extends MatchPlace>(
  region: string,
  places: readonly T[],
): readonly T[] {
  const base = DEDICATED_CITIES.includes(region)
    ? places.filter((p) => p.pickCity === region)
    : places;
  const inRegion = base.filter((p) => p.locKo === region);
  return inRegion.length > 0 ? inRegion : base;
}

/**
 * 경유지마다 이름이 같은 장소 → 시티투어 경유 장소 중 이름을 품은 것 → 이름이 서로를 품는 장소 순으로 찾는다.
 * 숙박 장소는 담지 않는다. 같은 장소는 한 번만. 찾지 못한 경유지는 missed에 모은다.
 * 목업과 다른 점 하나: 노선 지역 이름과 같은 경유지(「서울 → … → 서울」의 서울)는 출발 · 도착 도시라서 대조하지 않는다.
 * 목업 규칙대로 두면 이름에 「서울」이 든 장소(남산서울타워)가 대부도 · 광명 노선에도 담긴다
 */
export function matchStops<T extends MatchPlace>(
  route: string,
  pool: readonly T[],
  region = "",
): { ids: string[]; missed: string[] } {
  const ids: string[] = [];
  const missed: string[] = [];
  const regionKey = normalizeName(region);
  for (const stop of splitStops(route)) {
    const key = normalizeName(stop);
    if (key.length < 2 || NOT_SIGHT.test(stop) || key === regionKey) continue;
    const hit =
      pool.find((p) => normalizeName(p.ko) === key) ??
      pool.find((p) => p.ct && normalizeName(p.ko).includes(key)) ??
      pool.find((p) => {
        const name = normalizeName(p.ko);
        return name.length >= 2 && (name.includes(key) || key.includes(name));
      });
    if (!hit) missed.push(stop);
    else if (!/stay/.test(hit.cat) && !ids.includes(hit.id)) ids.push(hit.id);
  }
  return { ids, missed };
}
