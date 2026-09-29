import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import emptyRes from "./fixtures/tour/empty.json";
import invalidKey from "./fixtures/tour/invalid-key.json";
import areaGyeongju from "./fixtures/tour/rlte-area-47130-202607.json";
import searchBulguksa from "./fixtures/tour/rlte-search-bulguksa-202607.json";
import searchGyeongbokgung from "./fixtures/tour/rlte-search-gyeongbokgung-202607.json";
import { hasHangul } from "./hangul";
import { parseTourItems, tourPlace } from "./tour-api";
import {
  clearRelatedCache,
  findRelated,
  hiddenRelatedName,
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

// 관광지별 연관 관광지(TarRlteTarService1) 실제 응답(2026-09-29 받음, fixtures/tour, 키는 지웠다):
//   rlte-search-bulguksa-202607     searchKeyword1 baseYm=202607 areaCd=47 signguCd=47130 keyword=불국사 (50건, 관광지 「불국사」 하나)
//   rlte-search-gyeongbokgung-202607 searchKeyword1 baseYm=202607 areaCd=11 signguCd=11110 keyword=경복궁 (50건)
//   rlte-area-47130-202607          areaBasedList1 경주 202607 (2,000행 · 약 0.9MB 중 관광지 5곳의 순위 10위까지만 남겼다)
//   empty                           결과 없음(연관 관광지 「효우당」 등)
const items = (body: unknown) => parseTourItems(body) ?? [];
const ME = relatedName("불국사");

describe("이름 점수 · 검색어 · 기준월 (PoC score · kws · 기준월)", () => {
  it("같은 이름 3 · 앞부분 2 · 포함 1 · 아니면 0", () => {
    expect(relatedScore("불국사", ME)).toBe(3);
    expect(relatedScore("불국사 (경주)", ME)).toBe(3);
    expect(relatedScore("불국사 주차장", ME)).toBe(2);
    expect(relatedScore("경주 불국사", ME)).toBe(1);
    expect(relatedScore("석굴암", ME)).toBe(0);
    expect(relatedScore("", ME)).toBe(0);
  });

  it("앞부분 · 포함은 둘 다 3글자 이상일 때만", () => {
    const short = relatedName("월지");
    expect(relatedScore("월지", short)).toBe(3);
    expect(relatedScore("동궁과월지", short)).toBe(0);
  });

  it("검색어 후보: 전체 이름 → 첫 단어 → 정규화한 앞 3글자, 2글자 이상, 겹치면 한 번", () => {
    expect(relatedKeywords("경주 교촌마을")).toEqual([
      "경주 교촌마을",
      "경주",
      "경주교",
    ]);
    expect(relatedKeywords("불국사")).toEqual(["불국사"]);
  });

  it("기준월: 한국 날짜 기준 2 · 3 · 4개월 전", () => {
    expect(relatedMonths(new Date("2026-09-29T03:00:00Z"))).toEqual([
      "202607",
      "202606",
      "202605",
    ]);
  });

  it("기준월: 해가 바뀌면 전해로 (서버 시간대가 아니라 한국 날짜로 센다)", () => {
    expect(relatedMonths(new Date("2026-01-15T03:00:00Z"))).toEqual([
      "202511",
      "202510",
      "202509",
    ]);
    // 2026-02-01 00:30 한국 = 2026-01-31 15:30 UTC
    expect(relatedMonths(new Date("2026-01-31T15:30:00Z"))).toEqual([
      "202512",
      "202511",
      "202510",
    ]);
  });

  it("PoC 화면(d_rlte)에서 빼는 이름: 영화관 · 주차장 · 화장실", () => {
    expect(hiddenRelatedName("CGV 경주")).toBe(true);
    expect(hiddenRelatedName("불국사 공영주차장")).toBe(true);
    expect(hiddenRelatedName("보문호 화장실")).toBe(true);
    expect(hiddenRelatedName("국립경주박물관")).toBe(false);
  });
});

describe("한 곳 고르기 (PoC pick) — 경주 시군구 전체 목록", () => {
  const area = items(areaGyeongju);

  it("관광지 이름으로 묶어 점수가 가장 높은 묶음", () => {
    for (const name of ["불국사", "석굴암", "첨성대"]) {
      const rows = pickRelated(area, relatedName(name));
      expect(rows).toHaveLength(10);
      expect(new Set(rows.map((x) => x.tAtsNm))).toEqual(new Set([name]));
    }
    expect(pickRelated(area, relatedName("효우당"))).toEqual([]);
    expect(pickRelated(items(emptyRes), ME)).toEqual([]);
  });

  it("같은 점수면 행이 많은 묶음, 행 수도 같으면 먼저 나온 묶음", () => {
    // 「솔밭해변」은 관성솔밭해변 · 전촌솔밭해변 둘 다 1점(포함)
    const me = relatedName("솔밭해변");
    expect(pickRelated(area, me)[0].tAtsNm).toBe("관성솔밭해변");
    // 관성솔밭해변 행을 반만 남기면(실제 행에서 덜어 냈다) 전촌솔밭해변
    const fewer = area.filter(
      (x) => x.tAtsNm !== "관성솔밭해변" || Number(x.rlteRank) <= 5,
    );
    expect(pickRelated(fewer, me)[0].tAtsNm).toBe("전촌솔밭해변");
  });
});

describe("보일 줄 (PoC getRelatedSpots 정리) — 불국사 실제 응답", () => {
  const rows = pickRelated(items(searchBulguksa), ME);

  it("rlteRank 순 8개, 분류는 소분류, 지역은 시도 · 시군구", () => {
    const out = relatedRows(rows, ME);
    expect(out).toHaveLength(RELATED_LIMIT);
    expect(out.map((r) => `${r.rank}.${r.name}`)).toEqual([
      "1.국립경주박물관",
      "2.첨성대",
      "3.황리단길",
      "4.문무대왕릉",
      "5.동궁과월지",
      "6.한화리조트/경주",
      "7.석굴암",
      "8.소노캄/경주",
    ]);
    expect(out[0]).toEqual({
      rank: 1,
      name: "국립경주박물관",
      category: "전시시설",
      region: "경상북도 경주시",
      regionCd: "47130",
    });
  });

  it("순서가 섞여 와도 순위대로, 장소 자신과 같은 이름은 뺀다", () => {
    const shuffled = [...rows].reverse();
    expect(relatedRows(shuffled, ME)[0].name).toBe("국립경주박물관");
    // 「국립경주박물관」 시트라면 1위 줄이 자기 자신이다
    const self = relatedRows(rows, relatedName("국립경주박물관"));
    expect(self[0].name).toBe("첨성대");
    expect(self.some((r) => r.name === "국립경주박물관")).toBe(false);
  });
});

describe("우리 장소 잇기 (같은 이름 · 같은 도시)", () => {
  const bulguksa = relatedRows(pickRelated(items(searchBulguksa), ME), ME);
  const seoulMe = relatedName("경복궁");
  const seoul = relatedRows(
    pickRelated(items(searchGyeongbokgung), seoulMe),
    seoulMe,
  );

  it("경주: 이름(정규화) · 시군구 코드가 같은 플래너 장소", () => {
    expect(bulguksa.map((r) => linkPlace(r, "gjx1")?.id ?? null)).toEqual([
      "gjx4",
      "gjx3",
      "gj4",
      "gjx9",
      "gj3", // 「동궁과월지」 ↔ 「동궁과 월지」
      null, // 한화리조트/경주
      "gjx5",
      null, // 소노캄/경주
    ]);
  });

  it("서울: 종로구 · 중구 관광지도 서울 장소와 잇는다", () => {
    const linked = Object.fromEntries(
      seoul.map((r) => [r.name, linkPlace(r, "x")?.id ?? null]),
    );
    expect(linked["북촌한옥마을"]).toBe("kd2");
    expect(linked["광장시장"]).toBe("kdx17");
    expect(linked["남대문시장"]).toBe("kdx20");
    expect(linked["신라면세점/서울점"]).toBeNull();
  });

  it("다른 도시의 같은 이름이면 잇지 않고, 지역 정보가 없으면 이름만 보고 잇는다 (실제 줄의 지역 값만 바꿨다)", () => {
    const cheom = bulguksa.find((r) => r.name === "첨성대")!;
    const inSeoul = { ...cheom, region: seoul[0].region, regionCd: "11110" };
    expect(linkPlace(inSeoul, "gjx1")).toBeNull();
    expect(linkPlace({ ...cheom, region: "", regionCd: "" }, "gjx1")?.id).toBe(
      "gjx3",
    );
  });

  it("자기 자신은 잇지 않는다", () => {
    const cheom = bulguksa.find((r) => r.name === "첨성대")!;
    expect(linkPlace(cheom, "gjx3")).toBeNull();
  });
});

describe("화면 언어로 옮기기 — 불국사 실제 응답", () => {
  const linked = relatedRows(pickRelated(items(searchBulguksa), ME), ME).map(
    (row) => ({ ...row, place: linkPlace(row, "gjx1") }),
  );

  it("한국어 화면은 한국관광공사 값 그대로, 이어진 곳은 placeId", async () => {
    const out = await localizeRelated(linked, "ko");
    expect(out).toHaveLength(8);
    expect(out[0]).toEqual({
      rank: 1,
      name: "국립경주박물관",
      category: "전시시설",
      region: "경상북도 경주시",
      placeId: "gjx4",
    });
    expect(out[5]).toEqual({
      rank: 6,
      name: "한화리조트/경주",
      category: "콘도미니엄",
      region: "경상북도 경주시",
    });
  });

  it("외국어 화면은 이어진 우리 장소만, 그 언어 이름 · 우리 분류 이름 · 우리 도시 이름으로(한글 0)", async () => {
    const en = await localizeRelated(linked, "en");
    expect(en.map((x) => [x.rank, x.name, x.category, x.region])).toEqual([
      [1, "Gyeongju National Museum", "Heritage & Tradition", "Gyeongju"],
      [2, "Cheomseongdae", "Heritage & Tradition", "Gyeongju"],
      [3, "Hwangnidan-gil", "Local & Food", "Gyeongju"],
      [4, "Tomb of King Munmu", "Heritage & Tradition", "Gyeongju"],
      [5, "Donggung & Wolji", "Heritage & Tradition", "Gyeongju"],
      [7, "Seokguram Grotto", "Heritage & Tradition", "Gyeongju"],
    ]);
    const zh = await localizeRelated(linked, "zh");
    expect(zh[0]).toMatchObject({ name: "国立庆州博物馆", region: "庆州" });
    const ja = await localizeRelated(linked, "ja");
    expect(ja[1]).toMatchObject({
      name: "慶州 瞻星台",
      category: "文化遺産·伝統体験",
    });
    const es = await localizeRelated(linked, "es");
    expect(es[2].category).toBe("Local y comida");
    for (const list of [en, zh, ja, es]) {
      expect(list.map((x) => x.placeId)).toEqual([
        "gjx4",
        "gjx3",
        "gj4",
        "gjx9",
        "gj3",
        "gjx5",
      ]);
      expect(hasHangul(JSON.stringify(list))).toBe(false);
    }
  });
});

/** 연관 관광지 실제 응답을 오퍼레이션 · 기준월로 돌려준다. 표에 없으면 실제 빈 응답 */
function stubRelated(table: Record<string, unknown>) {
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input);
      const op = url.pathname.split("/").pop();
      const k = `${op} ${url.searchParams.get("baseYm")}`;
      asked.push(`${k} ${url.searchParams.get("keyword") ?? ""}`.trim());
      return Response.json(table[k] ?? emptyRes);
    }),
  );
  return asked;
}

