import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  type PlannerSettings,
  parseSettings,
  pickSettings,
} from "./course-store";
import { findPlace, type PlannerPlace } from "./data";
import {
  FERRY_ROUTES,
  ferryLevel,
  ferryOperatorUrl,
  ferryPortLabel,
  ferryRoute,
  ferryRows,
  ferryStatView,
  showFerryCard,
  tripMonth,
  worstMonth,
  FERRY_STATS,
} from "./ferry";
import {
  islandOf,
  islandPorts,
  islandSailMin,
  islandSync,
  isPortRoute,
  portIslandOf,
  tripOriginKey,
  ulleungPorts,
  ulleungSailMin,
  ulleungSync,
} from "./island";
import { CITY_HUBS, PLANNER_ORIGINS } from "./regions";
import { buildPlannerSchedule, routeAsk, wideOptions } from "./schedule";
import {
  chainSchedule,
  gatewayOptions,
  originOptions,
  routeCands,
  wideChain,
} from "./wide-chain";

// 섬 여행(제주 · 울릉) 규칙과 배편 시간표 카드. 숫자는 PoC Tour Planner.dc.html 식의 손계산과 맞춘다
//  (haversine × 1.35, 배 60 + km × 0.85, 카페리 + 30, 자가용 ownDriveMin, 울릉 40 + sailMin, chainSchedule 환승 올림)

const O = PLANNER_ORIGINS;
const H = CITY_HUBS;
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const place = (id: string) => findPlace(id) as PlannerPlace;
const settings = (fields: Partial<PlannerSettings>): PlannerSettings => ({
  ...DEFAULT_SETTINGS,
  startDate: "2026-09-27",
  endDate: "2026-09-29",
  ...fields,
});
const own = { own: true, pref: null, gwPick: {}, carFerry: true } as const;

describe("섬 판정 (PoC isJejuTrip · ulleungTrip · ferryVals isl)", () => {
  it("제주 · 서귀포 = 제주, 울릉 = 울릉, 그 밖은 없다", () => {
    expect(islandOf("제주")).toBe("jeju");
    expect(islandOf("서귀포")).toBe("jeju");
    expect(islandOf("울릉")).toBe("ulleung");
    expect(islandOf("경주")).toBeNull();
    expect(islandOf(null)).toBeNull();
  });
});

describe("제주 광역 교통 칸 (PoC wideOpts _jeju)", () => {
  it("제주는 항공 · 배 · 자가용만, 자가용은 막지 않는다", () => {
    expect(
      wideOptions(H["제주"], "jeju").map((o) => [o.choice, o.block]),
    ).toEqual([
      ["air", null],
      ["ship", null],
      ["own", null],
    ]);
  });

  it("제주가 아니면 6칸 그대로, 울릉 자가용은 섬이라 막는다", () => {
    expect(wideOptions(H["경주"], null)).toHaveLength(6);
    const ul = Object.fromEntries(
      wideOptions(H["울릉"], "ulleung").map((o) => [o.choice, o.block]),
    );
    expect(ul.own).toBe("island");
    expect(ul.ship).toBeNull();
    expect(ul.air).toBe("hub");
  });

  it("울릉(도착 관문에 육로 수단 없음)은 지하철도 자가용처럼 막는다", () => {
    expect(
      wideOptions(H["울릉"], "ulleung").map((o) => [o.choice, o.block]),
    ).toEqual([
      ["bus", "hub"],
      ["rail", "hub"],
      ["air", "hub"],
      ["ship", null],
      ["metro", "island"],
      ["own", "island"],
    ]);
  });

  it("경주는 지하철 · 자가용을 막지 않는다", () => {
    expect(
      wideOptions(H["경주"], null).map((o) => [o.choice, o.block]),
    ).toEqual([
      ["bus", null],
      ["rail", null],
      ["air", "hub"],
      ["ship", "hub"],
      ["metro", null],
      ["own", null],
    ]);
  });

  it("울릉에 지하철을 골라 두었으면 고르지 않은 것으로 본다(서울역 → 목포 → 도동항 경로가 나오지 않는다)", () => {
    const plan = buildPlannerSchedule(
      [place("ro356")],
      settings({ wideMode: "metro", metroLine: "1", metroOrigin: "서울역" }),
    );
    expect(plan.choice).not.toBe("metro");
    expect(plan.inbound?.chain.gw.ko).not.toContain("목포");
    expect(plan.inbound?.chain.legs.some((l) => l.mode === "metro")).toBe(
      false,
    );
  });

  it("제주에서 기차 · 버스를 골라 두었으면 고르지 않은 것으로 본다", () => {
    const plan = buildPlannerSchedule(
      [place("ctu3")],
      settings({ origin: "gimpoAirF", wideMode: "ktx" }),
    );
    expect(plan.options.map((o) => o.choice)).toEqual(["air", "ship", "own"]);
    expect(plan.choice).toBe("air");
  });
});

