import { afterEach, describe, expect, it, vi } from "vitest";
import { loadNameTable } from "../features/names/server";
import { hasHangul } from "./hangul";
import { tourPlace } from "./tour-api";
import {
  findRelated,
  linkPlace,
  localizeRelated,
  pickRelated,
  RELATED_LIMIT,
  relatedKeywords,
  relatedMonths,
  relatedName,
  relatedRows,
  relatedScore,
  tourRelatedResponse,
} from "./tour-related";

/** 연관 관광지 item (PoC getRelatedSpots가 읽는 필드) */
const rel = (
  tAtsNm: string,
  rlteTatsNm: string,
  rank: number,
  over: Record<string, unknown> = {},
) => ({
  baseYm: "202607",
  tAtsNm,
  areaCd: "47",
  signguCd: "47130",
  rlteTatsNm,
  rlteRegnCd: "47",
  rlteRegnNm: "경상북도",
  rlteSignguCd: "47130",
  rlteSignguNm: "경주시",
  rlteCtgryLclsNm: "관광지",
  rlteCtgryMclsNm: "역사관광",
  rlteCtgrySclsNm: "유적지/사적지",
  rlteRank: String(rank),
  ...over,
});

describe("이름 점수 (PoC score · pick)", () => {
  const me = relatedName("불국사");

  it("같은 이름 3 · 앞부분 2 · 포함 1 · 아니면 0", () => {
    expect(relatedScore("불국사", me)).toBe(3);
    expect(relatedScore("불국사 (경주)", me)).toBe(3);
    expect(relatedScore("불국사 주차장", me)).toBe(2);
    expect(relatedScore("경주 불국사", me)).toBe(1);
    expect(relatedScore("석굴암", me)).toBe(0);
    expect(relatedScore("", me)).toBe(0);
  });

  it("앞부분 · 포함은 둘 다 3글자 이상일 때만", () => {
    const short = relatedName("월지");
    expect(relatedScore("월지", short)).toBe(3);
    expect(relatedScore("월지공원", short)).toBe(0);
    expect(relatedScore("동궁과 월지", short)).toBe(0);
  });

  it("관광지 이름으로 묶어 점수가 가장 높은 묶음, 같은 점수면 행이 많은 묶음", () => {
    const rows = [
      rel("경주 불국사", "석굴암", 1),
      rel("불국사 주차장", "보문관광단지", 1),
      rel("불국사 주차장", "보문호반길", 2),
      rel("불국사 숙박단지", "첨성대", 1),
    ];
    // 「불국사 주차장」 · 「불국사 숙박단지」는 둘 다 2점, 행이 많은 「불국사 주차장」
    expect(pickRelated(rows, me).map((x) => x.rlteTatsNm)).toEqual([
      "보문관광단지",
      "보문호반길",
    ]);
    expect(pickRelated([...rows, rel("불국사", "대릉원", 1)], me)).toEqual([
      rel("불국사", "대릉원", 1),
    ]);
    expect(pickRelated([rel("석굴암", "첨성대", 1)], me)).toEqual([]);
  });
});

describe("검색어 후보 · 기준월", () => {
  it("전체 이름 → 첫 단어 → 정규화한 앞 3글자, 2글자 이상, 겹치면 한 번", () => {
    expect(relatedKeywords("경주 교촌마을")).toEqual([
      "경주 교촌마을",
      "경주",
      "경주교",
    ]);
    expect(relatedKeywords("불국사")).toEqual(["불국사"]);
    expect(relatedKeywords("a 산")).toEqual(["a 산", "a산"]);
  });

  it("한국 날짜 기준 2 · 3 · 4개월 전", () => {
    expect(relatedMonths(new Date("2026-09-29T03:00:00Z"))).toEqual([
      "202607",
      "202606",
      "202605",
    ]);
  });

  it("해가 바뀌면 전해로 넘어간다", () => {
    expect(relatedMonths(new Date("2026-01-15T03:00:00Z"))).toEqual([
      "202511",
      "202510",
      "202509",
    ]);
    // 2026-02-01 00:30 한국 = 2026-01-31 15:30 UTC — 서버 시간대(UTC)가 아니라 한국 날짜로 센다
    expect(relatedMonths(new Date("2026-01-31T15:30:00Z"))).toEqual([
      "202512",
      "202511",
      "202510",
    ]);
  });
});

