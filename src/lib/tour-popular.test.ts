import { afterEach, describe, expect, it, vi } from "vitest";
import { PLANNER_PLACES } from "../features/planner/data";
import { tourPlaceSigngu } from "./tour-api";
import { isPlannerCity } from "../features/planner/regions";
import { POPULAR_CITIES } from "./tour";
import {
  citySigngu,
  districtItems,
  findPopular,
  isPopularCity,
  boundaryMatch,
  matchByLocation,
  matchByLocationNamed,
  matchPlace,
  matchPlaceElsewhere,
  nameOverlap,
  nameScore,
  pickSpotItem,
  pickSpotItemLoose,
  POPULAR_MAX_DISTRICTS,
  rankSpots,
  spotName,
} from "./tour-popular";

const row = (name: string, date: string, rate: number, signgu = "47130") => ({
  tAtsNm: name,
  baseYmd: date.replace(/-/g, ""),
  cnctrRate: String(rate),
  signguCd: signgu,
  signguNm: "경주시",
});

describe("도시 · 시군구", () => {
  it("홈 칩 도시는 모두 플래너 도시다(장소가 있다)", () => {
    for (const c of POPULAR_CITIES) {
      expect(isPlannerCity(c), c).toBe(true);
      expect(isPopularCity(c)).toBe(true);
    }
    expect(isPopularCity("평양")).toBe(false);
  });

  it("도시마다 장소가 많은 시군구 최대 4곳(5곳 이상)", () => {
    for (const c of POPULAR_CITIES) {
      const codes = citySigngu(c);
      expect(codes.length, c).toBeGreaterThan(0);
      expect(codes.length).toBeLessThanOrEqual(POPULAR_MAX_DISTRICTS);
      for (const code of codes) expect(code).toMatch(/^\d{5}$/);
    }
    expect(citySigngu("경주")).toEqual(["47130"]);
    // 서울: 종로 · 마포 · 영등포 · 용산(장소가 여러 구에 퍼져 있어도 4곳을 부른다)
    // 같은 장소 통합(2026-10-03)으로 송파(11710)가 서울스카이 · 가락시장 중복을 잃어 12곳, 용산(11170)도 YTN서울타워 중복을 잃어 12곳이 되어
    // 마포 · 영등포(13곳)가 앞서고, 같은 12곳 중 코드 순으로 용산이 들어간다
    expect(citySigngu("서울")).toEqual(["11110", "11440", "11560", "11170"]);
    expect(citySigngu("제주")).toEqual(["50110", "50130"]);
    expect(citySigngu("인천")).toHaveLength(4);
    // 대구 · 춘천(2026-10-04 추가): 달성 22 · 수성 10 · 군위 10 · 달서 9(같은 10곳은 코드 순), 춘천은 시 하나
    expect(citySigngu("대구")).toEqual(["27710", "27260", "27720", "27290"]);
    expect(citySigngu("춘천")).toEqual(["51110"]);
    expect(POPULAR_CITIES).not.toContain("여수");
    expect(citySigngu("없는도시")).toEqual([]);
  });

  it("합성 자료: 장소 5곳 미만 시군구는 빼고, 숙박은 세지 않는다", () => {
    const spots = (prefix: string, n: number, cat = "herit") =>
      Array.from({ length: n }, (_, i) => ({
        id: `${prefix}${i}`,
        locKo: "X",
        cat,
      }));
    const places = [
      ...spots("a", 9),
      ...spots("b", 5),
      ...spots("c", 4),
      ...spots("d", 6, "stay"),
    ] as never[];
    const codes: Record<string, string> = {
      a: "11110",
      b: "11140",
      c: "11170",
      d: "11200",
    };
    expect(citySigngu("X", places, (id) => codes[id[0]] ?? "")).toEqual([
      "11110",
      "11140",
    ]);
  });
});

