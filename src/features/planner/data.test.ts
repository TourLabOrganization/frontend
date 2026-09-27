import { describe, expect, it } from "vitest";
import {
  CITY_GROUPS,
  PLACE_COUNT_BY_CITY,
  PLANNER_PLACES,
  placesInScope,
} from "./data";
import { BADGE_KEYS, hasBadge } from "./badges";
import { sortPlaces } from "./list-order";
import {
  CITY_HUBS,
  CITY_INFO,
  PLACE_COUNT_BY_CITY as REGION_PLACE_COUNTS,
  PLANNER_ORIGINS,
  REGION_KEYS,
  REGIONS,
} from "./regions";

// 숫자는 PoC(Tour-Navigator-App main f44eb97) Tour Planner.dc.html을 목업 규칙대로 계산한 값이다
// (지도 권역 묶음 = MACRO_OF, 도시 고르기 묶음 = cityGroups). 목업(2026-09-27 12:57 내보내기) 화면 숫자와 같다.
// 도시별 장소 수만 목업과 다르다: 전용 화면 도시(서울 · 부산 · 제주 · 영월 · 경주 · 거제)의 전국 목록 장소도 그 도시에 넣는다
// (대표 결정 2026-09-28, scripts/build-planner.mjs). 목업 cityRows는 그 447곳을 전국 보기에만 넣었다.

// 권역별 도시 수: REG 도시 + MACRO_OF에만 있는 도시(_mcExtra)
const REGION_CITY_COUNT = {
  capital: 33,
  gangwon: 18,
  chungcheong: 28,
  daegyeong: 24,
  dongnam: 20,
  honam: 37,
  jeju: 2,
};

