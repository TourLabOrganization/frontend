import { afterEach, describe, expect, it, vi } from "vitest";
import { PLANNER_PLACES } from "../features/planner/data";
import { tourPlaceSigngu } from "./tour-api";
import { citySigngu } from "./tour-popular";
import {
  addedId,
  allTargets,
  collectPopular,
  homeTargets,
  cityTourStops,
  collectCityTour,
} from "./tour-collect";

describe("조회 대상", () => {
  it("추가 장소 id는 pop<contentid>", () => {
    expect(addedId("2672689")).toBe("pop2672689");
    expect(addedId(" 12 ")).toBe("pop12");
    expect(addedId("kto:1")).toBeNull();
    expect(addedId("")).toBeNull();
  });

  it("홈 칩 도시는 홈과 같은 시군구, 풀은 그 도시 장소(숙박 제외)", () => {
    const [seoul] = homeTargets(["서울"]);
    expect(seoul.codes).toEqual(citySigngu("서울"));
    expect(
      seoul.pool.every((p) => p.locKo === "서울" && p.cat !== "stay"),
    ).toBe(true);
    expect(homeTargets(["없는도시"])).toEqual([]);
  });

  it("전국: 장소가 있는 시군구 전부를 한 번씩, 두 도시에 걸친 시군구는 장소가 많은 도시에", () => {
    const targets = allTargets();
    const regions = new Set(
      PLANNER_PLACES.filter((p) => p.cat !== "stay").map((p) => p.locKo),
    );
    expect(new Set(targets.map((t) => t.region))).toEqual(regions);
    const codes = targets.flatMap((t) => t.codes);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^\d{5}$/);
    // 기장군(26710)은 부산(17곳)에 붙고 양산에서는 빠진다
    const busan = targets.find((t) => t.region === "부산")!;
    const yangsan = targets.find((t) => t.region === "양산")!;
    expect(busan.codes).toContain("26710");
    expect(yangsan.codes).not.toContain("26710");
    // 풀은 그 도시 장소 + 그 시군구 코드의 장소(도시가 달라도): 다른 도시에 적힌 장소가 그 시군구 코드면 풀에 들어간다
    for (const t of targets)
      for (const p of PLANNER_PLACES)
        if (
          p.cat !== "stay" &&
          p.locKo !== t.region &&
          t.codes.includes(tourPlaceSigngu(p.id))
        )
          expect(
            t.pool.map((q) => q.id),
            `${t.region} ${p.id}`,
          ).toContain(p.id);
    expect(allTargets(undefined, undefined, 1, ["경주"])).toMatchObject([
      { region: "경주", codes: ["47130"] },
    ]);
  });

  it("합성 자료: 최소 장소 수 · 같은 수면 이름 순 · 숙박 제외", () => {
    const places = [
      { id: "a1", locKo: "가", cat: "herit" },
      { id: "a2", locKo: "가", cat: "herit" },
      { id: "b1", locKo: "나", cat: "herit" },
      { id: "b2", locKo: "나", cat: "herit" },
      { id: "b3", locKo: "나", cat: "stay" },
      { id: "c1", locKo: "다", cat: "food" },
    ] as unknown as (typeof PLANNER_PLACES)[number][];
    const signgu = (id: string) =>
      ({
        a1: "11110",
        a2: "11110",
        b1: "11110",
        b2: "11110",
        b3: "11110",
        c1: "22220",
      })[id] ?? "";
    expect(allTargets(places, signgu)).toMatchObject([
      { region: "가", codes: ["11110"] },
      { region: "다", codes: ["22220"] },
    ]);
    expect(allTargets(places, signgu, 2)).toMatchObject([
      { region: "가", codes: ["11110"] },
    ]);
  });
});