describe("rankSpots", () => {
  it("오늘 집중률 높은 순, 같은 값이면 이름 순, 오늘 이전은 뺀다", () => {
    const got = rankSpots(
      [
        row("불국사", "2026-09-29", 80),
        row("첨성대", "2026-09-29", 91.5),
        row("대릉원", "2026-09-29", 80),
        row("불국사", "2026-09-30", 10),
        row("석굴암", "2026-09-28", 99),
      ],
      "2026-09-29",
    );
    expect(got?.date).toBe("2026-09-29");
    expect(got?.spots.map((s) => [s.name, s.rate])).toEqual([
      ["첨성대", 91.5],
      ["대릉원", 80],
      ["불국사", 80],
    ]);
  });

  it("오늘 값이 없으면 오늘 이후 가장 이른 날, 아무것도 없으면 null", () => {
    expect(
      rankSpots(
        [row("불국사", "2026-10-01", 50), row("첨성대", "2026-09-30", 40)],
        "2026-09-29",
      )?.date,
    ).toBe("2026-09-30");
    expect(
      rankSpots([row("불국사", "2026-09-01", 50)], "2026-09-29"),
    ).toBeNull();
    expect(
      rankSpots(
        [{ tAtsNm: "x", baseYmd: "2026", cnctrRate: "a" }],
        "2026-09-29",
      ),
    ).toBeNull();
  });

  it("같은 시군구 · 같은 이름이 여러 번이면 뒤의 값, 시군구가 다르면 따로", () => {
    const got = rankSpots(
      [
        row("해변", "2026-09-29", 30, "26350"),
        row("해변", "2026-09-29", 60, "26350"),
        row("해변", "2026-09-29", 50, "26500"),
      ],
      "2026-09-29",
    );
    expect(got?.spots.map((s) => [s.signgu, s.rate])).toEqual([
      ["26350", 60],
      ["26500", 50],
    ]);
  });
});

describe("matchPlace", () => {
  it("같은 도시 · 같은 시군구에서 이름이 맞는 플래너 장소", () => {
    const places = [
      { id: "p1", ko: "불국사", locKo: "경주", cat: "herit" },
      { id: "p2", ko: "경주 대릉원", locKo: "경주", cat: "herit" },
      { id: "p3", ko: "불국사", locKo: "부산", cat: "herit" },
    ] as never[];
    const sg = () => "47130";
    expect(
      matchPlace({ name: "불국사", signgu: "47130" }, "경주", places, sg)?.id,
    ).toBe("p1");
    expect(
      matchPlace({ name: "대릉원", signgu: "47130" }, "경주", places, sg)?.id,
    ).toBe("p2");
    expect(
      matchPlace({ name: "석굴암", signgu: "47130" }, "경주", places, sg),
    ).toBeNull();
    // 같은 시군구만 본다(시군구 경계 장소는 관광정보 검색 뒤 boundaryMatch)
    expect(
      matchPlace({ name: "불국사", signgu: "11110" }, "경주", places, sg),
    ).toBeNull();
  });

  it("같은 시군구의 품는 이름(2점)이 다른 시군구의 같은 이름(3점)보다 먼저다", () => {
    const places = [
      { id: "a", ko: "대릉원 후문", locKo: "경주", cat: "herit" },
      { id: "b", ko: "대릉원", locKo: "경주", cat: "herit" },
    ] as never[];
    const sg = (id: string) => (id === "a" ? "47130" : "47111");
    expect(
      matchPlace({ name: "대릉원", signgu: "47130" }, "경주", places, sg)?.id,
    ).toBe("a");
  });
});

