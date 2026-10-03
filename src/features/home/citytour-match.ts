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
  /** 도시 고르기 도시(planner data.ts pickCity. 전용 화면 도시는 그 도시의 전국 목록 장소도 이 값을 갖는다) */
  pickCity?: string;
  /** 시티투어 경유지로 추가된 장소 */
  ct?: boolean;
};

/**
 * 전용 화면이 있는 도시. 목업은 이 도시의 노선이면 그 화면 장소만 후보로 본다.
 * 앱은 pickCity를 그 도시의 전국 목록 장소에도 주므로(scripts/build-planner.mjs) 후보가 도시 고르기 목록과 같다
 */
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

/**
 * 화살표 없이 번호로만 이은 경유지(「01 제주항국제여객터미널 02 제주항연안여객터미널 03 김만덕기념관 …」, 제주 순환형코스).
 * 01(1) · 02(2) 번호가 모두 공백 앞에 있을 때만 번호 목록으로 본다(이름 속 숫자는 건드리지 않게)
 */
const NUMBERED_LIST = /(?:^|\s)0?1\s+\S[\s\S]*\s0?2\s+\S/;

/**
 * 경유지 문자열을 정류장 이름 목록으로 나눈다. 번호 · 괄호 · 소요 시간 · 「구간:」 머리를 뗀다.
 * 포항 코스는 _, 대청호코스는 ↔, 광양 코스는 전각 ＆로 경유지를 잇는다. ~ · 가운뎃점은 괄호 속 기간이나 이름 안에 쓰여 나누지 않는다
 */
