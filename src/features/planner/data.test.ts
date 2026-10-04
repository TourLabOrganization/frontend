import { describe, expect, it } from "vitest";
import addedPlaces from "./data/added-places.json";
import {
  canonicalPlaceId,
  CITY_GROUPS,
  findPlace,
  isPlannerPlace,
  PLACE_ALIASES,
  PLACE_COUNT_BY_CITY,
  placesInScope,
  PLANNER_PLACES,
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

// 인기 관광지에서 누적한 추가 장소(added-places.json, scripts/add-popular-places.mjs)는 빌드 장소 뒤에 붙는다.
// 빌드 장소 3,109곳에서 같은 장소 통합(scripts/data/same-places.csv, scripts/merge-same-places.mjs)으로 63곳을 뺀 3,046곳
const BASE = 3046;
const ADDED = addedPlaces.length;
const TOTAL = BASE + ADDED;
/** 추가 장소 수(도시 · 권역별). 아래 기대값은 빌드 장소 수 + 이 값 */
const addedIn = (city: string) =>
  addedPlaces.filter((p) => p.pickCity === city).length;
const addedMacro = (key: string) =>
  addedPlaces.filter((p) => p.macro === key).length;
/** 추가 장소로만 생긴 도시(빌드 장소가 없던 김포 · 부천 · 광명) */
const BASE_CITIES = new Set(
  PLANNER_PLACES.slice(0, BASE).map((p) => p.pickCity),
);
const addedCityList = [
  ...new Set(
    addedPlaces.map((p) => p.pickCity).filter((c) => !BASE_CITIES.has(c)),
  ),
];
const addedCities = addedCityList.length;
const addedCitiesIn = (key: string) =>
  addedCityList.filter(
    (c) => addedPlaces.find((p) => p.pickCity === c)?.macro === key,
  ).length;

describe("플래너 데이터", () => {
  it("장소는 3,046곳(원천 3,118곳에서 맥도날드 9곳 · 같은 장소 63곳 제외) + 추가 장소이고 id가 겹치지 않는다", () => {
    expect(PLANNER_PLACES).toHaveLength(TOTAL);
    expect(new Set(PLANNER_PLACES.map((p) => p.id)).size).toBe(TOTAL);
  });

  it("추가 장소는 pop<contentid> · odii<tid> · ctm<해시> id · 도시 고르기 도시 · 시군구 코드가 있고 빌드 장소와 이름 · 위치가 겹치지 않는다", () => {
    const base = PLANNER_PLACES.slice(0, BASE);
    for (const p of PLANNER_PLACES.slice(BASE)) {
      expect(p.id, p.id).toMatch(/^(pop\d{1,12}|odii\d+|ctm[0-9a-f]{8})$/);
      expect(p.pickCity).toBe(p.locKo);
      expect(REGION_KEYS).toContain(p.macro);
      expect(base.some((q) => q.locKo === p.locKo && q.ko === p.ko)).toBe(
        false,
      );
    }
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
      서울: 254 + addedIn("서울"),
      부산: 177 + addedIn("부산"),
      제주: 171 + addedIn("제주"),
      영월: 28 + addedIn("영월"),
      경주: 69 + addedIn("경주"),
      거제: 45 + addedIn("거제"),
    });
  });

  it("도시 고르기 장소 수 + 전국에만 속한 장소 = 전체, 도시 보기는 그 도시 장소만", () => {
    const sum = [...PLACE_COUNT_BY_CITY.values()].reduce((a, b) => a + b, 0);
    const nationOnly = PLANNER_PLACES.filter((p) => !p.pickCity).length;
    expect(PLACE_COUNT_BY_CITY.size).toBe(124 + addedCities);
    expect(sum).toBe(BASE + ADDED);
    expect(nationOnly).toBe(0);
    expect(sum + nationOnly).toBe(TOTAL);
    for (const [city, n] of PLACE_COUNT_BY_CITY) {
      const list = placesInScope({ kind: "city", city });
      expect(list, city).toHaveLength(n);
      expect(list.every((p) => p.locKo === city)).toBe(true);
    }
    expect(placesInScope({ kind: "nation", region: null })).toHaveLength(TOTAL);
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
      capital: 673 + addedMacro("capital"),
      gangwon: 360 + addedMacro("gangwon"),
      chungcheong: 433 + addedMacro("chungcheong"),
      daegyeong: 361 + addedMacro("daegyeong"),
      dongnam: 624 + addedMacro("dongnam"),
      honam: 424 + addedMacro("honam"),
      jeju: 171 + addedMacro("jeju"),
    });
  });

  it("도시 고르기 묶음별 도시 수는 목업과 같고, 장소 수는 권역 장소 수와 같다(같은 장소는 합쳐서 하나)", () => {
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
      capital: [21 + addedCitiesIn("capital"), 673 + addedMacro("capital")],
      gangwon: [18 + addedCitiesIn("gangwon"), 360 + addedMacro("gangwon")],
      chungcheong: [
        19 + addedCitiesIn("chungcheong"),
        433 + addedMacro("chungcheong"),
      ],
      daegyeong: [
        16 + addedCitiesIn("daegyeong"),
        361 + addedMacro("daegyeong"),
      ],
      dongnam: [19 + addedCitiesIn("dongnam"), 624 + addedMacro("dongnam")],
      honam: [30 + addedCitiesIn("honam"), 424 + addedMacro("honam")],
      jeju: [1 + addedCitiesIn("jeju"), 171 + addedMacro("jeju")],
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
  it("배지 필터 장소 수: 데이터랩 인기 173 · 유네스코 69 · 100선 98 · 열린관광지 99 · 관광특구 · 관광단지 204", () => {
    expect(
      Object.fromEntries(
        BADGE_KEYS.map((b) => [
          b,
          PLANNER_PLACES.filter((p) => hasBadge(p, b)).length,
        ]),
      ),
    ).toEqual({ pop: 173, un: 69, k100: 98, bf: 99, zone: 204 });
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

  it("장소가 있는 도시는 가운데 좌표가 있고, 관문은 PoC REGION_HUB에 없는 14곳과 김포 말고 모두 있다", () => {
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
        "김포", // 수기 장소로 생긴 도시(2026-10-03). 부천 · 광명은 부천역 · 광명역을 관문으로 적었다
        // 국보 소재지로 생긴 김제 · 구례 · 강진 · 영천 · 의성 · 영양 · 영암 · 예천 · 청양 · 김천(2026-10-04)은 역 · 터미널을 관문으로 적었다
      ].sort(),
    );
    expect(Object.keys(CITY_HUBS)).toHaveLength(cities.size - 15);
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
  // 전용 화면 묶음과 전국 목록에 함께 있던 같은 장소는 하나로 합쳐 뺐다(scripts/merge-same-places.mjs, 2026-10-03). [남긴 id, 뺀 id]
  // 뺀 id는 place-aliases.json으로 남긴 장소에 이어진다. 전용 화면 쪽을 남기고 전국 목록 쪽의 인기 순위를 옮겼다(서울스카이 · 올레시장 · 사려니숲길)
  const SAME: readonly [string, string][] = [
    ["bc10", "ctt7"], // 부산 BIFF 광장 = BIFF광장
    ["ywx1", "ro106"], // 고씨굴 = 영월 고씨굴
    ["gjx29", "ro166"], // 감은사지 = 경주 감은사지동서삼층석탑
    ["bcx42", "ro177"], // 동백섬 · 누리마루 = 동백섬
    ["yw2", "ro188"], // 영월 장릉 = 장릉
    ["bcx28", "ro226"], // 달맞이길 문탠로드 = 해운대달맞이길
    ["kd5", "ro666"], // 롯데월드타워 서울스카이 = 서울스카이(인기 78위)
    ["jdx29", "ro15"], // 제주 올레시장 = 서귀포매일올레시장(인기 3위)
    ["jdx5", "ro261"], // 사려니숲길 = 한라산둘레길 사려니숲길(인기 15위)
    ["bcx31", "ro762"], // 부산 F1963 = F1963
    ["gjx19", "rs60"], // 힐튼 경주 = 힐튼호텔 경주
    ["kdx26", "nax701"], // 서울숲 = 서울숲
    ["gjx8", "nax773"], // 경주 양남 주상절리 = 양남 주상절리 파도소리길
    ["yw1", "nax893"], // 청령포 = 청령포 관음송
  ];
  // 이름 규칙에 걸리지만 다른 장소라 둘 다 도시에 남긴다(안에 든 시설 · 행사, 인사동 근처 호텔)
  const DIFFERENT: readonly [string, string][] = [
    ["ro17", "kdx9"], // 코엑스 · 코엑스 별마당도서관
    ["ro19", "kdx12"], // 반포한강공원 · 반포한강공원 달빛무지개분수
    ["ro118", "gjx26"], // 경주중앙시장 · 중앙시장 야시장
    ["rs175", "kdx5"], // 오라카이 인사동 스위츠(숙박) · 인사동
  ];
  const SCREEN_CITIES = ["서울", "부산", "제주", "영월", "경주", "거제"];
  const byId = new Map(PLANNER_PLACES.map((p) => [p.id, p]));

  it("도시 장소 수 = 그 도시(locKo) 장소 수(같은 장소는 합쳐서 하나)", () => {
    for (const city of SCREEN_CITIES) {
      const inCity = PLANNER_PLACES.filter((p) => p.locKo === city);
      expect(PLACE_COUNT_BY_CITY.get(city), city).toBe(inCity.length);
    }
  });

  it("모든 장소에 pickCity가 있고 locKo와 같다(같은 장소를 합쳐 뺀 뒤로 도시에서 뺀 장소가 없다)", () => {
    for (const p of PLANNER_PLACES) expect(p.pickCity, p.id).toBe(p.locKo);
  });

  it("같은 장소 쌍은 남긴 쪽만 데이터에 있고, 뺀 id는 남긴 장소로 이어진다", () => {
    for (const [keep, drop] of SAME) {
      expect(byId.has(keep), keep).toBe(true);
      expect(byId.has(drop), drop).toBe(false);
      expect(PLACE_ALIASES[drop], drop).toBe(keep);
      expect(findPlace(drop)?.id, drop).toBe(keep);
      expect(isPlannerPlace(drop), drop).toBe(true);
    }
    const seoul = placesInScope({ kind: "city", city: "서울" });
    expect(seoul.filter((p) => p.ko === "서울숲").map((p) => p.id)).toEqual([
      "kdx26",
    ]);
    expect(byId.get("kd5")?.popRank).toBe(78);
    expect(byId.get("jdx29")?.popRank).toBe(3);
    expect(byId.get("jdx5")?.popRank).toBe(15);
  });

  it("신규 관광지 id(kto:<contentid>)는 같은 contentid의 추가 장소(pop<contentid>)가 있으면 그 장소로 이어진다", () => {
    const pop = PLANNER_PLACES.find((p) => /^pop\d+$/.test(p.id));
    if (pop) {
      const kto = `kto:${pop.id.slice(3)}`;
      expect(canonicalPlaceId(kto)).toBe(pop.id);
      expect(findPlace(kto)?.id).toBe(pop.id);
      expect(isPlannerPlace(kto)).toBe(true);
    }
    expect(canonicalPlaceId("kto:999999999999")).toBe("kto:999999999999");
    expect(isPlannerPlace("kto:999999999999")).toBe(false);
  });

  it("다른 장소 쌍은 둘 다 도시 목록에 있다", () => {
    for (const pair of DIFFERENT)
      for (const id of pair) expect(byId.get(id)?.pickCity, id).toBeTruthy();
  });

  it("데이터랩 인기 순위가 있는 173곳은 모두 도시 목록에 있다(중복을 빼며 순위를 잃지 않는다)", () => {
    const ranked = PLANNER_PLACES.filter((p) => p.popRank !== undefined);
    expect(ranked).toHaveLength(173);
    expect(ranked.every((p) => p.pickCity === p.locKo)).toBe(true);
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