describe("시군구 경계 장소(matchPlaceElsewhere · matchByLocationNamed · boundaryMatch)", () => {
  const places = [
    {
      id: "w",
      ko: "1100고지 습지",
      locKo: "제주",
      cat: "heal",
      lat: 33.358,
      lng: 126.465,
    },
    {
      id: "s",
      ko: "1100고지 습지",
      locKo: "제주",
      cat: "stay",
      lat: 33.358,
      lng: 126.465,
    },
    {
      id: "x",
      ko: "1100고지 습지",
      locKo: "서귀포",
      cat: "heal",
      lat: 33.358,
      lng: 126.465,
    },
    {
      id: "m",
      ko: "대림시장",
      locKo: "제주",
      cat: "food",
      lat: 33.5,
      lng: 126.5,
    },
  ] as never[];

  it("matchPlaceElsewhere: 같은 도시 · 숙박 아님 · 이름이 같은(3점) 곳만. 품는 이름은 안 된다", () => {
    expect(
      matchPlaceElsewhere({ name: "1100고지습지" }, "제주", places)?.id,
    ).toBe("w");
    expect(
      matchPlaceElsewhere({ name: "1100고지" }, "제주", places),
    ).toBeNull();
    expect(
      matchPlaceElsewhere({ name: "1100고지습지" }, "부산", places),
    ).toBeNull();
    expect(
      matchPlaceElsewhere({ name: "1100고지습지" }, "제주", places.slice(1)),
    ).toBeNull(); // 숙박 · 다른 도시만 남으면 없음
  });

  it("matchByLocationNamed: 1km 안이라도 이름이 맞아야 한다(이름 없는 250m 규칙을 쓰지 않는다)", () => {
    // 대림시장 바로 옆(약 10m)의 「새마을시장」 관광정보 → 이름이 안 맞아 없음
    expect(
      matchByLocationNamed(
        { name: "새마을시장", lat: 33.5001, lng: 126.5 },
        "제주",
        places,
      ),
    ).toBeNull();
    // 품는 이름(2점) · 1km 안
    expect(
      matchByLocationNamed(
        { name: "1100고지", lat: 33.36, lng: 126.465 },
        "제주",
        places,
      )?.id,
    ).toBe("w");
    // 1km 밖
    expect(
      matchByLocationNamed(
        { name: "1100고지", lat: 33.38, lng: 126.465 },
        "제주",
        places,
      ),
    ).toBeNull();
  });

  it("boundaryMatch: 이름(같은 도시) → 시도 안 이름 같은 관광정보 좌표의 이름 맞는 장소. 관광정보가 없어도 이름은 본다", () => {
    const loose = (title: string, lat: number, regn = "50") => ({
      contentid: "9",
      title,
      contenttypeid: "12",
      mapy: String(lat),
      mapx: "126.465",
      lDongRegnCd: regn,
      lDongSignguCd: "130",
    });
    expect(
      boundaryMatch(
        { name: "1100고지습지", signgu: "50110" },
        "제주",
        [],
        places,
      ),
    ).toEqual({ place: places[0], how: "name" });
    expect(
      boundaryMatch(
        { name: "1100고지", signgu: "50110" },
        "제주",
        [loose("1100고지", 33.359)] as never[],
        places,
      ),
    ).toEqual({ place: places[0], how: "location" });
    // 다른 시도의 관광정보는 쓰지 않는다
    expect(
      boundaryMatch(
        { name: "1100고지", signgu: "50110" },
        "제주",
        [loose("1100고지", 33.359, "47")] as never[],
        places,
      ),
    ).toBeNull();
  });
});

