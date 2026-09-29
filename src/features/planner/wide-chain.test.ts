import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  type PlannerSettings,
  parseSettings,
  pickSettings,
} from "./course-store";
import { findPlace, type PlannerPlace } from "./data";
import { directionsBetweenUrl } from "./directions";
import {
  findStation,
  lineStations,
  metroLines,
  stationLabel,
  stationPoint,
} from "./metro";
import { CITY_HUBS, PLANNER_ORIGINS } from "./regions";
import {
  buildPlannerSchedule,
  originFor,
  recommendCourse,
  routeAsk,
  wideOptions,
} from "./schedule";
import {
  airTwin,
  chainSchedule,
  fixOriginsForWide,
  gatewayOptions,
  gwWideOf,
  originOptions,
  routeCands,
  wideChain,
  wideOriginFilter,
  wideOrder,
} from "./wide-chain";

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
  endDate: "2026-09-27",
  ...fields,
});
const opts = { own: false, pref: null, gwPick: {} } as const;

describe("수단 먼저 → 출발지 (PoC WIDE_ALLOW · wideOriginFilter · airTwin · gwWideOf)", () => {
  it("고른 수단의 관문만 남기고, 맞는 곳이 없으면 전체", () => {
    expect(wideOriginFilter(["seoul", "centralcity"], "bus")).toEqual([
      "centralcity",
    ]);
    expect(wideOriginFilter(["seoul", "centralcity"], "air")).toEqual([
      "seoul",
      "centralcity",
    ]);
    expect(wideOriginFilter(["seoul"], "own")).toEqual(["seoul"]);
  });

  it("리무진 공항 항목은 항공 관문으로 읽는다", () => {
    expect(airTwin("gimpoAir")).toBe("gimpoAirF");
    expect(airTwin("gimpoAirF")).toBe("gimpoAirF");
    expect(airTwin("seoul")).toBe("seoul");
  });

  it("관문 종류 → 광역 교통(섞인 관문은 null)", () => {
    expect(gwWideOf("gimpoAir")).toBe("air");
    expect(gwWideOf("wandoPort")).toBe("ship");
    expect(gwWideOf("osong")).toBe("rail");
    expect(gwWideOf("daejeonBus")).toBe("bus");
    // 서울역은 KTX · 전철이 함께 서서 정하지 않는다(PoC와 같다)
    expect(gwWideOf("seoul")).toBeNull();
  });

  it("출발지 목록: 도착 관문 수단 · 기차역 → 터미널 → 공항 → 항만 순 · 고른 수단", () => {
    const all = originOptions(H["경주"], null);
    // 경주 관문(KTX · SRT · 버스)에 없는 항공 · 배 출발지는 빠진다
    expect(all.some((k) => O[k].modes.includes("air"))).toBe(false);
    const firstBus = all.findIndex((k) => !/ktx|srt/.test(O[k].modes.join()));
    expect(
      all
        .slice(firstBus)
        .every((k) => !O[k].modes.some((m) => m === "ktx" || m === "srt")),
    ).toBe(true);
    // 리무진 공항 항목은 버스일 때만
    expect(all).not.toContain("gimpoAir");
    const bus = originOptions(H["경주"], "bus");
    expect(bus.every((k) => O[k].modes.includes("bus"))).toBe(true);
    expect(bus).toContain("gimpoAir");
    const jeju = originOptions(H["제주"], "air");
    expect(jeju[0]).toBe("gimpoAirF");
    expect(jeju.every((k) => O[k].modes.includes("air"))).toBe(true);
    // 울릉 항로 항구는 울릉 여행에만
    expect(originOptions(H["제주"], "ship")).not.toContain("pohangPort");
    expect(originOptions(H["울릉"], "ship", true)).toContain("pohangPort");
  });

  it("수단을 바꿔 출발지가 맞지 않으면 그 수단의 첫 관문으로, 귀가지는 비운다", () => {
    expect(fixOriginsForWide("bus", "seoul", null)).toEqual({
      origin: "centralcity",
    });
    expect(fixOriginsForWide("air", "seoul", "busanStn")).toEqual({
      origin: "gimpoAirF",
      originEnd: null,
    });
    expect(fixOriginsForWide("rail", "seoul", "daeguStn")).toEqual({});
    expect(fixOriginsForWide("metro", "centralcity", null)).toEqual({});
  });

  it("광역 교통 칸: 도착 관문에 없으면 막고, 지하철은 막지 않는다", () => {
    const by = Object.fromEntries(
      wideOptions(H["경주"]).map((o) => [o.choice, o.block]),
    );
    expect(by).toEqual({
      bus: null,
      rail: null,
      air: "hub",
      ship: "hub",
      metro: null,
      own: null,
    });
    const jeju = Object.fromEntries(
      wideOptions(H["제주"]).map((o) => [o.choice, o.block]),
    );
    expect(jeju.own).toBe("island");
    expect(jeju.air).toBeNull();
    expect(wideOptions(undefined).every((o) => o.block === "noCity")).toBe(
      true,
    );
  });

  it("선호 수단을 앞으로 당긴다", () => {
    expect(wideOrder("rail")).toEqual([
      "ktx",
      "srt",
      "metro",
      "bus",
      "air",
      "ship",
    ]);
    expect(wideOrder(null)[0]).toBe("metro");
  });
});