describe("보일 줄 (PoC getRelatedSpots 정리)", () => {
  const me = relatedName("불국사");

  it("rlteRank 순, 자기 자신 · 겹치는 이름을 빼고 8개", () => {
    const rows = [
      rel("불국사", "대릉원", 3),
      rel("불국사", "석굴암", 1),
      rel("불국사", "불국사", 2),
      rel("불국사", "석굴암", 4),
      ...Array.from({ length: 10 }, (_, i) =>
        rel("불국사", `관광지${i}`, 10 + i),
      ),
    ];
    const out = relatedRows(rows, me);
    expect(out).toHaveLength(RELATED_LIMIT);
    expect(out.slice(0, 3).map((r) => [r.rank, r.name])).toEqual([
      [1, "석굴암"],
      [3, "대릉원"],
      [10, "관광지0"],
    ]);
    expect(out[0]).toEqual({
      rank: 1,
      name: "석굴암",
      category: "유적지/사적지",
      region: "경상북도 경주시",
      regionCd: "47130",
    });
  });

  it("PoC 화면처럼 영화관 · 주차장 · 화장실은 뺀다(8개를 자른 뒤)", () => {
    const rows = [
      rel("불국사", "CGV 경주", 1),
      rel("불국사", "불국사 공영주차장", 2),
      rel("불국사", "석굴암", 3),
    ];
    expect(relatedRows(rows, me).map((r) => r.name)).toEqual(["석굴암"]);
  });

  it("분류는 소 → 중 → 대분류 중 있는 것", () => {
    const [row] = relatedRows(
      [rel("불국사", "석굴암", 1, { rlteCtgrySclsNm: "" })],
      me,
    );
    expect(row.category).toBe("역사관광");
  });
});

describe("우리 장소 잇기", () => {
  const row = (name: string, region: string, regionCd = "") => ({
    name,
    region,
    regionCd,
  });

  it("같은 이름(정규화) · 같은 도시인 플래너 장소", () => {
    expect(linkPlace(row("첨성대", "경상북도 경주시"), "gjx1")?.id).toBe(
      "gjx3",
    );
    expect(linkPlace(row("동궁과월지", "경상북도 경주시"), "gjx1")?.id).toBe(
      "gj3",
    );
    expect(linkPlace(row("[경주] 첨성대", "경상북도 경주시"), "x")?.id).toBe(
      "gjx3",
    );
  });

  it("시군구 코드가 같아도 같은 도시다", () => {
    const code = tourPlace("gjx3")?.signgu ?? "";
    expect(code).toMatch(/^\d{5}$/);
    expect(linkPlace(row("첨성대", "", code), "gjx1")?.id).toBe("gjx3");
  });

  it("다른 도시의 같은 이름이면 잇지 않고, 지역 정보가 없으면 이름만 보고 잇는다", () => {
    expect(linkPlace(row("첨성대", "서울특별시 종로구", "11110"), "gjx1")).toBe(
      null,
    );
    expect(linkPlace(row("첨성대", ""), "gjx1")?.id).toBe("gjx3");
  });

  it("자기 자신 · 모르는 이름은 잇지 않는다", () => {
    expect(linkPlace(row("첨성대", "경상북도 경주시"), "gjx3")).toBeNull();
    expect(linkPlace(row("없는 관광지", "경상북도 경주시"), "gjx1")).toBeNull();
  });
});

describe("화면 언어로 옮기기", () => {
  const gjx3 = tourPlace("gjx3")!;
  const gj3 = tourPlace("gj3")!;
  const rows = [
    {
      rank: 1,
      name: "첨성대",
      category: "유적지/사적지",
      region: "경상북도 경주시",
      regionCd: "47130",
      place: gjx3,
    },
    {
      rank: 2,
      name: "보문호반길",
      category: "테마공원",
      region: "경상북도 경주시",
      regionCd: "47130",
      place: null,
    },
    {
      rank: 3,
      name: "동궁과 월지",
      category: "유적지/사적지",
      region: "경상북도 경주시",
      regionCd: "47130",
      place: gj3,
    },
    {
      rank: 4,
      name: "첨성대 (야경)",
      category: "야경",
      region: "경상북도 경주시",
      regionCd: "47130",
      place: gjx3,
    },
  ];

  it("한국어 화면은 한국관광공사 값 그대로, 이어진 곳은 placeId", async () => {
    const out = await localizeRelated(rows, "ko");
    expect(out.map((x) => [x.rank, x.name, x.placeId])).toEqual([
      [1, "첨성대", "gjx3"],
      [2, "보문호반길", undefined],
      [3, "동궁과 월지", "gj3"],
      [4, "첨성대 (야경)", "gjx3"],
    ]);
    expect(out[0].category).toBe("유적지/사적지");
    expect(out[0].region).toBe("경상북도 경주시");
  });

  it("외국어 화면은 이어진 우리 장소만, 그 언어 이름 · 우리 분류 이름 · 우리 도시 이름으로(한글 0)", async () => {
    const out = await localizeRelated(rows, "en");
    expect(out).toEqual([
      {
        rank: 1,
        name: gjx3.en,
        category: "Heritage & Tradition",
        region: "Gyeongju",
        placeId: "gjx3",
      },
      {
        rank: 3,
        name: gj3.en,
        category: "Heritage & Tradition",
        region: "Gyeongju",
        placeId: "gj3",
      },
    ]);
    for (const locale of ["zh", "ja", "es"] as const) {
      const list = await localizeRelated(rows, locale);
      expect(list.map((x) => x.placeId)).toEqual(["gjx3", "gj3"]);
      expect(hasHangul(JSON.stringify(list))).toBe(false);
    }
    const zh = await localizeRelated(rows, "zh");
    const names = await loadNameTable("zh");
    expect(zh[0].name).toBe(names.places.gjx3 || gjx3.en);
    const es = await localizeRelated(rows, "es");
    expect(es[0].category).toBe("Patrimonio y tradición");
  });
});