describe("플래너 데이터", () => {
  it("장소는 3,118곳이고 id가 겹치지 않는다", () => {
    expect(PLANNER_PLACES).toHaveLength(3118);
    expect(new Set(PLANNER_PLACES.map((p) => p.id)).size).toBe(3118);
  });

  it("도시 고르기 장소 수: 전용 화면 도시는 전용 화면 장소 + 같은 도시의 전국 목록 장소", () => {
    expect(
      Object.fromEntries(
        ["서울", "부산", "제주", "영월", "경주", "거제"].map((c) => [
          c,
          PLACE_COUNT_BY_CITY.get(c),
        ]),
      ),
    ).toEqual({
      서울: 263,
      부산: 186,
      제주: 173,
      영월: 31,
      경주: 73,
      거제: 45,
    });
  });

  it("도시 고르기 장소 수 + 전국에만 속한 장소 = 전체, 도시 보기는 그 도시 장소만", () => {
    const sum = [...PLACE_COUNT_BY_CITY.values()].reduce((a, b) => a + b, 0);
    const nationOnly = PLANNER_PLACES.filter((p) => !p.pickCity).length;
    expect(PLACE_COUNT_BY_CITY.size).toBe(124);
    expect(sum).toBe(3117);
    expect(nationOnly).toBe(1);
    expect(sum + nationOnly).toBe(3118);
    for (const [city, n] of PLACE_COUNT_BY_CITY) {
      const list = placesInScope({ kind: "city", city });
      expect(list, city).toHaveLength(n);
      expect(list.every((p) => p.locKo === city)).toBe(true);
    }
    expect(placesInScope({ kind: "nation", region: null })).toHaveLength(3118);
  });

  it("권역 묶음 이름과 장소 수가 목업 지도와 같다", () => {
    expect(REGIONS.map((r) => r.ko)).toEqual([
      "수도권",
      "강원권",
      "충청권",
      "경북권",
      "경남권",
      "전라권",
      "제주권",
    ]);
    const byRegion = Object.fromEntries(
      REGION_KEYS.map((k) => [
        k,
        placesInScope({ kind: "nation", region: k }).length,
      ]),
    );
    expect(byRegion).toEqual({
      capital: 690,
      gangwon: 372,
      chungcheong: 441,
      daegyeong: 369,
      dongnam: 641,
      honam: 432,
      jeju: 173,
    });
  });

  it("도시 고르기 묶음별 도시 수는 목업과 같고, 장소 수는 권역 장소 수와 같다(서울숲 중복 1곳 제외)", () => {
    expect(
      Object.fromEntries(
        CITY_GROUPS.map((g) => [
          g.key,
          [
            g.cities.length,
            g.cities.reduce((s, c) => s + PLACE_COUNT_BY_CITY.get(c)!, 0),
          ],
        ]),
      ),
    ).toEqual({
      capital: [21, 689],
      gangwon: [18, 372],
      chungcheong: [19, 441],
      daegyeong: [16, 369],
      dongnam: [19, 641],
      honam: [30, 432],
      jeju: [1, 173],
    });
  });

  it("도시 고르기 묶음: 권역 대표 도시가 먼저, 나머지는 장소 수 많은 순, 모든 도시가 한 번씩", () => {
    const pins = ["서울", "강릉", "대전", "대구", "부산", "전주", "제주"];
    for (const g of CITY_GROUPS) {
      if (g.key === "etc") continue;
      const pin = pins.find((c) => g.cities.includes(c));
      if (pin) expect(g.cities[0], g.key).toBe(pin);
      const rest = g.cities.filter((c) => c !== pin);
      const counts = rest.map((c) => PLACE_COUNT_BY_CITY.get(c)!);
      expect(counts, g.key).toEqual([...counts].sort((a, b) => b - a));
    }
    const all = CITY_GROUPS.flatMap((g) => g.cities);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(PLACE_COUNT_BY_CITY.size);
  });

  it("출발지는 출발지.csv 61곳이고 수단에 전철(metro)이 들어 있다", () => {
    expect(Object.keys(PLANNER_ORIGINS)).toHaveLength(61);
    expect(PLANNER_ORIGINS.seoul.modes).toEqual(["ktx", "metro"]);
  });

  it("모든 장소에 도시와 권역이 있고, 도시는 그 권역의 목록에 있다", () => {
    const regionOf = new Map(
      REGIONS.flatMap((r) => r.cities.map((c) => [c, r.key] as const)),
    );
    const missing = PLANNER_PLACES.filter(
      (p) => !p.locKo || !p.macro || regionOf.get(p.locKo) !== p.macro,
    );
    expect(missing).toEqual([]);
  });

  // 데이터랩 인기 · 관광특구 · 관광단지는 data-server(develop ac9eb34) popRank · zone 기준
  it("배지 필터 장소 수: 데이터랩 인기 173 · 유네스코 69 · 100선 99 · 열린관광지 99 · 관광특구 · 관광단지 210", () => {
    expect(
      Object.fromEntries(
        BADGE_KEYS.map((b) => [
          b,
          PLANNER_PLACES.filter((p) => hasBadge(p, b)).length,
        ]),
      ),
    ).toEqual({ pop: 173, un: 69, k100: 99, bf: 99, zone: 210 });
  });

  it("좌표는 한국 안(위도 33~39 · 경도 124~132)이다", () => {
    const outside = PLANNER_PLACES.filter(
      (p) => p.lat < 33 || p.lat > 39 || p.lng < 124 || p.lng > 132,
    );
    expect(outside).toEqual([]);
  });

  it("권역은 7개이고 권역별 도시 수가 REG + MACRO_OF와 같다", () => {
    expect(REGIONS.map((r) => r.key)).toEqual([...REGION_KEYS]);
    expect(
      Object.fromEntries(REGIONS.map((r) => [r.key, r.cities.length])),
    ).toEqual(REGION_CITY_COUNT);
  });

  it("장소가 있는 도시는 가운데 좌표가 있고, 관문은 PoC REGION_HUB에 없는 14곳 말고 모두 있다", () => {
    const cities = new Set(PLANNER_PLACES.map((p) => p.locKo));
    for (const city of cities) {
      expect(CITY_INFO[city]?.lat, city).toBeTypeOf("number");
      expect(CITY_INFO[city]?.lng, city).toBeTypeOf("number");
    }
    expect([...cities].filter((c) => !CITY_HUBS[c]).sort()).toEqual(
      [
        "화성",
        "연천",
        "평택",
        "의정부",
        "안산",
        "영광",
        "홍천",
        "경산",
        "청도",
        "진도",
        "양구",
        "화천",
        "나주",
        "안성",
      ].sort(),
    );
    expect(Object.keys(CITY_HUBS)).toHaveLength(cities.size - 14);
  });

  it("체류 · 운영시간 필드가 일정 모듈이 읽는 꼴이다", () => {
    for (const p of PLANNER_PLACES) {
      expect(Number.isFinite(p.min), p.id).toBe(true);
      if (p.open !== null && p.close !== null)
        expect(p.close, p.id).toBeGreaterThan(p.open);
    }
  });
});