describe("제주 자가용 카페리 체인 (PoC wideChain carFerry)", () => {
  it("항만 출발: 목포 → 제주항 카페리 = 배 222 + 선적 · 하선 30 = 252분, 08:00 → 12:12", () => {
    // 손계산: 목포연안여객터미널 → 제주항 여객터미널 직선 140.87km × 1.35 = 190.17km, 60 + 190.17 × 0.85 = 221.6 → 222
    const c = wideChain(O.mokpoPort, "mokpoPort", H["제주"], own)!;
    expect(c.carFerry).toBe(true);
    expect(c.mode).toBe("ship");
    expect(c.gw).toBe(O.mokpoPort);
    expect(c.hubPt.ko).toBe("제주항 여객터미널");
    expect(c.legs).toHaveLength(1);
    expect(c.legs[0]).toMatchObject({ mode: "carferry", min: 252, main: true });
    expect(chainSchedule(c, at("08:00")).end).toBe(at("12:12"));
    // 완도 · 부산도 같은 식: 163 + 30, 391 + 30
    expect(
      wideChain(O.wandoPort, "wandoPort", H["제주"], own)!.legs[0].min,
    ).toBe(193);
    expect(
      wideChain(O.busanPort, "busanPort", H["제주"], own)!.legs[0].min,
    ).toBe(421);
  });

  it("항만이 아닌 출발: 서울역 → (운전 331분) 목포항 → 카페리 252분, 환승 올림으로 08:00 → 18:02", () => {
    // 손계산: 가장 가까운 배 관문 = 목포연안여객터미널. 운전 = 진출입 15 + 시내 20km/35 + 나머지/92 + 휴게 15×2 = 331
    // chainSchedule: 13:31 도착 → (+15분 뒤 10분 올림) 13:50 출항 → 18:02
    const c = wideChain(O.seoul, "seoul", H["제주"], own)!;
    expect(c.gw).toBe(O.mokpoPort);
    expect(c.legs.map((l) => [l.mode, l.min])).toEqual([
      ["car", 331],
      ["carferry", 252],
    ]);
    const sc = chainSchedule(c, at("08:00"));
    expect(sc.steps[1]).toMatchObject({ t: at("13:31"), wait: 19 });
    expect(sc.end).toBe(at("18:02"));
  });

  it("카페리는 경로 후보 · 환승 관문을 두지 않는다", () => {
    const c = wideChain(O.seoul, "seoul", H["제주"], own)!;
    expect(routeCands(O.seoul, "seoul", H["제주"], own)).toEqual([]);
    expect(gatewayOptions(c, O.seoul)).toEqual([]);
  });

  it("일정: 카페리면 현지 자가용 · 예매 없음, 첫날은 체인 + 항만 → 첫 장소", () => {
    const plan = buildPlannerSchedule(
      [place("ctu3")],
      settings({ origin: "mokpoPort", wideMode: "own", jejuResident: false }),
    );
    expect(plan.carFerry).toBe(true);
    expect(plan.resident).toBe(false);
    expect(plan.local).toBe("own");
    expect(plan.choice).toBe("own");
    expect(plan.inbound?.chain.legs[0].mode).toBe("carferry");
    expect(plan.accIn).toBe(252 + plan.firstLeg);
    expect(plan.firstLeg).toBeGreaterThan(0);
    // 경로 선택 창은 자가용이라 열지 않는다
    expect(routeAsk(plan, { routePick: {} }, {}, null)).toBeNull();
  });

  it("아직 답하지 않았으면 카페리로 계산한다(PoC: 자가용 + 제주 = carFerry)", () => {
    const plan = buildPlannerSchedule(
      [place("ctu3")],
      settings({ origin: "mokpoPort", wideMode: "own" }),
    );
    expect(plan.carFerry).toBe(true);
  });

  it("도민이면 광역 체인 없이 섬 안에서 자가용만, 첫날은 출발 시각부터", () => {
    const plan = buildPlannerSchedule(
      [place("ctu3")],
      settings({
        origin: "mokpoPort",
        wideMode: "own",
        jejuResident: true,
        depTime: "10:00",
      }),
    );
    expect(plan.resident).toBe(true);
    expect(plan.carFerry).toBe(false);
    expect(plan.inbound).toBeNull();
    expect(plan.outbound).toBeNull();
    expect(plan.accIn).toBe(0);
    expect(plan.local).toBe("own");
    // 첫 장소 도착 = 출발 시각(공용 식 dayStartClock: 09:00보다 이르면 09:00)
    expect(plan.days[0].stops[0].arrive).toBe("10:00");
  });

  it("카페리 출발지 목록은 항만만(울릉 항로 제외)", () => {
    const keys = originOptions(H["제주"], "ship");
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => O[k].modes.includes("ship"))).toBe(true);
    expect(keys).toContain("mokpoPort");
    expect(keys).not.toContain("pohangPort");
  });
});