describe("pickSpotItemLoose: 같은 시도 · 이름 같은 관광정보(경계 장소 예비 후보)", () => {
  it("시군구가 달라도 같은 시도에서 이름이 같은 것만, 품는 이름은 안 된다", () => {
    const items = [
      {
        contentid: "1",
        title: "1100고지 습지",
        contenttypeid: "12",
        lDongRegnCd: "50",
        lDongSignguCd: "130",
      },
      {
        contentid: "2",
        title: "1100고지 휴게소",
        contenttypeid: "39",
        lDongRegnCd: "50",
        lDongSignguCd: "130",
      },
      {
        contentid: "3",
        title: "1100고지 습지",
        contenttypeid: "12",
        lDongRegnCd: "47",
        lDongSignguCd: "130",
      },
    ] as never[];
    expect(
      pickSpotItemLoose(items, { name: "1100고지습지", signgu: "50110" })
        ?.contentid,
    ).toBe("1");
    expect(
      pickSpotItemLoose(items, { name: "1100고지", signgu: "50110" }),
    ).toBeNull();
    expect(
      pickSpotItemLoose(items, { name: "1100고지습지", signgu: "" }),
    ).toBeNull();
    expect(
      pickSpotItemLoose(items.slice(2), {
        name: "1100고지습지",
        signgu: "50110",
      }),
    ).toBeNull();
  });
});

describe("표기 차이 맞추기", () => {
  it("끝말(해수욕장 · 해변, 전통시장 · 시장)과 괄호 · 공백을 맞춘다", () => {
    expect(spotName("해운대해수욕장")).toBe("해운대해변");
    expect(spotName("해운대 해변")).toBe("해운대해변");
    expect(spotName("망원시장(망원전통시장)")).toBe("망원시장");
    expect(spotName("남대문 전통시장")).toBe("남대문시장");
  });

  it("nameScore: 같은 곳의 다른 표기는 3, 품으면 2, 끝말만 겹치면 0", () => {
    expect(nameScore("해운대해수욕장", "해운대 해변", "부산")).toBe(3);
    expect(nameScore("경주 대릉원", "대릉원", "경주")).toBe(3);
    expect(nameScore("대릉원", "경주 대릉원", "경주")).toBe(3);
    expect(nameScore("남대문시장", "남대문 전통시장", "서울")).toBe(3);
    expect(nameScore("불국사", "불국사 석가탑", "경주")).toBe(2);
    expect(nameScore("송정해수욕장", "해운대 해변", "부산")).toBe(0);
    expect(nameScore("석굴암", "불국사", "경주")).toBe(0);
  });

  it("nameOverlap: 글자쌍 겹침", () => {
    expect(nameOverlap("동궁과월지", "동궁과 월지")).toBe(1);
    expect(nameOverlap("국립경주박물관", "경주박물관")).toBeGreaterThan(0.5);
    expect(nameOverlap("불국사", "석굴암")).toBe(0);
    expect(nameOverlap("가", "가")).toBe(0);
  });
});

describe("matchByLocation", () => {
  const places = [
    {
      id: "a",
      ko: "쪽샘 44호 신라공주묘",
      locKo: "경주",
      cat: "herit",
      lat: 35.8397,
      lng: 129.2163,
    },
    {
      id: "b",
      ko: "국립경주박물관",
      locKo: "경주",
      cat: "herit",
      lat: 35.8292,
      lng: 129.2279,
    },
    {
      id: "c",
      ko: "숙소",
      locKo: "경주",
      cat: "stay",
      lat: 35.83975,
      lng: 129.21635,
    },
    {
      id: "d",
      ko: "다른 도시",
      locKo: "부산",
      cat: "herit",
      lat: 35.8398,
      lng: 129.2164,
    },
  ] as never[];

  it("250m 안이면 이름이 달라도 가장 가까운 같은 도시 장소(숙박 · 다른 도시 제외)", () => {
    expect(
      matchByLocation(
        { name: "쪽샘지구", lat: 35.8399, lng: 129.2165 },
        "경주",
        places,
      )?.id,
    ).toBe("a");
  });

  it("1km 안은 이름 글자가 절반 이상 겹칠 때만", () => {
    // b에서 약 600m
    const at = { lat: 35.8346, lng: 129.2279 };
    expect(
      matchByLocation({ name: "경주박물관", ...at }, "경주", places)?.id,
    ).toBe("b");
    expect(
      matchByLocation({ name: "월정교", ...at }, "경주", places),
    ).toBeNull();
  });

  it("1km 밖이면 없음", () => {
    expect(
      matchByLocation(
        { name: "쪽샘", lat: 35.9, lng: 129.2163 },
        "경주",
        places,
      ),
    ).toBeNull();
  });
});