describe("collectPopular", () => {
  afterEach(() => vi.unstubAllGlobals());

  const body = (item: unknown[]) =>
    Response.json({
      response: {
        header: { resultCode: "0000" },
        body: { items: item.length ? { item } : "", totalCount: item.length },
      },
    });
  const crowd = (name: string, rate: number, signgu = "47130") => ({
    tAtsNm: name,
    baseYmd: "20261001",
    cnctrRate: String(rate),
    signguCd: signgu,
    signguNm: "경주시",
  });

  it("이름 → 위치 → 추가 장소 → 못 찾음, 같은 곳은 한 번만", async () => {
    const wol = PLANNER_PLACES.find((p) => p.id === "gjx6")!; // 월정교
    const search: Record<string, unknown[]> = {
      "교촌 다리 조명": [
        {
          contentid: "1001",
          title: "교촌 다리 조명",
          contenttypeid: "12",
          mapy: String(wol.lat + 0.001),
          mapx: String(wol.lng),
          lDongRegnCd: "47",
          lDongSignguCd: "130",
        },
      ],
      새전망대: [
        {
          contentid: "2002",
          title: "새전망대",
          contenttypeid: "14",
          mapy: "35.80",
          mapx: "129.30",
          lDongRegnCd: "47",
          lDongSignguCd: "130",
          firstimage: "http://tong.visitkorea.or.kr/a.jpg",
          addr1: "경상북도 경주시 어딘가 1",
          overview: "새로 생긴 <b>전망대</b>",
        },
      ],
      없는곳: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.pathname.includes("tatsCnctrRatedList"))
          return body(
            url.searchParams.get("signguCd") === "47130"
              ? [
                  crowd("불국사", 50),
                  crowd("교촌 다리 조명", 40),
                  crowd("새전망대", 30),
                  crowd("없는곳", 20),
                ]
              : [],
          );
        if (url.pathname.includes("searchKeyword2"))
          return body(search[url.searchParams.get("keyword") ?? ""] ?? []);
        return body([]); // 다국어 이름 없음
      }),
    );
    const targets = homeTargets(["경주"]);
    const { candidates, places } = await collectPopular("k", targets, {
      now: new Date("2026-10-01T03:00:00Z"),
    });
    // 집중률 · 관광정보 검색 모두 캐시 없이(개발 서버에 남은 하루 전 응답을 쓰지 않게)
    const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock
      .calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [, init] of calls)
      expect((init as RequestInit).cache).toBe("no-store");
    expect(candidates.map((c) => [c.verdict, c.id])).toEqual([
      ["existing-name", "gjx1"],
      ["existing-location", "gjx6"],
      ["new", "pop2002"],
      ["missing", null],
    ]);
    expect(places).toHaveLength(1);
    const p = places[0];
    expect(p).toMatchObject({
      id: "pop2002",
      ko: "새전망대",
      locKo: "경주",
      pickCity: "경주",
      macro: "daegyeong",
      cat: "herit",
      min: 60,
      hrs: "",
      off: true,
      auto: true,
      signgu: "47130",
      contentid: "2002",
      addr: "경상북도 경주시 어딘가 1",
      photo: "https://tong.visitkorea.or.kr/a.jpg",
      desc: "새로 생긴 전망대",
    });
    expect(p.source).toContain("contentid 2002");
    expect(p.en).not.toBe("");

    // 같은 실행 안에서 다른 지역(같은 시군구 코드를 다시 보는 합성 대상)에 또 나와도 두 번 만들지 않는다
    const again = await collectPopular(
      "k",
      [targets[0], { ...targets[0], region: "경주2" }],
      { now: new Date("2026-10-01T03:00:00Z") },
    );
    expect(again.places).toHaveLength(1);
    expect(
      again.candidates
        .filter((c) => c.name === "새전망대")
        .map((c) => c.verdict),
    ).toEqual(["new", "existing-name"]);
  });

  it("시군구가 모두 실패한 지역은 건너뛰고, 기준 날짜 행이 없어도 건너뛴다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.searchParams.get("signguCd") === "47130")
          return new Response("bad", { status: 500 });
        return body([
          crowd("옛날", 10).baseYmd
            ? { ...crowd("옛날", 10, "51210"), baseYmd: "20250101" }
            : {},
        ]);
      }),
    );
    const log: string[] = [];
    const { candidates, places } = await collectPopular(
      "k",
      homeTargets(["경주", "속초"]),
      { now: new Date("2026-10-01T03:00:00Z"), log: (l) => log.push(l) },
    );
    expect(candidates).toEqual([]);
    expect(places).toEqual([]);
    expect(log).toEqual(["경주: 모든 시군구 실패", "속초: 기준 날짜 행 없음"]);
  });
});

