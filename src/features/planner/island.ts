import { PLANNER_ORIGINS } from "./regions";

// 투어 플래너 섬 여행(제주 · 울릉) 규칙. PoC Tour Planner.dc.html에서 옮긴 순수 함수만 둔다.
//   - 섬 판정(PoC isJejuTrip · ulleungTrip · ferryVals의 isl): 도착 도시가 제주 · 서귀포면 제주, 울릉이면 울릉
//   - 울릉 출발지(PoC oKey · syncUlleung · originOptions 울릉 분기): 울릉 여행이면 울릉 항로 항구만(항해 시간이 짧은 순),
//     아니면 울릉 항로 항구를 쓰지 않는다. 울릉을 고르면 한 번 안내하고 출발지를 포항여객선터미널로 바꾼다
//   - 울릉 배 본 구간(PoC accessMin 울릉 분기): 항구별 고정 항해 시간(sailMin) + 승선 수속 40분. 거리 비례 식을 쓰지 않는다

export type Island = "jeju" | "ulleung";

/** 도착 도시(한국어 이름)의 섬. 제주 · 서귀포 = 제주, 울릉 = 울릉, 그 밖은 null */
export function islandOf(city: string | null | undefined): Island | null {
  if (city === "제주" || city === "서귀포") return "jeju";
  if (city === "울릉") return "ulleung";
  return null;
}

/** 울릉 항로 승선 수속(분, PoC accessMin) */
export const ULLEUNG_BOARD_MIN = 40;
/** 항해 시간이 없는 항구의 기본값(분, PoC accessMin `origin.sailMin||190`) */
export const ULLEUNG_SAIL_DEFAULT = 190;
/** 울릉 여행의 기본 출발 항구(PoC oKey · syncUlleung) */
export const ULLEUNG_DEFAULT_PORT = "pohangPort";
/** 울릉이 아닌 여행에서 울릉 항로 항구 대신 쓰는 출발지(PoC oKey) */
const MAINLAND_DEFAULT = "seoul";

const isUlleungPort = (key: string | null | undefined) =>
  !!key && PLANNER_ORIGINS[key]?.route === "ulleung";

/** 울릉 배 본 구간 분 = 승선 수속 40 + 항구별 항해 시간(PoC accessMin(gw, '울릉', 'ship')) */
export function ulleungSailMin(port: { sailMin?: number } | undefined): number {
  return ULLEUNG_BOARD_MIN + (port?.sailMin || ULLEUNG_SAIL_DEFAULT);
}

/** 울릉 항로 항구 key. 항해 시간이 짧은 순(PoC originOptions 울릉 정렬 · ulNoticePorts) */
export function ulleungPorts(): string[] {
  return Object.keys(PLANNER_ORIGINS)
    .filter(isUlleungPort)
    .sort(
      (a, b) =>
        (PLANNER_ORIGINS[a].sailMin ?? 999) -
        (PLANNER_ORIGINS[b].sailMin ?? 999),
    );
}

/**
 * 계산에 쓰는 출발지 · 귀가지 key(PoC oKey). 저장된 값은 그대로 두고 읽을 때만 고친다.
 * 울릉 여행이면 울릉 항로 항구만(아니면 포항여객선터미널), 아니면 울릉 항로 항구 대신 서울역
 */
export function tripOriginKey(key: string | null, ulleung: boolean): string {
  const k = key || MAINLAND_DEFAULT;
  if (ulleung) return isUlleungPort(k) ? k : ULLEUNG_DEFAULT_PORT;
  return isUlleungPort(k) ? MAINLAND_DEFAULT : k;
}

/**
 * 울릉을 고를 때 바꿀 출발지 · 귀가지(PoC syncUlleung). 출발지가 울릉 항로 항구가 아니면 포항여객선터미널로,
 * 귀가지가 있는데 울릉 항로 항구가 아니면 「출발지와 동일」(null)로. 바꿀 것이 없으면 빈 객체
 */
export function ulleungSync(
  origin: string,
  originEnd: string | null,
): { origin?: string; originEnd?: null } {
  const fix: { origin?: string; originEnd?: null } = {};
  if (!isUlleungPort(origin)) fix.origin = ULLEUNG_DEFAULT_PORT;
  if (originEnd && !isUlleungPort(originEnd)) fix.originEnd = null;
  return fix;
}