describe("pickSpotItem", () => {
  const item = (
    title: string,
    type = "12",
    regn = "47",
    sgg = "130",
    contentid = "1",
  ) => ({
    title,
    contenttypeid: type,
    lDongRegnCd: regn,
    lDongSignguCd: sgg,
    contentid,
  });

  it("같은 시군구 · 이름 점수 높은 곳 · 관광지 타입 먼저. 코스 · 숙박은 뺀다", () => {
    const spot = { name: "대릉원", signgu: "47130" };
    expect(
      pickSpotItem(
        [
          item("경주 대릉원 일원", "12", "47", "130", "2"),
          item("대릉원", "39", "47", "130", "3"),
          item("대릉원", "12", "47", "130", "4"),
        ],
        spot,
      )?.contentid,
    ).toBe("4");
    expect(pickSpotItem([item("대릉원", "12", "11", "110")], spot)).toBeNull();
    expect(
      pickSpotItem([item("대릉원", "25"), item("대릉원", "32")], spot),
    ).toBeNull();
    expect(pickSpotItem([item("천마총")], spot)).toBeNull();
  });
});

describe("findPopular: 이름 · 위치 · 신규 관광지", () => {
  afterEach(() => vi.unstubAllGlobals());

  const tourBody = (item: unknown[]) =>
    Response.json({
      response: {
        header: { resultCode: "0000" },
        body: { items: item.length ? { item } : "", totalCount: item.length },
      },
    });

  it("이름으로 앱 장소, 못 찾으면 한국관광공사 좌표 근처 앱 장소, 그래도 없으면 신규 관광지(kto:)", async () => {
    const day = "20260929";
    const crowd = ["불국사", "쪽샘지구", "무릉숲길", "없는곳"].map(
      (name, i) => ({
        tAtsNm: name,
        baseYmd: day,
        cnctrRate: String(90 - i),
        signguCd: "47130",
        signguNm: "경주시",
      }),
    );
    const search: Record<string, unknown[]> = {
      쪽샘지구: [
        {
          contentid: "111",
          title: "쪽샘지구",
          contenttypeid: "12",
          mapy: "35.8399",
          mapx: "129.2165",
          lDongRegnCd: "47",
          lDongSignguCd: "130",
        },
      ],
      무릉숲길: [
        {
          contentid: "222",
          title: "무릉숲길",
          contenttypeid: "12",
          cat1: "A01",
          mapy: "35.95",
          mapx: "129.05",
          lDongRegnCd: "47",
          lDongSignguCd: "130",
          firstimage: "http://tong.visitkorea.or.kr/a.jpg",
          addr1: "경상북도 경주시",
        },
      ],
    };
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        calls.push(url.pathname);
        if (url.pathname.endsWith("tatsCnctrRatedList")) return tourBody(crowd);
        if (url.pathname.endsWith("searchKeyword2"))
          return tourBody(search[url.searchParams.get("keyword") ?? ""] ?? []);
        return new Response("no", { status: 500 });
      }),
    );
    const popular = await findPopular(
      "경주",
      "KEY",
      "ko",
      undefined,
      new Date("2026-09-29T03:00:00Z"),
    );
    const byName = new Map(popular!.items.map((x) => [x.name, x]));
    expect(byName.get("불국사")?.id).toBe("gjx1");
    // 이름이 맞은 곳은 한국관광공사를 부르지 않는다
    expect(calls.filter((c) => c.endsWith("searchKeyword2"))).toHaveLength(3);
    const jjok = popular!.items.find((x) => x.id === "gj2");
    expect(jjok?.place).toBeUndefined();
    const fresh = byName.get("무릉숲길");
    expect(fresh?.id).toBe("kto:222");
    expect(fresh?.place).toMatchObject({
      id: "kto:222",
      ko: "무릉숲길",
      locKo: "경주",
      pickCity: "경주",
      cat: "heal",
      photo: "https://tong.visitkorea.or.kr/a.jpg",
    });
    // 서버 전용 필드는 보내지 않는다
    expect(fresh?.place).not.toHaveProperty("signgu");
    expect(byName.get("없는곳")?.id).toBeNull();
  });

  it("시군구 경계 장소(1100고지 습지): 같은 시군구 관광정보가 없으면 같은 도시의 같은 이름 · 시도 안 같은 이름 관광정보 근처의 이름 맞는 앱 장소로 잇는다", async () => {
    const day = "20260929";
    const wet = PLANNER_PLACES.find((p) => p.id === "jdx74")!;
    expect(tourPlaceSigngu(wet.id)).toBe("50130");
    const crowd = ["1100고지습지", "1100고지", "다른구시장"].map((name, i) => ({
      tAtsNm: name,
      baseYmd: day,
      cnctrRate: String(90 - i),
      signguCd: "50110",
      signguNm: "제주시",
    }));
    const sgp = (title: string, id: string, lat: number, lng: number) => ({
      contentid: id,
      title,
      contenttypeid: "12",
      mapy: String(lat),
      mapx: String(lng),
      lDongRegnCd: "50",
      lDongSignguCd: "130", // 관광정보도 서귀포시
    });
    const search: Record<string, unknown[]> = {
      "1100고지습지": [sgp("1100고지 습지", "500", wet.lat, wet.lng)],
      // 품는 이름(2점): 같은 도시 이름 대조는 안 되고, 시도 안 이름 같은 관광정보 좌표 근처의 이름 맞는 앱 장소로
      "1100고지": [sgp("1100고지", "501", wet.lat + 0.002, wet.lng)],
      // 다른 구의 같은 이름 · 근처에 앱 장소 없음: 신규 관광지로 만들지 않는다
      다른구시장: [sgp("다른구시장", "502", 33.0, 126.0)],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        if (url.pathname.endsWith("tatsCnctrRatedList")) return tourBody(crowd);
        if (url.pathname.endsWith("searchKeyword2"))
          return tourBody(search[url.searchParams.get("keyword") ?? ""] ?? []);
        return new Response("no", { status: 500 });
      }),
    );
    const popular = await findPopular(
      "제주",
      "KEY",
      "ko",
      undefined,
      new Date("2026-09-29T03:00:00Z"),
    );
    const ids = popular!.items.map((x) => [x.name, x.id, x.district]);
    expect(ids).toEqual([
      ["1100고지 습지", "jdx74", "제주시"],
      ["1100고지 습지", "jdx74", "제주시"],
      ["다른구시장", null, "제주시"],
    ]);
    expect(popular!.items[2].place).toBeUndefined();
  });

  it("같은 시군구 관광정보가 있으면 그것이 먼저다(다른 구의 같은 이름 앱 장소에 잇지 않고 신규 관광지로)", async () => {
    const crowd = [
      {
        tAtsNm: "1100고지습지",
        baseYmd: "20260929",
        cnctrRate: "90",
        signguCd: "50110",
        signguNm: "제주시",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        if (url.pathname.endsWith("tatsCnctrRatedList")) return tourBody(crowd);
        if (url.pathname.endsWith("searchKeyword2"))
          return tourBody([
            {
              contentid: "777",
              title: "1100고지 습지",
              contenttypeid: "12",
              mapy: "33.50",
              mapx: "126.53",
              lDongRegnCd: "50",
              lDongSignguCd: "110",
            },
          ]);
        return tourBody([]);
      }),
    );
    const popular = await findPopular(
      "제주",
      "KEY",
      "ko",
      undefined,
      new Date("2026-09-29T03:00:00Z"),
    );
    expect(popular!.items[0].id).toBe("kto:777");
  });

  it("다른 구 동명 관광정보 옆의 다른 앱 장소에는 잇지 않는다(영등포 새마을시장 ≠ 은평 대림시장)", async () => {
    const market = PLANNER_PLACES.find((p) => p.id === "ro743")!; // 대림시장(은평구)
    expect(tourPlaceSigngu(market.id)).toBe("11380");
    const crowd = [
      {
        tAtsNm: "새마을시장",
        baseYmd: "20260929",
        cnctrRate: "90",
        signguCd: "11560",
        signguNm: "영등포구",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        if (url.pathname.endsWith("tatsCnctrRatedList"))
          return tourBody(
            url.searchParams.get("signguCd") === "11560" ? crowd : [],
          );
        if (url.pathname.endsWith("searchKeyword2"))
          return tourBody([
            {
              contentid: "888",
              title: "새마을시장",
              contenttypeid: "38",
              mapy: String(market.lat + 0.001),
              mapx: String(market.lng),
              lDongRegnCd: "11",
              lDongSignguCd: "380",
            },
          ]);
        return tourBody([]);
      }),
    );
    const popular = await findPopular(
      "서울",
      "KEY",
      "ko",
      undefined,
      new Date("2026-09-29T03:00:00Z"),
    );
    const item = popular!.items.find((x) => x.district === "영등포구")!;
    expect(item.name).toBe("새마을시장");
    expect(item.id).toBeNull();
  });

  it("관광정보 검색이 실패해도 같은 도시의 같은 이름 앱 장소로는 잇는다", async () => {
    const crowd = [
      {
        tAtsNm: "1100고지습지",
        baseYmd: "20260929",
        cnctrRate: "90",
        signguCd: "50110",
        signguNm: "제주시",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        if (url.pathname.endsWith("tatsCnctrRatedList")) return tourBody(crowd);
        return new Response("down", { status: 500 });
      }),
    );
    const popular = await findPopular(
      "제주",
      "KEY",
      "ko",
      undefined,
      new Date("2026-09-29T03:00:00Z"),
    );
    expect(popular!.items[0].id).toBe("jdx74");
  });
});