/** 공공데이터포털 JSON 응답 */
const ok = (items: unknown[]) =>
  new Response(
    JSON.stringify({
      response: {
        header: { resultCode: "0000", resultMsg: "OK" },
        body: {
          items:
            items.length === 1
              ? { item: items[0] }
              : items.length
                ? { item: items }
                : "",
          numOfRows: 100,
          pageNo: 1,
          totalCount: items.length,
        },
      },
    }),
  );

describe("연관 관광지 찾기 (검색어 · 기준월 · 전체 목록 순서)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const now = new Date("2026-09-29T03:00:00Z");

  it("그달 검색어 후보가 모두 없으면 그달 전체 목록(areaBasedList1)에서 고른다", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        const op = url.pathname.split("/").pop()!;
        calls.push(
          `${op} ${url.searchParams.get("baseYm")} ${url.searchParams.get("keyword") ?? ""}`.trim(),
        );
        if (op === "areaBasedList1")
          return ok([rel("불국사", "석굴암", 1), rel("석굴암", "불국사", 1)]);
        return ok([]);
      }),
    );
    const found = await findRelated(tourPlace("gjx1")!, "KEY", now);
    expect(calls).toEqual([
      "searchKeyword1 202607 불국사",
      "areaBasedList1 202607",
    ]);
    expect(found?.month).toBe("202607");
    expect(found?.rows.map((r) => [r.name, r.place?.id])).toEqual([
      ["석굴암", "gjx5"],
    ]);
  });

  it("그달에 없으면 다음 기준월(3개월 전)로, 끝까지 없으면 null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        if (url.searchParams.get("baseYm") === "202606")
          return ok([rel("불국사", "대릉원", 2)]);
        return ok([]);
      }),
    );
    const found = await findRelated(tourPlace("gjx1")!, "KEY", now);
    expect(found?.month).toBe("202606");
    expect(found?.rows[0]).toMatchObject({ name: "대릉원", rank: 2 });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok([])),
    );
    expect(await findRelated(tourPlace("gjx1")!, "KEY", now)).toBeNull();
  });

  it("주소: 시군구 코드 앞 2자리가 areaCd, 전체 목록은 2,000행", async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        urls.push(new URL(input));
        return ok([]);
      }),
    );
    await findRelated(tourPlace("gjx1")!, "KEY", now);
    const signgu = tourPlace("gjx1")!.signgu;
    expect(urls[0].origin + urls[0].pathname).toBe(
      "https://apis.data.go.kr/B551011/TarRlteTarService1/searchKeyword1",
    );
    expect(urls[0].searchParams.get("signguCd")).toBe(signgu);
    expect(urls[0].searchParams.get("areaCd")).toBe(signgu.slice(0, 2));
    expect(urls[0].searchParams.get("numOfRows")).toBe("100");
    const bulk = urls.find((u) => u.pathname.endsWith("/areaBasedList1"))!;
    expect(bulk.searchParams.get("numOfRows")).toBe("2000");
  });
});

describe("GET /api/tour/related", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const call = (qs: string) =>
    tourRelatedResponse(new Request(`http://localhost/api/tour/related?${qs}`));

  it("키가 없으면 503", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "");
    const res = await call("id=gjx1&locale=ko");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ message: "not configured" });
  });

  it("id · 언어가 없거나 틀리면 400, 모르는 장소는 404", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    expect((await call("locale=ko")).status).toBe(400);
    expect((await call("id=gjx1")).status).toBe(400);
    expect((await call("id=nope&locale=ko")).status).toBe(404);
  });

  it("외부 실패 · resultCode 오류는 502, 응답에 키가 없다", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const res = await call("id=gjx1&locale=ko");
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("SECRET-KEY");

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              response: {
                header: {
                  resultCode: "30",
                  resultMsg: "SERVICE_KEY_IS_NOT_REGISTERED_ERROR",
                },
              },
            }),
          ),
      ),
    );
    expect((await call("id=gjx1&locale=ko")).status).toBe(502);
  });

  it("결과: 기준월과 항목, 외국어 화면은 이어진 곳만(없으면 결과 없음)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ok([rel("불국사", "석굴암", 1), rel("불국사", "보문호반길", 2)]),
      ),
    );
    const res = await call("id=gjx1&locale=ko");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    const body = (await res.json()) as {
      month: string;
      items: { name: string; placeId?: string }[];
    };
    expect(body.month).toMatch(/^\d{6}$/);
    expect(body.items.map((x) => [x.name, x.placeId])).toEqual([
      ["석굴암", "gjx5"],
      ["보문호반길", undefined],
    ]);

    const en = (await (await call("id=gjx1&locale=en")).json()) as {
      items: { placeId?: string }[];
    };
    expect(en.items.map((x) => x.placeId)).toEqual(["gjx5"]);
    expect(hasHangul(JSON.stringify(en))).toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok([rel("불국사", "보문호반길", 1)])),
    );
    expect(await (await call("id=gjx1&locale=ja")).json()).toEqual({
      empty: true,
    });
  });
});