describe("울릉 (PoC ulleungTrip · oKey · syncUlleung · accessMin 울릉 분기)", () => {
  it("출발지 목록은 울릉 항로 항구만, 항해 시간이 짧은 순", () => {
    expect(ulleungPorts()).toEqual([
      "hupoPort",
      "mukhoPort",
      "gangneungPort",
      "pohangPort",
    ]);
    expect(originOptions(H["울릉"], "ship", true)).toEqual(ulleungPorts());
    expect(originOptions(H["울릉"], null, true)).toEqual(ulleungPorts());
    // 울릉이 아니면 울릉 항로 항구가 없다
    expect(
      originOptions(H["경주"], null).some((k) => O[k].route === "ulleung"),
    ).toBe(false);
  });

  it("계산에 쓰는 출발지(oKey): 울릉이면 울릉 항구(아니면 포항), 울릉이 아니면 울릉 항구 대신 서울역", () => {
    expect(tripOriginKey("seoul", true)).toBe("pohangPort");
    expect(tripOriginKey("hupoPort", true)).toBe("hupoPort");
    expect(tripOriginKey("hupoPort", false)).toBe("seoul");
    expect(tripOriginKey("busanStn", false)).toBe("busanStn");
  });

  it("울릉을 고를 때 바꿀 값(syncUlleung)", () => {
    expect(ulleungSync("seoul", null)).toEqual({ origin: "pohangPort" });
    expect(ulleungSync("seoul", "busanStn")).toEqual({
      origin: "pohangPort",
      originEnd: null,
    });
    expect(ulleungSync("mukhoPort", "hupoPort")).toEqual({});
  });

  it("배 본 구간 = 승선 수속 40 + 항해 시간: 포항 240분 · 후포 180분, 08:00 → 12:00", () => {
    expect(ulleungSailMin(O.pohangPort)).toBe(240);
    expect(ulleungSailMin(O.hupoPort)).toBe(180);
    expect(ulleungSailMin({})).toBe(230);
    const c = wideChain(O.pohangPort, "pohangPort", H["울릉"], {
      own: false,
      pref: "ship",
      ulleung: true,
    })!;
    expect(c.legs).toEqual([
      expect.objectContaining({ mode: "ship", min: 240, main: true }),
    ]);
    expect(chainSchedule(c, at("08:00")).end).toBe(at("12:00"));
  });

  it("일정: 저장된 출발지가 서울역이어도 포항에서 배로 들어간다", () => {
    const plan = buildPlannerSchedule(
      [place("ro356")],
      settings({ origin: "seoul" }),
    );
    expect(plan.ulleung).toBe(true);
    expect(plan.island).toBe("ulleung");
    expect(plan.originKey).toBe("pohangPort");
    expect(plan.choice).toBe("ship");
    expect(plan.inbound?.chain.legs.map((l) => l.min)).toEqual([240]);
    const hupo = buildPlannerSchedule(
      [place("ro356")],
      settings({ origin: "hupoPort", originEnd: "mukhoPort" }),
    );
    expect(hupo.inbound?.chain.legs[0].min).toBe(180);
    expect(hupo.outbound?.chain.legs[0].min).toBe(200);
  });

  it("울릉이 아닌 도시로 돌아오면 울릉 항구 대신 서울역으로 계산한다", () => {
    const plan = buildPlannerSchedule(
      [place("ctu3")],
      settings({ origin: "pohangPort", wideMode: "air" }),
    );
    expect(plan.ulleung).toBe(false);
    expect(plan.originKey).toBe("seoul");
  });
});

