import { afterEach, describe, expect, it, vi } from "vitest";
import { PLANNER_PLACES } from "../features/planner/data";
import { tourPlaceSigngu } from "./tour-api";
import { citySigngu } from "./tour-popular";
import {
  addedId,
  allTargets,
  collectPopular,
  homeTargets,
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
    // 풀은 그 도시 장소 + 그 시군구 코드의 장소(양산에 적힌 기장군 장소도 부산 풀에)
    expect(
      busan.pool.some(
        (p) => p.locKo === "양산" && tourPlaceSigngu(p.id) === "26710",
      ),
    ).toBe(true);
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