describe("도시별 장소 수(regions.json placeCounts)", () => {
  it("places.json의 pickCity를 센 값과 같다(빌드 스크립트가 적은 값이 데이터와 어긋나지 않는다)", () => {
    const m = new Map<string, number>();
    for (const p of PLANNER_PLACES)
      if (p.pickCity) m.set(p.pickCity, (m.get(p.pickCity) ?? 0) + 1);
    expect(Object.fromEntries(REGION_PLACE_COUNTS)).toEqual(
      Object.fromEntries(m),
    );
    expect(REGION_PLACE_COUNTS).toBe(PLACE_COUNT_BY_CITY);
  });
});

describe("도시 고르기 도시(pickCity): 전용 화면 도시의 전국 목록 장소도 그 도시에", () => {
  // 전국 목록 장소 중 같은 도시 · 같은 이름(공백 · 가운뎃점 · 괄호 무시) · 200m 이내 장소가 전용 화면에 있어 도시에 넣지 않은 것
  const DUPLICATES = ["nax701"]; // 서울숲(= 서울 화면 kdx26)
  const SCREEN_CITIES = ["서울", "부산", "제주", "영월", "경주", "거제"];

  it("도시 장소 수 = 그 도시(locKo) 장소 수 − 중복으로 뺀 장소 수", () => {
    for (const city of SCREEN_CITIES) {
      const inCity = PLANNER_PLACES.filter((p) => p.locKo === city);
      const dup = inCity.filter((p) => DUPLICATES.includes(p.id)).length;
      expect(PLACE_COUNT_BY_CITY.get(city), city).toBe(inCity.length - dup);
    }
    expect(PLACE_COUNT_BY_CITY.get("경주")).toBe(
      PLANNER_PLACES.filter((p) => p.locKo === "경주").length,
    );
  });

  it("pickCity가 있으면 locKo와 같고, 없는 장소는 중복으로 뺀 장소뿐", () => {
    for (const p of PLANNER_PLACES)
      if (p.pickCity) expect(p.pickCity, p.id).toBe(p.locKo);
    expect(PLANNER_PLACES.filter((p) => !p.pickCity).map((p) => p.id)).toEqual(
      DUPLICATES,
    );
  });

  it("서울숲은 서울 목록에 한 번만 나오고, 전국 보기에는 두 곳 다 남는다", () => {
    const seoul = placesInScope({ kind: "city", city: "서울" });
    expect(seoul.filter((p) => p.ko === "서울숲").map((p) => p.id)).toEqual([
      "kdx26",
    ]);
    expect(
      placesInScope({ kind: "nation", region: null }).filter(
        (p) => p.ko === "서울숲",
      ),
    ).toHaveLength(2);
  });

  it("전에는 전국 보기에만 있던 경주 장소(분황사 · 경주중앙시장)가 경주 목록에 있다", () => {
    const names = placesInScope({ kind: "city", city: "경주" }).map(
      (p) => p.ko,
    );
    expect(names).toEqual(expect.arrayContaining(["분황사", "경주중앙시장"]));
  });

  it("경주 목록은 데이터랩 인기 순서대로(경주중앙시장 19위가 분황사 50위보다 앞)", () => {
    const list = sortPlaces(placesInScope({ kind: "city", city: "경주" }), {
      nation: false,
      name: (p) => p.ko,
      city: (p) => p.locKo,
    });
    const ranked = list.filter((p) => p.popRank !== undefined);
    expect(list.slice(0, ranked.length)).toEqual(ranked);
    const ranks = ranked.map((p) => p.popRank!);
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
    const at = (ko: string) => list.findIndex((p) => p.ko === ko);
    expect(list[at("경주중앙시장")].popRank).toBe(19);
    expect(list[at("분황사")].popRank).toBe(50);
    expect(at("경주중앙시장")).toBeLessThan(at("분황사"));
  });
});