describe("백령도 · 연평도 (울릉 규칙을 넓힌 항구 섬, 인천항 연안여객터미널 한 곳)", () => {
  it("섬 판정: 백령도 · 연평도는 항구 섬, 제주는 항구 섬이 아니다", () => {
    expect(islandOf("백령도")).toBe("baengnyeong");
    expect(islandOf("연평도")).toBe("yeonpyeong");
    expect(portIslandOf("백령도")).toBe("baengnyeong");
    expect(portIslandOf("울릉")).toBe("ulleung");
    expect(portIslandOf("제주")).toBeNull();
    expect(portIslandOf("인천")).toBeNull();
    expect(isPortRoute("baengnyeong")).toBe(true);
    expect(isPortRoute("jeju")).toBe(false);
  });

  it("출발지 목록은 그 섬 항로 항구만, 다른 섬 · 육지 여행에는 나오지 않는다", () => {
    expect(islandPorts("baengnyeong")).toEqual(["incheonPortBaengnyeong"]);
    expect(islandPorts("yeonpyeong")).toEqual(["incheonPortYeonpyeong"]);
    expect(originOptions(H["백령도"], "ship", "baengnyeong")).toEqual([
      "incheonPortBaengnyeong",
    ]);
    expect(originOptions(H["연평도"], null, "yeonpyeong")).toEqual([
      "incheonPortYeonpyeong",
    ]);
    // 울릉 목록 · 육지 · 제주 카페리 목록에는 인천항 섬 항로가 없다
    expect(ulleungPorts()).not.toContain("incheonPortBaengnyeong");
    for (const keys of [
      originOptions(H["인천"], null),
      originOptions(H["제주"], "ship"),
      originOptions(H["경주"], null, "jeju"),
    ])
      expect(keys.some((k) => isPortRoute(O[k].route))).toBe(false);
  });

  it("계산에 쓰는 출발지: 그 섬 항구가 아니면 인천항(그 섬 항로), 육지 여행이면 섬 항구 대신 서울역", () => {
    expect(tripOriginKey("seoul", "baengnyeong")).toBe(
      "incheonPortBaengnyeong",
    );
    expect(tripOriginKey("incheonPortYeonpyeong", "baengnyeong")).toBe(
      "incheonPortBaengnyeong",
    );
    expect(tripOriginKey("hupoPort", "yeonpyeong")).toBe(
      "incheonPortYeonpyeong",
    );
    expect(tripOriginKey("incheonPortBaengnyeong", "ulleung")).toBe(
      "pohangPort",
    );
    expect(tripOriginKey("incheonPortBaengnyeong", null)).toBe("seoul");
    expect(tripOriginKey("incheonPortYeonpyeong", "jeju")).toBe("seoul");
    expect(tripOriginKey("incheonPortYeonpyeong", false)).toBe("seoul");
  });

  it("섬을 고를 때 바꿀 값(syncUlleung을 넓힌 islandSync)", () => {
    expect(islandSync("baengnyeong", "seoul", "busanStn")).toEqual({
      origin: "incheonPortBaengnyeong",
      originEnd: null,
    });
    expect(islandSync("yeonpyeong", "incheonPortBaengnyeong", null)).toEqual({
      origin: "incheonPortYeonpyeong",
    });
    expect(
      islandSync(
        "baengnyeong",
        "incheonPortBaengnyeong",
        "incheonPortBaengnyeong",
      ),
    ).toEqual({});
  });

  it("광역 교통: 배만 고를 수 있고 지하철 · 자가용은 섬이라 막는다", () => {
    for (const [city, island] of [
      ["백령도", "baengnyeong"],
      ["연평도", "yeonpyeong"],
    ] as const)
      expect(
        wideOptions(H[city], island).map((o) => [o.choice, o.block]),
      ).toEqual([
        ["bus", "hub"],
        ["rail", "hub"],
        ["air", "hub"],
        ["ship", null],
        ["metro", "island"],
        ["own", "island"],
      ]);
  });

  it("배 본 구간 = 승선 수속 30 + 항해 시간: 백령 230 → 260분, 연평 150 → 180분", () => {
    expect(islandSailMin("baengnyeong", O.incheonPortBaengnyeong)).toBe(260);
    expect(islandSailMin("yeonpyeong", O.incheonPortYeonpyeong)).toBe(180);
    expect(islandSailMin("baengnyeong", {})).toBe(260);
    expect(islandSailMin("yeonpyeong", undefined)).toBe(180);
    const c = wideChain(
      O.incheonPortBaengnyeong,
      "incheonPortBaengnyeong",
      H["백령도"],
      { own: false, pref: "ship", portIsland: "baengnyeong" },
    )!;
    expect(c.hubPt.ko).toContain("용기포");
    expect(c.legs).toEqual([
      expect.objectContaining({ mode: "ship", min: 260, main: true }),
    ]);
    expect(chainSchedule(c, at("08:00")).end).toBe(at("12:20"));
  });

  it("일정: 저장된 출발지가 서울역이어도 인천항에서 배로 들어간다(장소가 없어도 도시로)", () => {
    const plan = buildPlannerSchedule(
      [],
      settings({ origin: "seoul" }),
      "연평도",
    );
    expect(plan.island).toBe("yeonpyeong");
    expect(plan.portIsland).toBe("yeonpyeong");
    expect(plan.ulleung).toBe(false);
    expect(plan.originKey).toBe("incheonPortYeonpyeong");
    expect(plan.originEndKey).toBe("incheonPortYeonpyeong");
    expect(plan.choice).toBe("ship");
    expect(plan.inbound?.chain.legs.map((l) => l.min)).toEqual([180]);
    expect(plan.outbound?.chain.legs.map((l) => l.min)).toEqual([180]);
    // 울릉은 그대로
    const ul = buildPlannerSchedule([place("ro356")], settings({}));
    expect(ul.portIsland).toBe("ulleung");
    expect(ul.ulleung).toBe(true);
  });

  it("배편 카드: 인천항 한 항로, 영어 도착 항구는 수기 값, 운항 실적은 없다", () => {
    expect(
      showFerryCard({
        island: "baengnyeong",
        own: false,
        choice: "ship",
        jejuResident: null,
      }),
    ).toBe(true);
    expect(FERRY_ROUTES.baengnyeong.map((r) => r.k)).toEqual([
      "incheonBaengnyeong",
    ]);
    expect(FERRY_ROUTES.yeonpyeong.map((r) => r.k)).toEqual([
      "incheonYeonpyeong",
    ]);
    const r = ferryRoute("baengnyeong", undefined);
    expect(ferryPortLabel(r, "baengnyeong", true)).toBe(
      "인천항 연안여객터미널 → 용기포항",
    );
    expect(ferryPortLabel(r, "baengnyeong", false)).toBe(
      "Incheon → Baengnyeongdo",
    );
    const en = Object.fromEntries(
      ferryRows(r, "baengnyeong", false).map((x) => [x.key, x.value]),
    );
    expect(en).toMatchObject({ day: "2 /day", last: "12:30", arr: "Yonggipo" });
    expect(
      ferryRows(ferryRoute("yeonpyeong", undefined), "yeonpyeong", true).find(
        (x) => x.key === "day",
      )?.value,
    ).toBe("하루 1 – 2회");
    expect(ferryStatView("incheonBaengnyeong", "2026-01-10")).toBeNull();
    expect(ferryStatView("incheonYeonpyeong", null)).toBeNull();
    expect(
      decodeURIComponent(ferryOperatorUrl(r, "baengnyeong").split("query=")[1]),
    ).toBe("고려고속훼리 인천항 연안여객터미널 백령도 시간표");
  });
});

