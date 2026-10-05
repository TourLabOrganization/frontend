import { PLANNER_ORIGINS } from "./regions";

// 투어 플래너 섬 여행(제주 · 울릉 · 백령도 · 연평도) 규칙. PoC Tour Planner.dc.html에서 옮긴 순수 함수만 둔다.
//   - 섬 판정(PoC isJejuTrip · ulleungTrip · ferryVals의 isl): 도착 도시가 제주 · 서귀포면 제주, 울릉이면 울릉,
//     백령도 · 연평도면 그 섬(앱에서 더한 섬, PoC에 없다)
//   - 항구 섬(울릉 · 백령도 · 연평도): 육지와 여객선으로만 이어진 섬. 섬마다 그 항로 전용 출발 항구(regions.json origins의 route)만 쓴다
//     · 출발지(PoC oKey · syncUlleung · originOptions 울릉 분기): 항구 섬 여행이면 그 섬 항로 항구만(항해 시간이 짧은 순),
//       아니면 항구 섬 항로 항구를 쓰지 않는다. 섬을 고르면 한 번 안내하고 출발지를 그 섬의 기본 항구로 바꾼다
//     · 배 본 구간(PoC accessMin 울릉 분기): 항구별 고정 항해 시간(sailMin) + 승선 수속. 거리 비례 식을 쓰지 않는다
//   - 울릉은 PoC 값 그대로(포항 기본 · 수속 40분 · 항해 시간이 없으면 190분).
//     백령도 · 연평도는 인천항 연안여객터미널 한 곳에서만 떠나고, 수속은 30분으로 둔다(앱에서 정한 값. 항구 하나 · 쾌속선이라 울릉보다 짧게)

export type Island = "jeju" | "ulleung" | "baengnyeong" | "yeonpyeong";

/** 여객선으로만 들어가는 섬(항구 섬). 제주는 항공 · 카페리가 있어 넣지 않는다 */
export type PortIsland = Exclude<Island, "jeju">;

type PortIslandConfig = {
  /** 도착 도시(한국어 이름) */
  city: string;
  /** 출발지(regions.json origins)의 route 값 */
  route: string;
  /** 섬 여행의 기본 출발 항구 key */
  defaultPort: string;
  /** 승선 수속(분) */
  boardMin: number;
  /** 항해 시간이 없는 항구의 기본값(분) */
  sailDefault: number;
};

/** 항구 섬 설정. 순서는 안내 · 문서 순서(울릉 → 백령도 → 연평도) */
export const PORT_ISLANDS: Readonly<Record<PortIsland, PortIslandConfig>> = {
  ulleung: {
    city: "울릉",
    route: "ulleung",
    defaultPort: "pohangPort",
    boardMin: 40,
    sailDefault: 190,
  },
  baengnyeong: {
    city: "백령도",
    route: "baengnyeong",
    defaultPort: "incheonPortBaengnyeong",
    boardMin: 30,
    sailDefault: 230,
  },
  yeonpyeong: {
    city: "연평도",
    route: "yeonpyeong",
    defaultPort: "incheonPortYeonpyeong",
    boardMin: 30,
    sailDefault: 150,
  },
};

const PORT_ISLAND_KEYS = Object.keys(PORT_ISLANDS) as PortIsland[];

/** 도착 도시(한국어 이름)의 섬. 제주 · 서귀포 = 제주, 울릉 · 백령도 · 연평도 = 그 섬, 그 밖은 null */
export function islandOf(city: string | null | undefined): Island | null {
  if (city === "제주" || city === "서귀포") return "jeju";
  return portIslandOf(city);
}

/** 도착 도시가 항구 섬(울릉 · 백령도 · 연평도)이면 그 섬, 아니면 null */
export function portIslandOf(
  city: string | null | undefined,
): PortIsland | null {
  if (!city) return null;
  return PORT_ISLAND_KEYS.find((k) => PORT_ISLANDS[k].city === city) ?? null;
}

/** 항구 섬인지(제주 · null은 아니다) */
export function isPortIsland(
  island: Island | null | undefined,
): island is PortIsland {
  return !!island && island !== "jeju";
}

/** 출발지 route가 항구 섬 항로인지(제주 항로 · 없음은 아니다) */
export function isPortRoute(route: string | null | undefined): boolean {
  return (
    !!route && PORT_ISLAND_KEYS.some((k) => PORT_ISLANDS[k].route === route)
  );
}