describe("오디 해설이 있는 관광지(collectOdii)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("주소 → 지역, 이름 낱말 → 분류", async () => {
    const { odiiRegion, odiiRuleCategory } = await import("./tour-collect");
    expect(odiiRegion("경상북도", "경주시")).toBe("경주");
    expect(odiiRegion("서울특별시", "종로구")).toBe("서울");
    expect(odiiRegion("광주광역시", "동구")).toBe("광주");
    expect(odiiRegion("경기도", "광주시")).toBe("경기광주");
    expect(odiiRegion("강원특별자치도", "고성군")).toBe("고성(강원)");
    expect(odiiRegion("제주특별자치도", "서귀포시")).toBe("제주");
    expect(odiiRegion("", "")).toBe("");
    expect(odiiRuleCategory("경포해변")).toBe("sea");
    expect(odiiRuleCategory("불국사")).toBe("herit");
    expect(odiiRuleCategory("아부오름")).toBe("heal");
    expect(odiiRuleCategory("경주월드")).toBe("activity");
    expect(odiiRuleCategory("서문시장")).toBe("food");
  });

  it("기존(이름 · 위치) → 관광정보 있음(pop) → 없음(odii) → 지역 없음", async () => {
    const { collectOdii } = await import("./tour-collect");
    const wol = PLANNER_PLACES.find((p) => p.id === "gjx6")!; // 월정교
    const body = (item: unknown[]) =>
      Response.json({
        response: {
          header: { resultCode: "0000" },
          body: { items: item.length ? { item } : "", totalCount: item.length },
        },
      });
    const theme = (
      tid: string,
      title: string,
      lat: number,
      lng: number,
      addr1: string,
      addr2: string,
    ) => ({
      tid,
      title,
      mapY: String(lat),
      mapX: String(lng),
      addr1,
      addr2,
      themeCategory: "신라 역사 여행",
    });
    const search: Record<string, unknown[]> = {
      새해설전망대: [
        {
          contentid: "9001",
          title: "새해설전망대",
          contenttypeid: "14",
          mapy: "35.8005",
          mapx: "129.3005",
          lDongRegnCd: "47",
          lDongSignguCd: "130",
          addr1: "경북 경주시 어딘가 1",
        },
      ],
      새해설오름: [],
      주소없는곳: [
        {
          contentid: "9002",
          title: "주소없는곳",
          contenttypeid: "12",
          mapy: "35.0",
          mapx: "129.0",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.pathname.includes("themeBasedList"))
          return body([
            theme("2", "경주 불국사", 35.7923, 129.3317, "경상북도", "경주시"),
            theme(
              "3",
              "신라의 밤 다리",
              wol.lat + 0.001,
              wol.lng,
              "경상북도",
              "경주시",
            ),
            theme("4", "새해설전망대", 35.8, 129.3, "경상북도", "경주시"),
            theme("5", "새해설오름", 33.4, 126.6, "제주특별자치도", "서귀포시"),
            theme("6", "주소없는곳", 35.8, 129.31, "", ""),
            theme("7", "바다 한가운데", 34.0, 126.0, "", ""),
          ]);
        if (url.pathname.includes("searchKeyword2"))
          return body(search[url.searchParams.get("keyword") ?? ""] ?? []);
        return body([]);
      }),
    );
    const { candidates, places } = await collectOdii("k");
    for (const [, init] of (
      fetch as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls)
      expect((init as RequestInit).cache).toBe("no-store");
    expect(candidates.map((c) => [c.verdict, c.id, c.regionBy])).toEqual([
      ["existing-name", "gjx1", "address"],
      ["existing-location", "gjx6", "address"],
      ["new", "pop9001", "address"],
      ["new", "odii5", "address"],
      ["new", "odii6", "nearest"],
      ["no-region", null, "none"],
    ]);
    expect(
      places.map((p) => [p.id, p.locKo, p.cat, p.macro, p.signgu]),
    ).toEqual([
      ["pop9001", "경주", "herit", "daegyeong", "47130"],
      ["odii5", "제주", "heal", "jeju", ""],
      ["odii6", "경주", "herit", "daegyeong", ""],
    ]);
    expect(places[0].lat).toBeCloseTo(35.8005, 4);
    expect(places[1].source).toContain("오디 tid 5");
    expect(places[1].desc).toContain("신라 역사 여행");
    // 같은 지역에 다른 이름으로 또 돌려도 두 번 만들지 않는다
    const again = await collectOdii("k", { regions: ["경주"] });
    expect(again.candidates.map((c) => c.verdict)).toEqual([
      "existing-name",
      "existing-location",
      "new",
      "new",
    ]);
  });
});