export function splitStops(route: string): string[] {
  // 번호 목록이면 번호 자리를 화살표로 바꿔 아래 나누기에 맡긴다
  const text = NUMBERED_LIST.test(route)
    ? route.replace(/(?:^|\s)\d{1,2}\s+(?=\S)/g, " → ")
    : route;
  return text
    .split(/→|->|>|⇒|↔|⇔|,|\/|&|＆|_|\+|및/)
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
export const NOT_SIGHT =
  /(시청|군청|구청|도청|청사|주민센터|역$|공항|터미널|정류장|정류소|승강장|주차장|휴게소|중식|점심|석식|조식|식당|자유시간|휴식|하차|승차|환승|출발|도착|호텔|리조트|숙소|귀가|해산|집결|탑승)/;

/**
 * 노선의 후보 장소. 전용 화면 도시면 도시 고르기 목록 장소(pickCity),
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
 * 여러 도시를 도는 노선의 대조 풀: 도시마다 stopPool을 모아 한 번씩. 실제 여행지(visits)로 부른다.
 * 서울 출발 EG투어버스는 서울 장소가 아니라 파주 · 시흥 · 화성 장소와 맞춰야 해서(2026-10-03) 운영 도시는 visits에 든 때만 들어간다
 */
export function visitPool<T extends MatchPlace>(
  cities: readonly string[],
  places: readonly T[],
): readonly T[] {
  const seen = new Map<string, T>();
  for (const city of new Set(cities))
    for (const p of stopPool(city, places))
      if (!seen.has(p.id)) seen.set(p.id, p);
  return [...seen.values()];
}

/** 식당 · 먹거리 분류. 경유지 이름이 이 장소 이름의 앞부분일 뿐이면(「해운대」 → 해운대가야밀면) 대조하지 않는다 */
const FOOD = "food";
/** 먹거리 장소를 부분 이름으로 대조해도 되는 경유지(시장 · 먹자골목 · 음식 거리) */
const FOOD_STOP = /(시장|골목|거리)$/;

/**
 * 규칙보다 먼저 쓰는 경유지 대조 표. 「지역|정규화 경유지 이름」 → 장소 이름(ko). 눈으로 보고 고정한 곳만 둔다(대표 결정 2026-09-28)
 */
export const CITYTOUR_MATCH: Readonly<Record<string, string>> = {
  // 으능정이 스카이로드는 분류가 먹거리이고 경유지 이름이 장소 이름의 앞부분이라, 식당을 막는 규칙(pickPlace)에 함께 막힌다.
  // 으능정이 거리의 LED 천장(관광지)이라 되살린다
  "대전|으능정이": "으능정이 스카이로드",
  // 정림사지박물관과 정림사지5층석탑이 둘 다 후보인데, 이름 길이로는 박물관이 골라진다. 정림사지를 대표하는 것은 석탑이다
  "부여|정림사지": "정림사지5층석탑",
  // 경유지 표기와 공식 이름의 낱말 순서가 달라 서로를 품지 않는 곳(2026-10-03)
  "서울|시흥프리미엄아울렛": "신세계 프리미엄아울렛 시흥",
  "서울|서해랑케이블카": "제부도해상케이블카 서해랑 전곡정류장",
  "서울|IKEA": "이케아 광명점",
  "인천|을왕리해변": "을왕리해수욕장",
};

/**
 * 경유지 하나(정규화 이름 key)에 맞는 장소. 없거나 애매하면 null, 숙박 장소와 같은 이름이면 "stay"
 *  1) 이름이 같은 장소(숙박이면 담지 않는다)
 *  2) 이름이 서로를 품는 장소(숙박 제외). 관광지(먹거리 밖)가 있으면 관광지 중에서만 고른다.
 *     먹거리 장소는 시티투어 경유(ct) 장소이거나, 경유지 이름이 그 장소 이름을 다 품거나, 장소 이름이 경유지 이름으로 끝나거나
 *     (「광복로」 → 부산 광복로), 경유지가 시장 · 골목 · 거리일 때만 후보다. 「해운대」 → 해운대가야밀면 같은 앞부분 대조를 막는다
 *  3) 후보 중 시티투어 경유(ct) 장소 → 이름 길이 차이가 가장 작은 장소 순. 1 · 2등이 같은 순위면 애매해서 대조하지 않는다
 */
function pickPlace<T extends MatchPlace>(
  key: string,
  pool: readonly T[],
): T | "stay" | null {
  const exact = pool.find((p) => normalizeName(p.ko) === key);
  if (exact) return /stay/.test(exact.cat) ? "stay" : exact;
  const candidates = pool
    .map((p) => ({ p, name: normalizeName(p.ko) }))
    .filter(
      ({ p, name }) =>
        name.length >= 2 &&
        !/stay/.test(p.cat) &&
        (name.includes(key) || key.includes(name)) &&
        (p.cat !== FOOD ||
          p.ct ||
          key.includes(name) ||
          name.endsWith(key) ||
          FOOD_STOP.test(key)),
    );
  const sights = candidates.filter(({ p }) => p.cat !== FOOD);
  const pick = sights.length > 0 ? sights : candidates;
  if (pick.length === 0) return null;
  const rank = ({ p, name }: { p: T; name: string }) => [
    p.ct ? 0 : 1,
    Math.abs(name.length - key.length),
  ];
  const sorted = [...pick].sort((a, b) => {
    const [x0, x1] = rank(a);
    const [y0, y1] = rank(b);
    return x0 - y0 || x1 - y1;
  });
  if (sorted.length > 1) {
    const [a0, a1] = rank(sorted[0]);
    const [b0, b1] = rank(sorted[1]);
    if (a0 === b0 && a1 === b1) return null;
  }
  return sorted[0].p;
}

/**
 * 경유지마다 CITYTOUR_MATCH 표를 먼저 보고, 없으면 pickPlace로 장소를 찾는다. 숙박 장소는 담지 않는다. 같은 장소는 한 번만. 찾지 못한(애매한) 경유지는 missed에 모은다.
 * 목업(이름이 같은 장소 → 시티투어 경유 장소 중 이름을 품은 것 → 이름이 서로를 품는 첫 장소)과 다른 점:
 *  - 노선 지역 이름과 같은 경유지(「서울 → … → 서울」의 서울)는 출발 · 도착 도시라서 대조하지 않는다.
 *    목업 규칙대로 두면 이름에 「서울」이 든 장소(남산서울타워)가 대부도 · 광명 노선에도 담긴다
 *  - 부분 이름 대조는 관광지를 먼저 보고, 먹거리는 좁게, 여러 후보면 이름이 가장 가까운 곳, 애매하면 대조하지 않는다.
 *    목업 규칙대로 두면 「해운대(미포)」가 목록 순서상 먼저 나온 해운대가야밀면(식당)에 대조된다(대표 결정 2026-09-28)
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
    const fixed = CITYTOUR_MATCH[`${region}|${key}`];
    const hit = fixed
      ? (pool.find((p) => p.ko === fixed) ?? null)
      : pickPlace(key, pool);
    if (hit === null) missed.push(stop);
    else if (hit !== "stay" && !ids.includes(hit.id)) ids.push(hit.id);
  }
  return { ids, missed };
}

/**
 * 실제 여행지가 운영 도시(region)와 다른 노선 → 실제 여행지 도시들(경유지 순). 키는 「운영 도시|노선명」.
 * 원천(전국시티투어정보표준데이터)의 도시는 운영 지자체라, 서울에서 출발해 경기도 각지를 도는 EG투어버스는 서울로 집계됐다(2026-10-02).
 * 경유지를 노선마다 읽고 정했다(자동 대조는 동명 장소 오탐이 많아 쓰지 않는다: 홍성 죽도 → 울릉 죽도, 화성행궁 → 화성시).
 * 운영 도시 안을 도는 광역 노선(대전 광역투어 등)은 운영 도시도 함께 둔다. 표에 없는 노선은 운영 도시 하나다(tourVisits)
 */
export const TOUR_VISITS: Readonly<Record<string, readonly string[]>> = {
  // EG투어버스(서울 출발 · 경기 각지)
  "서울|EG투어버스 A코스": ["파주"], // DMZ · 오두산 통일전망대 · JSA
  "서울|EG투어버스 B코스": ["안산", "화성"], // 대부도 동춘서커스(안산) · 서해랑케이블카(화성 전곡항 정류장)
  "서울|EG투어버스 C코스": ["광명"], // 광명동굴 · 도덕산
  "서울|EG투어버스 D코스": ["시흥", "화성"], // 시흥 아울렛 · 웨이브파크 · 전곡항(화성)
  "서울|EG투어버스 E코스": ["부천"],
  "서울|EG투어버스 F코스": ["시흥", "안산", "화성"], // 시흥 아울렛 · 서해랑 케이블카(안산) · 율암온천(화성)
  "서울|EG투어버스 G코스": ["김포"],
  "서울|EG투어버스 H코스": ["수원"], // 봉녕사 · 남문시장 · 화성행궁(수원)
  "서울|EG투어버스 I코스": ["평택", "광명"],
  "서울|EG투어버스 J코스": ["용인", "수원"], // 한국민속촌(용인) · 수원화성
  "서울|EG투어버스 K 코스": ["포천"],
  "서울|EG투어버스 L코스": ["양평"], // 양떼목장 · 두물머리
  // 광역 노선(운영 도시 + 이웃 도시)
  "대전|광역투어(첫주, 일)": ["대전", "논산"],
  "대전|광역투어(둘째주, 토)": ["대전", "청주"],
  "대전|광역투어(둘째주, 일)": ["대전", "세종"],
  "대전|광역투어(셋째주, 토)": ["대전", "금산"],
  "대전|광역투어(셋째주, 일)": ["대전", "공주"],
  "대전|광역투어(넷재주, 토)": ["대전", "부여"],
  "대전|광역투어(넷재주, 일)": ["대전", "보은"],
  "대전|광역투어(다섯째주, 토)": ["대전", "영동"],
  "대전|광역투어(다섯째주, 일)": ["대전", "계룡"],
  "세종|천안연계투어": ["세종", "천안"],
  "완주|완주힐링로드시티투어 1코스": ["완주", "전주"], // 전주역 출발 · 전주한옥마을 경유
  "완주|완주힐링로드시티투어 2코스": ["완주", "전주"],
  "서천|광역코스": ["서천", "군산"],
};

/** 노선의 실제 여행지 도시들. 표(TOUR_VISITS)에 있으면 그것, 없으면 운영 도시 하나 */
export function tourVisits(region: string, name: string): string[] {
  return [...(TOUR_VISITS[`${region}|${name}`] ?? [region])];
}
