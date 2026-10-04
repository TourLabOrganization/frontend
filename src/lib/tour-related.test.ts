import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import emptyRes from "./fixtures/tour/empty.json";
import invalidKey from "./fixtures/tour/invalid-key.json";
import areaGyeongju from "./fixtures/tour/rlte-area-47130-202607.json";
import searchBulguksa from "./fixtures/tour/rlte-search-bulguksa-202607.json";
import searchGyeongbokgung from "./fixtures/tour/rlte-search-gyeongbokgung-202607.json";
import searchHanok from "./fixtures/tour/rlte-search-hanok-52111.json";
import searchNaksan from "./fixtures/tour/rlte-search-naksan.json";
import { hasHangul } from "./hangul";
import { parseTourItems, tourPlace } from "./tour-api";
import {
  clearRelatedCache,
  findRelated,
  hiddenRelatedName,
  linkPlace,
  localizeRelated,
  pickRelated,
  isStayRow,
  RELATED_LIMIT,
  RELATED_STAY_LIMIT,
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
//   rlte-search-naksan              searchKeyword1 202607 서울 종로구 keyword=낙산공원 (50건, 맥도날드 · CGV · 마복림떡볶이가 들어 있다)
//   rlte-search-hanok-52111         searchKeyword1 202607 전주 완산구 keyword=한옥마을 (50건 중 10건, 관광지는 「남부시장한옥마을야시장」)
//   rlte-area-47130-202607에는 투썸플레이스가 있는 「경주양남주상절리」 묶음(10위까지)도 남겼다
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
      // 이름에 공백이 있으면 끝에 공백을 뺀 이름
      "경주교촌마을",
    ]);
    expect(relatedKeywords("불국사")).toEqual(["불국사"]);
  });

  it("그 뒤에 앞의 도시 이름(locKo)을 뗀 이름", () => {
    expect(relatedKeywords("전주한옥마을", "전주")).toEqual([
      "전주한옥마을",
      "전주한",
      "한옥마을",
    ]);
    // 도시 이름으로 시작하지 않으면 그대로
    expect(relatedKeywords("불국사", "경주")).toEqual(["불국사"]);
  });

  it("마지막에 공백을 뺀 이름: 이름에 공백이 있을 때만, 도시 이름을 뗀 이름에도 공백이 있으면 그것도", () => {
    expect(relatedKeywords("정동심곡 바다부채길", "강릉")).toEqual([
      "정동심곡 바다부채길",
      "정동심곡",
      "정동심",
      "정동심곡바다부채길",
    ]);
    expect(relatedKeywords("경주 양남 주상절리", "경주")).toEqual([
      "경주 양남 주상절리",
      "경주",
      "경주양",
      "양남 주상절리",
      "경주양남주상절리",
      "양남주상절리",
    ]);
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

describe("보일 줄 (PoC getRelatedSpots 정리 · 숙소 나누기) — 불국사 실제 응답", () => {
  const rows = pickRelated(items(searchBulguksa), ME);

  it("대분류는 관광지 · 음식 · 숙박 세 가지, 숙소는 「숙박」", () => {
    const count = (lcls: string) =>
      rows.filter((x) => x.rlteCtgryLclsNm === lcls).length;
    expect([count("관광지"), count("음식"), count("숙박")]).toEqual([
      20, 23, 7,
    ]);
    expect(rows.filter(isStayRow)).toHaveLength(7);
  });

  it("순위 목록: 숙박을 뺀 관광지 · 음식만 rlteRank 순 8개, 순위는 그 안에서 1부터 다시 매긴다", () => {
    const { items: out } = relatedRows(rows, ME);
    expect(out).toHaveLength(RELATED_LIMIT);
    // 원래 순위 6(한화리조트/경주) · 8(소노캄/경주) · 10(코오롱호텔)은 숙소라 빠지고 9 · 11위가 올라온다
    expect(out.map((r) => `${r.rank}.${r.name}`)).toEqual([
      "1.국립경주박물관",
      "2.첨성대",
      "3.황리단길",
      "4.문무대왕릉",
      "5.동궁과월지",
      "6.석굴암",
      "7.보문관광단지",
      "8.맷돌순두부",
    ]);
    expect(out[0]).toEqual({
      rank: 1,
      name: "국립경주박물관",
      category: "전시시설",
      region: "경상북도 경주시",
      regionCd: "47130",
    });
  });

  it("숙소: 숙박만 원래 순위 순 3개(7곳 중)", () => {
    const { stays } = relatedRows(rows, ME);
    expect(stays).toHaveLength(RELATED_STAY_LIMIT);
    expect(stays.map((r) => `${r.rank}.${r.name}.${r.category}`)).toEqual([
      "6.한화리조트/경주.콘도미니엄",
      "8.소노캄/경주.콘도미니엄",
      "10.코오롱호텔.호텔",
    ]);
  });

  it("서울 경복궁도 호텔 3곳이 숙소로 빠진다", () => {
    const me = relatedName("경복궁");
    const { items: out, stays } = relatedRows(
      pickRelated(items(searchGyeongbokgung), me),
      me,
    );
    expect(out.map((r) => r.name)).toEqual([
      "북촌한옥마을",
      "남산케이블카",
      "광장시장",
      "토속촌삼계탕",
      "남대문시장",
      "신라면세점/서울점",
      "창덕궁",
      "남산골한옥마을",
    ]);
    expect(stays.map((r) => r.name)).toEqual([
      "소테츠호텔즈더스프라지르/서울명동",
      "L7 명동 바이 롯데호텔",
      "나인트리바이파르나스/서울명동2",
    ]);
  });

  it("전국 체인(맥도날드 · CGV)은 순위를 다시 매기기 전에 빼고 로컬 맛집(마복림떡볶이)은 남긴다 — 낙산공원 실제 응답", () => {
    const me = relatedName("낙산공원");
    const { items: out, stays } = relatedRows(
      pickRelated(items(searchNaksan), me),
      me,
    );
    // 원래 6위 맥도날드/신월남부DT점 · 8위 CGV/동대문이 빠지고 9위 남산케이블카가 6위로
    expect(out.map((r) => `${r.rank}.${r.name}`)).toEqual([
      "1.팔각정북악스카이",
      "2.북악스카이웨이",
      "3.마복림떡볶이",
      "4.자하손만두",
      "5.남산공원",
      "6.남산케이블카",
      "7.백년토종삼계탕/본점",
      "8.자유회관",
    ]);
    expect(stays.map((r) => r.name)).toEqual([
      "메리어트 이그제큐티브 아파트먼트/서울",
      "스탠포드호텔/명동",
      "스테이호텔/강남",
    ]);
  });

  it("순서가 섞여 와도 순위대로, 장소 자신과 같은 이름은 뺀다", () => {
    const shuffled = [...rows].reverse();
    expect(relatedRows(shuffled, ME).items[0].name).toBe("국립경주박물관");
    // 「국립경주박물관」 시트라면 1위 줄이 자기 자신이다 → 첨성대가 1위
    const self = relatedRows(rows, relatedName("국립경주박물관")).items;
    expect(self[0]).toMatchObject({ rank: 1, name: "첨성대" });
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
    expect(bulguksa.items.map((r) => linkPlace(r, "gjx1")?.id ?? null)).toEqual(
      [
        "gjx4",
        "gjx3",
        "gj4",
        "gjx9",
        "gj3", // 「동궁과월지」 ↔ 「동궁과 월지」
        "gjx5",
        "gjx18",
        "ro161",
      ],
    );
    // 숙소 셋은 우리 장소에 없다(한화리조트/경주 · 소노캄/경주 · 코오롱호텔)
    expect(bulguksa.stays.map((r) => linkPlace(r, "gjx1"))).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("서울: 종로구 · 중구 관광지도 서울 장소와 잇는다", () => {
    const linked = Object.fromEntries(
      seoul.items.map((r) => [r.name, linkPlace(r, "x")?.id ?? null]),
    );
    expect(linked["북촌한옥마을"]).toBe("kd2");
    expect(linked["광장시장"]).toBe("kdx17");
    expect(linked["남대문시장"]).toBe("kdx20");
    expect(linked["신라면세점/서울점"]).toBeNull();
  });

  it("다른 도시의 같은 이름이면 잇지 않고, 지역 정보가 없으면 이름만 보고 잇는다 (실제 줄의 지역 값만 바꿨다)", () => {
    const cheom = bulguksa.items.find((r) => r.name === "첨성대")!;
    const inSeoul = {
      ...cheom,
      region: seoul.items[0].region,
      regionCd: "11110",
    };
    expect(linkPlace(inSeoul, "gjx1")).toBeNull();
    expect(linkPlace({ ...cheom, region: "", regionCd: "" }, "gjx1")?.id).toBe(
      "gjx3",
    );
  });

  it("자기 자신은 잇지 않는다", () => {
    const cheom = bulguksa.items.find((r) => r.name === "첨성대")!;
    expect(linkPlace(cheom, "gjx3")).toBeNull();
  });
});

describe("화면 언어로 옮기기 — 불국사 실제 응답", () => {
  const split = relatedRows(pickRelated(items(searchBulguksa), ME), ME);
  const link = (row: (typeof split.items)[number]) => ({
    ...row,
    place: linkPlace(row, "gjx1"),
  });
  const linked = split.items.map(link);
  const stays = split.stays.map(link);

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
    expect((await localizeRelated(stays, "ko"))[0]).toEqual({
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
      [6, "Seokguram Grotto", "Heritage & Tradition", "Gyeongju"],
      [7, "Bomun Resort Complex", "Theme Park & Activity", "Gyeongju"],
      [8, "Maetdol Sundubu", "Local & Food", "Gyeongju"],
    ]);
    // 숙소 셋은 우리 장소와 이어지지 않아 외국어 화면에는 없다
    expect(await localizeRelated(stays, "en")).toEqual([]);
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
        "gjx18",
        "ro161",
      ]);
      expect(hasHangul(JSON.stringify(list))).toBe(false);
    }
  });
});