// PoC Tour Planner.dc.html wideChain · chainSchedule · dayWindows를 손으로 계산한 값과 맞춘다.
// 거리 = 하버사인(R 6371) × 1.35, KTX 본 구간 18 + d × 0.30, 버스 20 + d × 0.68, 항공 90 + d × 0.11,
// 전철 접근 15 + d × 1.2, 본 구간 앞 환승 = (도착 + 15)를 10분 단위 올림, 도착 관문 → 첫 장소 = legInfo transit(15 + d × 3.6)
describe("광역 체인 — PoC 손계산 대조", () => {
  it("① 서울역 → 경주 KTX: 직행 128분, 08:00 → 10:08, 첨성대 10:52", () => {
    const c = wideChain(O.seoul, "seoul", H["경주"], opts)!;
    expect(c.mode).toBe("ktx");
    expect(c.gw).toBe(O.seoul);
    expect(c.hubPt.ko).toBe("신경주역 (KTX·SRT)");
    expect(c.legs).toHaveLength(1);
    expect(c.legs[0].min).toBe(128);
    expect(chainSchedule(c, at("08:00")).end).toBe(608);
    // 출발지가 관문이고 KTX가 닿으면 경로는 하나
    expect(routeCands(O.seoul, "seoul", H["경주"], opts)).toHaveLength(1);

    const plan = buildPlannerSchedule(
      [place("gjx3"), place("gj3")],
      settings({ origin: "seoul" }),
    );
    // 신경주역 → 첨성대 8.0km, 대중교통 44분 → accIn 128 + 44
    expect(plan.firstLeg).toBe(44);
    expect(plan.accIn).toBe(172);
    expect(plan.days[0].stops[0].arrive).toBe("10:52");
    // 동궁과 월지 → 신경주역 46분만큼 여행지 출발 시각(19:00)을 당긴다
    expect(plan.lastLeg).toBe(46);
    expect(plan.ctx.retTime).toBe("18:14");
    expect(plan.arrival).toMatchObject({ mode: "transit", min: 44 });
  });

  it("② 운길산역(지하철) → 경주: 전철 64분 → 서울역 환승 16분 → 09:20 KTX → 11:28, 버스 경로까지 2개", () => {
    const s = settings({
      wideMode: "metro",
      metroLine: "경의중앙",
      metroOrigin: "운길산",
    });
    const o = originFor(s, "seoul", "경주", false);
    expect(o.ko).toBe("운길산역");
    const c = wideChain(o, "seoul", H["경주"], { ...opts, pref: "metro" })!;
    expect(c.mode).toBe("ktx");
    expect(c.gw).toBe(O.seoul);
    expect(c.legs.map((l) => [l.mode, l.min])).toEqual([
      ["metro", 64],
      ["ktx", 128],
    ]);
    const sc = chainSchedule(c, at("08:00"));
    expect(sc.steps[1]).toMatchObject({ t: 544, wait: 16, depAt: 560 });
    expect(sc.end).toBe(688);
    // 돌아올 때: 19:00 KTX → 21:08 서울역 → 10분 뒤 전철 64분 → 22:22
    expect(chainSchedule(c, at("19:00"), true).end).toBe(1342);

    const cands = routeCands(o, "seoul", H["경주"], {
      ...opts,
      pref: "metro",
    });
    expect(cands.map((x) => x.mode)).toEqual(["ktx", "bus"]);
    const bus = cands[1];
    expect(bus.gw).toBe(O.centralcity);
    expect(bus.hubPt.ko).toBe("경주고속버스터미널");
    expect(bus.legs.map((l) => l.min)).toEqual([60, 268]);
    expect(chainSchedule(bus, at("08:00")).end).toBe(828);

    const plan = buildPlannerSchedule([place("gjx3")], s);
    expect(plan.accIn).toBe(688 - 480 + 44);
    expect(plan.days[0].stops[0].arrive).toBe("12:12");
    expect(plan.inbound?.cands).toHaveLength(2);
    // 고른 경로(routePick)가 체인 수단을 바꾼다
    const byBus = buildPlannerSchedule([place("gjx3")], {
      ...s,
      routePick: { 경주: "bus" },
    });
    expect(byBus.wide).toBe("bus");
  });

  it("③ 김포공항 → 제주 항공: 90 + 거리, 157분 08:00 → 10:37, 오래물광장 11:03", () => {
    const c = wideChain(O.gimpoAirF, "gimpoAirF", H["제주"], opts)!;
    expect(c.mode).toBe("air");
    expect(c.hubPt.ko).toBe("제주국제공항");
    expect(c.legs[0].min).toBe(157);
    expect(chainSchedule(c, at("08:00")).end).toBe(637);
    const plan = buildPlannerSchedule(
      [place("ctu3")],
      settings({ origin: "gimpoAirF", wideMode: "air" }),
    );
    expect(plan.firstLeg).toBe(26);
    expect(plan.days[0].stops[0].arrive).toBe("11:03");
  });

  it("공항 · 항만 본 구간은 환승 올림을 하지 않는다(수속이 본 구간에 들어 있다)", () => {
    // 서울역 → 제주: 가장 가까운 항공 관문(김포공항)까지 전철, 항공은 도착 즉시
    const c = wideChain(O.seoul, "seoul", H["제주"], opts)!;
    expect(c.mode).toBe("air");
    expect(c.gw).toBe(O.gimpoAirF);
    const sc = chainSchedule(c, at("08:00"));
    expect(sc.steps[1].wait).toBeUndefined();
    expect(sc.end).toBe(at("08:00") + c.legs[0].min + c.legs[1].min);
  });

  it("자가용은 관문 없이 한 구간", () => {
    const c = wideChain(O.seoul, "seoul", H["경주"], { ...opts, own: true })!;
    expect(c.mode).toBe("own");
    expect(c.legs).toHaveLength(1);
    expect(
      routeCands(O.seoul, "seoul", H["경주"], { ...opts, own: true }),
    ).toEqual([]);
  });

  it("환승 관문: 90km 안 그 수단 관문 가까운 순 8곳, 고른 관문(gwPick)을 쓴다", () => {
    const o = stationPoint(findStation("운길산")!);
    const c = wideChain(o, "seoul", H["경주"], opts)!;
    const keys = gatewayOptions(c, o);
    expect(keys.length).toBeGreaterThan(1);
    expect(keys.length).toBeLessThanOrEqual(8);
    expect(keys.every((k) => O[k].modes.includes("ktx"))).toBe(true);
    expect(keys).toContain("seoul");
    const picked = wideChain(o, "seoul", H["경주"], {
      ...opts,
      gwPick: { ktx: "cheongnyangni" },
    })!;
    expect(picked.gw).toBe(O.cheongnyangni);
    // 출발지가 곧 관문이면 고르지 않는다
    const direct = wideChain(O.seoul, "seoul", H["경주"], opts)!;
    expect(gatewayOptions(direct, O.seoul)).toEqual([]);
  });
});