describe("districtItems: 그 시군구 행만", () => {
  afterEach(() => vi.unstubAllGlobals());
  const row = (name: string, signgu: string) => ({
    tAtsNm: name,
    baseYmd: "20260929",
    cnctrRate: "80",
    signguCd: signgu,
    signguNm: "",
  });
  const body = (item: unknown[]) =>
    Response.json({
      response: {
        header: { resultCode: "0000" },
        body: { items: item.length ? { item } : "", totalCount: item.length },
      },
    });

  it("시군구 조건을 무시하고 전국 결과가 와도 다른 도시 관광지(제주 우도)는 뺀다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        body([
          row("우도", "50110"),
          row("경포해변", "51150"),
          row("해운대", "26350"),
        ]),
      ),
    );
    const items = await districtItems("51150", "KEY");
    expect(items.map((x) => x.tAtsNm)).toEqual(["경포해변"]);
  });

  it("새 코드(강원 51)로 없으면 옛 코드(42)로 부르고, 행의 코드는 앱 코드로 맞춘다", async () => {
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const code = new URL(input).searchParams.get("signguCd") ?? "";
        asked.push(code);
        return body(code === "42150" ? [row("경포해변", "42150")] : []);
      }),
    );
    const items = await districtItems("51150", "KEY");
    expect(asked).toEqual(["51150", "42150"]);
    expect(items).toEqual([
      expect.objectContaining({ tAtsNm: "경포해변", signguCd: "51150" }),
    ]);
  });

  it("옛 · 새 코드가 없는 시도는 한 번만 부른다", async () => {
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        asked.push(new URL(input).searchParams.get("signguCd") ?? "");
        return body([]);
      }),
    );
    expect(await districtItems("50110", "KEY")).toEqual([]);
    expect(asked).toEqual(["50110"]);
  });
});