describe("시티투어 경유지 중 앱에 없는 관광지(cityTourStops · collectCityTour)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const tour = (
    region: string,
    name: string,
    route: string,
    visits = [region],
  ) => ({
    region,
    visits,
    name,
    kind: "fixed" as const,
    board: "",
    route,
    first: "",
    last: "",
    fare: "",
    tel: "",
    url: "",
    date: "",
    city: null,
    placeIds: [],
  });
  const tours = [
    tour(
      "서울",
      "EG투어버스 A코스",
      "서울 → DMZ투어(곤돌라) → 새경유지 → 오두산 통일전망대 → 중식 → 서울",
      ["파주"],
    ),
    tour("서울", "EG투어버스 Z코스", "서울 → 새경유지 → 박물관 → 2곳 → 서울", [
      "파주",
    ]),
    tour("경주", "시티투어", "경주역 → 불국사 → 새전망대 → 경주역"),
  ];

  it("식사 · 역 · 일반 명사는 빼고, 지역은 첫 여행지, 같은 이름은 노선 수로 모은다(노선 많은 순)", () => {
    expect(cityTourStops(tours)).toEqual([
      // 오두산 통일전망대는 파주 장소(nax727)와 맞아 후보가 아니다(여행지 도시 풀)
      { region: "파주", name: "새경유지", tours: 2 },
      { region: "경주", name: "새전망대", tours: 1 },
      { region: "파주", name: "DMZ투어", tours: 1 },
    ]);
  });

  it("이름 → 관광정보(그 도시 시군구만) → 위치 → 추가 장소. 다른 도시 결과는 쓰지 않는다", async () => {
    const wol = PLANNER_PLACES.find((p) => p.id === "gjx6")!; // 월정교
    const search: Record<string, unknown[]> = {
      새경유지: [
        {
          contentid: "3003",
          title: "새경유지",
          contenttypeid: "12",
          mapy: "37.76",
          mapx: "126.68",
          lDongRegnCd: "41",
          lDongSignguCd: "480",
          addr1: "경기도 파주시 탄현면",
        },
      ],
      새전망대: [
        // 다른 도시(서울 종로)의 같은 이름은 거른다
        {
          contentid: "9",
          title: "새전망대",
          contenttypeid: "12",
          mapy: "37.58",
          mapx: "126.98",
          lDongRegnCd: "11",
          lDongSignguCd: "110",
        },
        {
          contentid: "2002",
          title: "새전망대",
          contenttypeid: "14",
          mapy: String(wol.lat + 0.001),
          mapx: String(wol.lng),
          lDongRegnCd: "47",
          lDongSignguCd: "130",
        },
      ],
    };
    const body = (item: unknown[]) => ({
      response: {
        header: { resultCode: "0000" },
        body: { items: item.length ? { item } : "", totalCount: item.length },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.pathname.includes("searchKeyword2"))
          return Response.json(
            body(search[url.searchParams.get("keyword") ?? ""] ?? []),
          );
        return Response.json(body([]));
      }),
    );
    const { candidates, places } = await collectCityTour("k", { tours });
    expect(candidates.map((c) => [c.region, c.name, c.verdict, c.id])).toEqual([
      ["파주", "새경유지", "new", "pop3003"],
      ["경주", "새전망대", "existing-location", "gjx6"],
      ["파주", "DMZ투어", "missing", null],
    ]);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      id: "pop3003",
      ko: "새경유지",
      locKo: "파주",
      pickCity: "파주",
      signgu: "41480",
    });
    expect(places[0].source).toContain("시티투어 경유지(2개 노선)");
  });
});