/** 출발지 key가 그 섬 항로 항구인지. island를 빼면 어느 항구 섬이든 */
function isIslandPort(
  key: string | null | undefined,
  island?: PortIsland,
): boolean {
  if (!key) return false;
  const route = PLANNER_ORIGINS[key]?.route;
  return island ? route === PORT_ISLANDS[island].route : isPortRoute(route);
}

/** 그 섬 항로 항구 key. 항해 시간이 짧은 순(PoC originOptions 울릉 정렬 · ulNoticePorts) */
export function islandPorts(island: PortIsland): string[] {
  return Object.keys(PLANNER_ORIGINS)
    .filter((k) => isIslandPort(k, island))
    .sort(
      (a, b) =>
        (PLANNER_ORIGINS[a].sailMin ?? 999) -
        (PLANNER_ORIGINS[b].sailMin ?? 999),
    );
}

/** 배 본 구간 분 = 승선 수속 + 항구별 항해 시간(PoC accessMin(gw, '울릉', 'ship')) */
export function islandSailMin(
  island: PortIsland,
  port: { sailMin?: number } | undefined,
): number {
  const c = PORT_ISLANDS[island];
  return c.boardMin + (port?.sailMin || c.sailDefault);
}

/** 항구 섬이 아닌 여행에서 항구 섬 항로 항구 대신 쓰는 출발지(PoC oKey) */
const MAINLAND_DEFAULT = "seoul";

/** 섬 인자 읽기. true는 울릉(예전 boolean 인자), false · null · 제주는 육지(null) */
export function portIslandArg(
  island: Island | boolean | null | undefined,
): PortIsland | null {
  if (island === true) return "ulleung";
  if (island === false || island === undefined) return null;
  return isPortIsland(island) ? island : null;
}

/**
 * 계산에 쓰는 출발지 · 귀가지 key(PoC oKey). 저장된 값은 그대로 두고 읽을 때만 고친다.
 * 항구 섬 여행이면 그 섬 항로 항구만(아니면 그 섬의 기본 항구), 아니면 항구 섬 항로 항구 대신 서울역.
 * island: 항구 섬(true는 울릉, 예전 boolean 인자와 같다). 제주 · null · false는 육지와 같다
 */
export function tripOriginKey(
  key: string | null,
  island: Island | boolean | null,
): string {
  const k = key || MAINLAND_DEFAULT;
  const pi = portIslandArg(island);
  if (pi) return isIslandPort(k, pi) ? k : PORT_ISLANDS[pi].defaultPort;
  return isIslandPort(k) ? MAINLAND_DEFAULT : k;
}

/**
 * 항구 섬을 고를 때 바꿀 출발지 · 귀가지(PoC syncUlleung). 출발지가 그 섬 항로 항구가 아니면 기본 항구로,
 * 귀가지가 있는데 그 섬 항로 항구가 아니면 「출발지와 동일」(null)로. 바꿀 것이 없으면 빈 객체
 */
export function islandSync(
  island: PortIsland,
  origin: string,
  originEnd: string | null,
): { origin?: string; originEnd?: null } {
  const fix: { origin?: string; originEnd?: null } = {};
  if (!isIslandPort(origin, island))
    fix.origin = PORT_ISLANDS[island].defaultPort;
  if (originEnd && !isIslandPort(originEnd, island)) fix.originEnd = null;
  return fix;
}

// ── 울릉 이름(예전 API). 위 일반 함수를 울릉으로 부른다 ─────────────────

/** 울릉 항로 승선 수속(분, PoC accessMin) */
export const ULLEUNG_BOARD_MIN = PORT_ISLANDS.ulleung.boardMin;
/** 항해 시간이 없는 항구의 기본값(분, PoC accessMin `origin.sailMin||190`) */
export const ULLEUNG_SAIL_DEFAULT = PORT_ISLANDS.ulleung.sailDefault;
/** 울릉 여행의 기본 출발 항구(PoC oKey · syncUlleung) */
export const ULLEUNG_DEFAULT_PORT = PORT_ISLANDS.ulleung.defaultPort;

/** 울릉 배 본 구간 분 = 승선 수속 40 + 항구별 항해 시간 */
export function ulleungSailMin(port: { sailMin?: number } | undefined): number {
  return islandSailMin("ulleung", port);
}

/** 울릉 항로 항구 key. 항해 시간이 짧은 순 */
export function ulleungPorts(): string[] {
  return islandPorts("ulleung");
}

/** 울릉을 고를 때 바꿀 출발지 · 귀가지(PoC syncUlleung) */
export function ulleungSync(
  origin: string,
  originEnd: string | null,
): { origin?: string; originEnd?: null } {
  return islandSync("ulleung", origin, originEnd);
}