describe("첫날 · 마지막 날 창 · 귀가지", () => {
  it("귀가지를 바꾸면 돌아오는 체인이 바뀐다", () => {
    const course = [place("gjx3"), place("gj3")];
    const same = buildPlannerSchedule(course, settings({}));
    const other = buildPlannerSchedule(
      course,
      settings({ originEnd: "busanStn" }),
    );
    expect(same.outbound?.origin).toBe(O.seoul);
    expect(other.outbound?.origin).toBe(O.busanStn);
    expect(other.outbound!.schedule.end).toBeLessThan(
      same.outbound!.schedule.end,
    );
  });

  it("추천 코스는 lastLeg를 뺀 마지막 날 창에 다 들어간다", () => {
    for (const days of [1, 2, 3]) {
      const s = settings({
        endDate: `2026-09-${String(26 + days).padStart(2, "0")}`,
      });
      const pool = [
        place("gjx1"),
        place("gjx2"),
        place("gjx3"),
        place("gj3"),
      ].map((p) => ({ ...p, auto: true }));
      const course = recommendCourse(pool, s, "경주");
      const plan = buildPlannerSchedule(course, s);
      expect(plan.dropped).toEqual([]);
      const last = plan.days.at(-1)!.stops.at(-1);
      if (last)
        expect(last.leaveMin + plan.lastLeg).toBeLessThanOrEqual(at("19:00"));
    }
  });
});