/**
 * 연관 관광지 실제 응답을 「오퍼레이션 기준월 검색어」(없으면 「오퍼레이션 기준월」)로 돌려준다. 표에 없으면 실제 빈 응답
 */
function stubRelated(table: Record<string, unknown>) {
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input);
      const op = url.pathname.split("/").pop();
      const k = `${op} ${url.searchParams.get("baseYm")}`;
      const full = `${k} ${url.searchParams.get("keyword") ?? ""}`.trim();
      asked.push(full);
      return Response.json(table[full] ?? table[k] ?? emptyRes);
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
    expect(found?.items.map((r) => r.place?.id ?? null)).toEqual([
      "gjx4",
      "gjx3",
      "gj4",
      "gjx9",
      "gj3",
      "gjx5",
      "gjx18",
      "ro161",
    ]);
    expect(found?.stays.map((r) => r.name)).toEqual([
      "한화리조트/경주",
      "소노캄/경주",
      "코오롱호텔",
    ]);
  });

  it("그달 검색어로 없으면 그달 시군구 전체 목록에서 고르고, 전체 목록은 한 번만 부른다", async () => {
    const asked = stubRelated({ "areaBasedList1 202607": areaGyeongju });
    const first = await findRelated(gjx1, "KEY", now);
    expect(first?.month).toBe("202607");
    expect(first?.items[0].name).toBe("국립경주박물관");
    expect(first?.stays.map((r) => r.name)).toEqual([
      "한화리조트/경주",
      "소노캄/경주",
      "코오롱호텔",
    ]);
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

  it("그달 시군구 목록에 있는데 이 장소가 없으면 데이터 없음 — 이전 달로 넘어가지 않는다 (효우당)", async () => {
    const asked = stubRelated({ "areaBasedList1 202607": areaGyeongju });
    expect(await findRelated(tourPlace("gj1")!, "KEY", now)).toBeNull();
    expect(asked).toEqual([
      "searchKeyword1 202607 효우당",
      "areaBasedList1 202607",
    ]);
  });

  it("앞의 도시 이름을 뗀 이름도 찾고, 이름 점수는 그대로라 다른 관광지는 걸리지 않는다 (전주한옥마을)", async () => {
    // 「한옥마을」로 찾으면 50건이 오지만 관광지는 「남부시장한옥마을야시장」 — 전주한옥마을과 점수 0
    const asked = stubRelated({
      "searchKeyword1 202607 한옥마을": searchHanok,
      // 그달 시군구 목록이 비지 않았다(경주 실제 목록으로 대신한다) → 3 · 4개월 전은 보지 않는다
      "areaBasedList1 202607": areaGyeongju,
    });
    expect(await findRelated(tourPlace("nax109")!, "KEY", now)).toBeNull();
    expect(asked).toEqual([
      "searchKeyword1 202607 전주한옥마을",
      "searchKeyword1 202607 전주한",
      "searchKeyword1 202607 한옥마을",
      "areaBasedList1 202607",
    ]);
  });

  it("공백을 뺀 이름은 검색어 후보의 마지막, 그다음 그달 시군구 목록 (정동심곡 바다부채길: 실제 0건)", async () => {
    const asked = stubRelated({
      // 그달 시군구 목록이 비지 않았다(경주 실제 목록으로 대신한다) → 3 · 4개월 전은 보지 않는다
      "areaBasedList1 202607": areaGyeongju,
    });
    expect(await findRelated(tourPlace("nax739")!, "KEY", now)).toBeNull();
    expect(asked).toEqual([
      "searchKeyword1 202607 정동심곡 바다부채길",
      "searchKeyword1 202607 정동심곡",
      "searchKeyword1 202607 정동심",
      "searchKeyword1 202607 정동심곡바다부채길",
      "areaBasedList1 202607",
    ]);
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

  it("결과: 기준월 · 순위 목록 · 숙소(하루 캐시), 외국어 화면은 이어진 곳만", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    stubRelated({ "searchKeyword1 202607": searchBulguksa });
    const res = await call("id=gjx1&locale=ko");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=600, s-maxage=86400",
    );
    const body = (await res.json()) as {
      month: string;
      items: { rank: number; name: string; placeId?: string }[];
      stays: Record<string, unknown>[];
    };
    expect(body.month).toBe("202607");
    expect(body.items).toHaveLength(8);
    expect(body.items[0]).toMatchObject({
      rank: 1,
      name: "국립경주박물관",
      placeId: "gjx4",
    });
    // 숙소는 순위 번호 없이
    expect(body.stays).toEqual([
      {
        name: "한화리조트/경주",
        category: "콘도미니엄",
        region: "경상북도 경주시",
      },
      {
        name: "소노캄/경주",
        category: "콘도미니엄",
        region: "경상북도 경주시",
      },
      { name: "코오롱호텔", category: "호텔", region: "경상북도 경주시" },
    ]);

    const en = (await (await call("id=gjx1&locale=en")).json()) as {
      items: { placeId?: string }[];
      stays: unknown[];
    };
    expect(en.items).toHaveLength(8);
    expect(en.stays).toEqual([]);
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