describe("연관 관광지 찾기 (검색어 · 기준월 · 전체 목록 순서)", () => {
  beforeEach(() => clearRelatedCache());
  afterEach(() => vi.unstubAllGlobals());
  const now = new Date("2026-09-29T03:00:00Z");
  const gjx1 = tourPlace("gjx1")!;

  it("검색어로 찾으면 그 기준월 · 이은 줄", async () => {
    const asked = stubRelated({ "searchKeyword1 202607": searchBulguksa });
    const found = await findRelated(gjx1, "KEY", now);
    expect(asked).toEqual(["searchKeyword1 202607 불국사"]);
    expect(found?.month).toBe("202607");
    expect(found?.rows.map((r) => r.place?.id ?? null)).toEqual([
      "gjx4",
      "gjx3",
      "gj4",
      "gjx9",
      "gj3",
      null,
      "gjx5",
      null,
    ]);
  });

  it("그달 검색어로 없으면 그달 시군구 전체 목록에서 고르고, 전체 목록은 한 번만 부른다", async () => {
    const asked = stubRelated({ "areaBasedList1 202607": areaGyeongju });
    const first = await findRelated(gjx1, "KEY", now);
    expect(first?.month).toBe("202607");
    expect(first?.rows[0].name).toBe("국립경주박물관");
    await findRelated(gjx1, "KEY", now);
    expect(asked).toEqual([
      "searchKeyword1 202607 불국사",
      "areaBasedList1 202607",
      "searchKeyword1 202607 불국사",
    ]);
  });

  it("그달에 없으면 다음 기준월(3개월 전)로, 끝까지 없으면 null (6월 주소에 7월 실제 응답을 돌려 본다)", async () => {
    stubRelated({ "searchKeyword1 202606": searchBulguksa });
    expect((await findRelated(gjx1, "KEY", now))?.month).toBe("202606");

    clearRelatedCache();
    const asked = stubRelated({});
    expect(await findRelated(gjx1, "KEY", now)).toBeNull();
    expect(asked).toHaveLength(6);
  });

  it("주소: 시군구 코드 앞 2자리가 areaCd, 검색은 100행 · 전체 목록은 2,000행", async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        urls.push(new URL(input));
        return Response.json(emptyRes);
      }),
    );
    await findRelated(gjx1, "KEY", now);
    expect(urls[0].origin + urls[0].pathname).toBe(
      "https://apis.data.go.kr/B551011/TarRlteTarService1/searchKeyword1",
    );
    expect(urls[0].searchParams.get("signguCd")).toBe("47130");
    expect(urls[0].searchParams.get("areaCd")).toBe("47");
    expect(urls[0].searchParams.get("numOfRows")).toBe("100");
    const bulk = urls.find((u) => u.pathname.endsWith("/areaBasedList1"))!;
    expect(bulk.searchParams.get("numOfRows")).toBe("2000");
  });
});