describe("경로 선택 창 (PoC routeAsk)", () => {
  const s = settings({
    wideMode: "metro",
    metroLine: "경의중앙",
    metroOrigin: "운길산",
  });
  const plan = buildPlannerSchedule([place("gjx3")], s);

  it("후보가 2개 이상이면 스스로 연다. 고르거나 닫은 도시는 다시 열지 않는다", () => {
    expect(routeAsk(plan, s, {}, null)?.target).toEqual({
      city: "경주",
      dir: "in",
    });
    expect(routeAsk(plan, { routePick: { 경주: "ktx" } }, {}, null)).toBeNull();
    expect(routeAsk(plan, s, { 경주: true }, null)).toBeNull();
    // 「경로 변경」으로 열면 닫은 도시도 연다
    expect(
      routeAsk(plan, s, { 경주: true }, { city: "경주", dir: "in" })?.side
        .cands,
    ).toHaveLength(2);
  });

  it("출발지가 관문이면(서울역 KTX) 경로가 하나라 열지 않는다", () => {
    const p = buildPlannerSchedule([place("gjx3")], settings({}));
    expect(routeAsk(p, settings({}), {}, null)).toBeNull();
  });
});

describe("지하철 호선 → 역 (PoC metroLineOptions · metroOrg)", () => {
  it("호선은 PoC 순서, 부산 호선은 뒤", () => {
    const lines = metroLines();
    expect(lines.slice(0, 3)).toEqual(["1", "2", "3"]);
    expect(lines).toContain("경의중앙");
    expect(lines.at(-1)).toBe("D");
  });

  it("역 목록 · 이름 · 같은 이름(중앙)은 고른 호선 쪽", () => {
    expect(lineStations("경의중앙", "ko").some((x) => x.ko === "운길산")).toBe(
      true,
    );
    expect(stationLabel(findStation("서울역")!, "ko")).toBe("서울역");
    expect(stationLabel(findStation("운길산")!, "ko")).toBe("운길산역");
    expect(stationLabel(findStation("운길산")!, "en")).toBe("Ungilsan");
    expect(findStation("중앙", "B1")!.lat).toBeLessThan(36);
    expect(findStation("중앙", "4")!.lat).toBeGreaterThan(37);
  });

  it("출발점: 지하철이면 고른 역, 귀가역이 없으면 출발역, 전철권 도시면 출발 전철역", () => {
    const s = settings({
      wideMode: "metro",
      metroOrigin: "운길산",
      metroLine: "경의중앙",
    });
    expect(originFor(s, "seoul", "경주", false, true).ko).toBe("운길산역");
    expect(
      originFor(
        { ...s, metroEnd: "시청", metroEndLine: "1" },
        "seoul",
        "경주",
        false,
        true,
      ).ko,
    ).toBe("시청역");
    const city = { ...s, wideMode: null };
    expect(originFor(city, "seoul", "경주", false)).toBe(O.seoul);
    expect(originFor(city, "seoul", "양평", false).ko).toBe("운길산역");
    expect(originFor(s, "seoul", "경주", true)).toBe(O.seoul);
  });
});

describe("도착 후 길찾기 주소", () => {
  const a = { name: "신경주역", lat: 35.87, lng: 129.17 };
  const b = { name: "첨성대, 경주", lat: 35.83, lng: 129.21 };
  it("한국어는 카카오맵, 그 밖은 Google 지도(언어 hl)", () => {
    expect(directionsBetweenUrl(a, b, "transit", "ko")).toBe(
      `https://map.kakao.com/link/from/${encodeURIComponent("신경주역")},35.87,129.17/to/${encodeURIComponent("첨성대  경주")},35.83,129.21`,
    );
    expect(directionsBetweenUrl(a, b, "driving", "zh")).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=35.87,129.17&destination=35.83,129.21&travelmode=driving&hl=zh-CN",
    );
  });
});

describe("코스 설정 저장 (parseSettings)", () => {
  it("귀가지 · 고른 경로 · 환승 관문 · 지하철 역을 검사해 채운다", () => {
    const v = parseSettings({
      originEnd: "busanStn",
      routePick: { 경주: "bus", 나쁨: 3 },
      gwPick: { ktx: "yongsan", bus: "없는관문" },
      metroLine: "경의중앙",
      metroOrigin: "운길산",
      metroEnd: 7,
    });
    expect(v).toMatchObject({
      originEnd: "busanStn",
      routePick: { 경주: "bus" },
      gwPick: { ktx: "yongsan" },
      metroLine: "경의중앙",
      metroOrigin: "운길산",
      metroEndLine: "",
      metroEnd: "",
    });
    expect(parseSettings({ originEnd: "없음" }).originEnd).toBeNull();
    // 예전 플랜(필드 없음)은 기본값
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(Object.keys(pickSettings(v))).toEqual(Object.keys(DEFAULT_SETTINGS));
  });
});