describe("배편 시간표 카드 (PoC ferryVals)", () => {
  it("보이는 조건: 섬 여행에서 배, 또는 제주 자가용 카페리(답이 false일 때만)", () => {
    const base = { island: "jeju", own: false, jejuResident: null } as const;
    expect(showFerryCard({ ...base, choice: "ship" })).toBe(true);
    expect(showFerryCard({ ...base, choice: "air" })).toBe(false);
    expect(showFerryCard({ ...base, island: null, choice: "ship" })).toBe(
      false,
    );
    const ownJeju = { island: "jeju", own: true, choice: "own" } as const;
    expect(showFerryCard({ ...ownJeju, jejuResident: false })).toBe(true);
    expect(showFerryCard({ ...ownJeju, jejuResident: true })).toBe(false);
    expect(showFerryCard({ ...ownJeju, jejuResident: null })).toBe(false);
    expect(
      showFerryCard({
        island: "ulleung",
        own: false,
        choice: "ship",
        jejuResident: null,
      }),
    ).toBe(true);
  });

  it("항로: 제주 6항 · 울릉 4항, 고른 항구가 없으면 첫 항구", () => {
    expect(FERRY_ROUTES.jeju.map((r) => r.k)).toEqual([
      "wando",
      "mokpo",
      "nokdong",
      "yeosu",
      "busan",
      "incheon",
    ]);
    expect(FERRY_ROUTES.ulleung).toHaveLength(4);
    expect(ferryRoute("jeju", undefined).k).toBe("wando");
    expect(ferryRoute("jeju", "busan").k).toBe("busan");
    expect(ferryRoute("jeju", "nope").k).toBe("wando");
  });

  it("항구 이름 · 표 값: 한국어는 PoC 값, 그 밖은 PoC 영어 표기", () => {
    const wando = ferryRoute("jeju", "wando");
    expect(ferryPortLabel(wando, "jeju", true)).toBe("완도항 → 제주항");
    expect(ferryPortLabel(wando, "jeju", false)).toBe("Wando → Jeju");
    const v = (
      r: ReturnType<typeof ferryRoute>,
      isl: "jeju" | "ulleung",
      ko: boolean,
    ) => Object.fromEntries(ferryRows(r, isl, ko).map((x) => [x.key, x.value]));
    expect(v(wando, "jeju", true)).toMatchObject({
      day: "하루 2 – 3회",
      first: "02:30 무렵",
      arr: "제주항",
    });
    expect(v(wando, "jeju", false)).toMatchObject({
      op: "Hanil Express (Silver Cloud, Blue Narae)",
      dur: "1h30 – 2h50",
      day: "2 – 3 /day",
      first: "02:30",
      last: "15:00",
      arr: "Jeju Port",
    });
    const busan = ferryRoute("jeju", "busan");
    expect(v(busan, "jeju", true).day).toBe("주 3 – 6회");
    expect(v(busan, "jeju", false).day).toBe("3 – 6 /week");
    const pohang = ferryRoute("ulleung", "pohang");
    expect(v(pohang, "ulleung", false)).toMatchObject({
      last: "23:50 (cruise)",
      arr: "Dodong·Sadong",
    });
  });

  it("선사 시간표 검색어: 선사 이름(괄호 앞) + 항구 + 섬 + 시간표", () => {
    const url = ferryOperatorUrl(ferryRoute("jeju", "mokpo"), "jeju");
    expect(decodeURIComponent(url.split("query=")[1])).toBe(
      "씨월드고속훼리 목포항 제주 시간표",
    );
  });

  it("여행월 · 가장 궂은 달", () => {
    expect(tripMonth("2026-01-15")).toBe(1);
    expect(tripMonth(null)).toBeNull();
    expect(worstMonth(FERRY_STATS.pohang)).toEqual({ month: 12, pct: 24.2 });
    // 같은 값이면 이른 달(PoC sort 안정 정렬)
    expect(worstMonth(FERRY_STATS.incheon)).toEqual({ month: 1, pct: 3.4 });
  });

  it("운항 실적: 여행월 통제율 · 단계 · 막대 · 경고(6% 이상)", () => {
    const jan = ferryStatView("wando", "2026-01-10")!;
    expect(jan.month).toBe(1);
    expect(jan.tripPct).toBe(6.5);
    expect(jan.warn).toBe(true);
    expect(jan.level).toBe("warn");
    expect(jan.yearLevel).toBe("normal");
    // 막대: 최댓값 max(5, 6.5) = 6.5 → 1월 26px, 9월 1.2 → round(4.8) = 5px
    expect(jan.bars[0]).toMatchObject({ month: 1, px: 26, trip: true });
    expect(jan.bars[8]).toMatchObject({ month: 9, px: 5, trip: false });

    const may = ferryStatView("wando", "2026-05-10")!;
    expect(may.warn).toBe(false);

    // 날짜가 없으면 여행월 없이 가장 궂은 달, 단계는 연중 통제율
    const none = ferryStatView("pohang", null)!;
    expect(none.tripPct).toBeNull();
    expect(none.warn).toBe(false);
    expect(none.worst.month).toBe(12);
    expect(none.level).toBe("warn");
    expect(none.bars.every((b) => !b.trip)).toBe(true);

    // 실적이 적어 최댓값이 5% 밑이면 5%를 기준으로(최소 2px)
    const mokpo = ferryStatView("mokpo", "2026-04-01")!;
    expect(mokpo.bars[3].px).toBe(2);
    expect(mokpo.bars[11].px).toBe(Math.round((2 / 5) * 26));

    // 실적이 없는 항로(부산)는 없다
    expect(ferryStatView("busan", "2026-01-01")).toBeNull();
  });

  it("통제율 단계: 6% · 15%", () => {
    expect(ferryLevel(5.9)).toBe("normal");
    expect(ferryLevel(6)).toBe("warn");
    expect(ferryLevel(14.9)).toBe("warn");
    expect(ferryLevel(15)).toBe("bad");
  });
});

describe("코스 설정 저장 (jejuResident)", () => {
  it("parseSettings: 참 · 거짓만 받고 없으면 null, pickSettings에 들어간다", () => {
    expect(parseSettings({}).jejuResident).toBeNull();
    expect(parseSettings({ jejuResident: false }).jejuResident).toBe(false);
    expect(parseSettings({ jejuResident: true }).jejuResident).toBe(true);
    expect(parseSettings({ jejuResident: "yes" }).jejuResident).toBeNull();
    expect(pickSettings(parseSettings({ jejuResident: true }))).toMatchObject({
      jejuResident: true,
    });
  });
});