describe("GET /api/tour/related", () => {
  beforeEach(() => {
    clearRelatedCache();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T03:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
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

  it("외부 실패는 502(등록되지 않은 키의 실제 응답 · 네트워크 오류), 응답에 키가 없다", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(invalidKey, { status: 403 })),
    );
    const res = await call("id=gjx1&locale=ko");
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("SECRET-KEY");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    expect((await call("id=gjx1&locale=ko")).status).toBe(502);
  });

  it("결과: 기준월과 항목(하루 캐시), 외국어 화면은 이어진 곳만", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    stubRelated({ "searchKeyword1 202607": searchBulguksa });
    const res = await call("id=gjx1&locale=ko");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    const body = (await res.json()) as {
      month: string;
      items: { name: string; placeId?: string }[];
    };
    expect(body.month).toBe("202607");
    expect(body.items).toHaveLength(8);
    expect(body.items[0]).toMatchObject({
      name: "국립경주박물관",
      placeId: "gjx4",
    });

    const en = (await (await call("id=gjx1&locale=en")).json()) as {
      items: { placeId?: string }[];
    };
    expect(en.items).toHaveLength(6);
    expect(hasHangul(JSON.stringify(en))).toBe(false);
  });

  it("찾지 못하면 결과 없음 (효우당: 검색은 실제로 0건, 경주 전체 목록에도 없다)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    stubRelated({ "areaBasedList1 202607": areaGyeongju });
    expect(await (await call("id=gj1&locale=ko")).json()).toEqual({
      empty: true,
    });
  });
});
