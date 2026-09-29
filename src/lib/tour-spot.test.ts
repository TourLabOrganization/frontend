import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extraInScope,
  parseExtraPlaces,
} from "../features/planner/extra-places";
import { isKtoId, ktoId } from "../features/planner/kto-place";
import {
  FOREIGN_SAME_M,
  ktoCategory,
  ktoCity,
  parseTourQuery,
  pickForeignName,
  resolveTourPlace,
  toKtoPlace,
  withForeignNames,
} from "./tour-api";
import { tourPhotoResponse } from "./tour-photo";
import { ktoDetail, tourSpotResponse } from "./tour-spot";

const common = {
  contentid: "126508",
  title: "무릉숲길",
  contenttypeid: "12",
  cat1: "A01",
  mapy: "35.95",
  mapx: "129.05",
  lDongRegnCd: "47",
  lDongSignguCd: "130",
  firstimage: "http://tong.visitkorea.or.kr/cms/a.jpg",
  addr1: "경상북도 경주시 어딘가",
  overview: "숲길<br>산책로",
};

const tourBody = (item: unknown[]) =>
  Response.json({
    response: {
      header: { resultCode: "0000" },
      body: { items: item.length ? { item } : "", totalCount: item.length },
    },
  });

function stubDetail(items: unknown[] = [common]) {
  const fn = vi.fn(async (input: string) => {
    const url = new URL(input);
    if (url.pathname.endsWith("detailCommon2")) return tourBody(items);
    return new Response("no", { status: 500 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("신규 관광지 id", () => {
  it("kto:<숫자>만", () => {
    expect(isKtoId("kto:126508")).toBe(true);
    expect(isKtoId("kto:abc")).toBe(false);
    expect(isKtoId("gj1")).toBe(false);
    expect(ktoId(126508)).toBe("kto:126508");
    expect(ktoId("")).toBeNull();
    expect(ktoId("1/2")).toBeNull();
  });
});

describe("ktoCategory", () => {
  it("콘텐츠 타입 · 대분류 · 새 분류 → 앱 분류", () => {
    expect(ktoCategory({ contenttypeid: "14" })).toBe("herit");
    expect(ktoCategory({ contenttypeid: "12", cat1: "A02" })).toBe("herit");
    expect(ktoCategory({ contenttypeid: "12", lclsSystm1: "HS" })).toBe(
      "herit",
    );
    expect(ktoCategory({ contenttypeid: "28" })).toBe("activity");
    expect(ktoCategory({ contenttypeid: "38" })).toBe("activity");
    expect(ktoCategory({ contenttypeid: "39" })).toBe("food");
    expect(ktoCategory({ contenttypeid: "32" })).toBe("stay");
    expect(ktoCategory({ contenttypeid: "12", title: "송정해수욕장" })).toBe(
      "sea",
    );
    expect(ktoCategory({ contenttypeid: "12", title: "무릉숲길" })).toBe(
      "heal",
    );
  });
});

describe("ktoCity", () => {
  it("같은 시군구 앱 장소의 도시, 없으면 가장 가까운 앱 장소의 도시", () => {
    expect(ktoCity("47130", 35.95, 129.05)?.locKo).toBe("경주");
    // 시군구 코드가 없으면 좌표(불국사 근처)
    expect(ktoCity("", 35.79, 129.332)?.locKo).toBe("경주");
    expect(ktoCity("", 35.79, 129.332, [])).toBeNull();
  });
});

describe("toKtoPlace", () => {
  it("공통정보 → 앱 장소 모양(법정동 시군구 · https 사진 · 태그 없는 개요)", () => {
    const p = toKtoPlace(common)!;
    expect(p).toMatchObject({
      id: "kto:126508",
      ko: "무릉숲길",
      // 영문 관광정보에서 못 찾으면 로마자
      en: "Mureungsupgil",
      enByApp: true,
      locKo: "경주",
      pickCity: "경주",
      macro: "daegyeong",
      cat: "heal",
      lat: 35.95,
      lng: 129.05,
      min: 60,
      open: null,
      close: null,
      auto: false,
      signgu: "47130",
      photo: "https://tong.visitkorea.or.kr/cms/a.jpg",
      overview: "숲길\n산책로",
    });
  });

  it("id · 이름 · 한국 안 좌표가 없으면 null", () => {
    expect(toKtoPlace({ ...common, contentid: "" })).toBeNull();
    expect(toKtoPlace({ ...common, title: " " })).toBeNull();
    expect(toKtoPlace({ ...common, mapy: "0", mapx: "0" })).toBeNull();
  });
});

describe("resolveTourPlace · parseTourQuery", () => {
  it("앱 장소는 그대로, kto:는 공통정보에서", async () => {
    expect((await resolveTourPlace("gjx1"))?.ko).toBe("불국사");
    vi.stubEnv("DATA_GO_KR_KEY", "KEY");
    const fn = stubDetail();
    const p = await resolveTourPlace("kto:126508");
    expect(p?.signgu).toBe("47130");
    expect(new URL(fn.mock.calls[0][0]).searchParams.get("contentId")).toBe(
      "126508",
    );
  });

  it("키가 없거나 결과가 없거나 외부 실패면 404", async () => {
    const req = (id: string) =>
      new Request(`http://x/api/tour/crowd?id=${encodeURIComponent(id)}`);
    vi.stubEnv("DATA_GO_KR_KEY", "");
    let q = await parseTourQuery(req("kto:126508"), false);
    expect("error" in q && q.error.status).toBe(404);
    vi.stubEnv("DATA_GO_KR_KEY", "KEY");
    stubDetail([]);
    q = await parseTourQuery(req("kto:126508"), false);
    expect("error" in q && q.error.status).toBe(404);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x", { status: 500 })),
    );
    q = await parseTourQuery(req("kto:126508"), false);
    expect("error" in q && q.error.status).toBe(404);
  });
});

describe("GET /api/tour/spot", () => {
  const get = (id: string) =>
    tourSpotResponse(
      new Request(`http://x/api/tour/spot?id=${encodeURIComponent(id)}`),
    );

  it("브라우저에 보낼 장소(서버 전용 필드 없음)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "KEY");
    stubDetail();
    const res = await get("kto:126508");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: "kto:126508",
      ko: "무릉숲길",
      addr: "경상북도 경주시 어딘가",
    });
    expect(body).not.toHaveProperty("signgu");
    expect(body).not.toHaveProperty("overview");
  });

  it("틀린 id 400 · 키 없음 503 · 없음 404 · 외부 실패 502", async () => {
    expect((await get("gj1")).status).toBe(400);
    vi.stubEnv("DATA_GO_KR_KEY", "");
    expect((await get("kto:1")).status).toBe(503);
    vi.stubEnv("DATA_GO_KR_KEY", "KEY");
    stubDetail([]);
    expect((await get("kto:1")).status).toBe(404);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x", { status: 500 })),
    );
    expect((await get("kto:1")).status).toBe(502);
  });
});

describe("장소 시트 필드(ktoDetail)", () => {
  const place = toKtoPlace(common)!;

  it("한국어 화면은 개요 · 주소 출처, 외국어 화면에는 한국어를 보내지 않는다", () => {
    expect(ktoDetail(place, "ko")).toMatchObject({
      desc: { ko: "숲길\n산책로" },
      img: "https://tong.visitkorea.or.kr/cms/a.jpg",
      view: { desc: "숲길\n산책로", appTranslated: false },
    });
    // 로마자 이름이면 앱 번역 안내, 그 언어 공식 이름이 있으면 없다
    expect(ktoDetail(place, "en").view).toEqual({ appTranslated: true });
    expect(
      ktoDetail({ ...place, names: { ja: "ムルン森の道" } }, "ja").view,
    ).toEqual({ appTranslated: false });
    expect(
      ktoDetail(
        { ...place, en: "Mureung Forest Trail", enByApp: undefined },
        "zh",
      ).view,
    ).toEqual({ appTranslated: false });
  });
});

describe("대표 사진", () => {
  it("신규 관광지는 한국관광공사 대표 이미지를 바로 쓴다", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "KEY");
    const fn = stubDetail();
    const res = await tourPhotoResponse(
      new Request("http://x/api/tour/photo?id=kto%3A126508"),
    );
    expect(await res.json()).toEqual({
      src: "https://tong.visitkorea.or.kr/cms/a.jpg",
      source: "kto",
    });
    // 사진 검색 · 관광사진 · 위키백과를 부르지 않는다(공통정보 · 다국어 이름만)
    const paths = fn.mock.calls.map((c) => new URL(c[0]).pathname);
    expect(
      paths.filter((p) => /searchKeyword2|gallery|wikipedia/.test(p)),
    ).toEqual([]);
  });
});

describe("브라우저가 기억한 신규 관광지", () => {
  const p = { ...toKtoPlace(common)!, signgu: undefined };

  it("모양이 틀린 항목은 버린다", () => {
    expect(
      parseExtraPlaces(
        JSON.stringify([p, { id: "gj1" }, { ...p, id: "kto:x" }]),
      ),
    ).toHaveLength(1);
    expect(parseExtraPlaces("{")).toEqual([]);
    expect(parseExtraPlaces(null)).toEqual([]);
  });

  it("범위: 도시는 pickCity, 권역은 macro, 전국은 모두", () => {
    const list = parseExtraPlaces(JSON.stringify([p]));
    expect(extraInScope(list, { kind: "city", city: "경주" })).toHaveLength(1);
    expect(extraInScope(list, { kind: "city", city: "서울" })).toHaveLength(0);
    expect(
      extraInScope(list, { kind: "nation", region: "daegyeong" }),
    ).toHaveLength(1);
    expect(
      extraInScope(list, { kind: "nation", region: "capital" as never }),
    ).toHaveLength(0);
    expect(extraInScope(list, { kind: "nation", region: null })).toHaveLength(
      1,
    );
  });
});

describe("신규 관광지 외국어 이름", () => {
  const place = toKtoPlace(common)!;
  const near = (title: string, dLat = 0, type = "76") => ({
    title,
    contenttypeid: type,
    mapy: String(35.95 + dLat),
    mapx: "129.05",
  });

  it("pickForeignName: 50m 안 · 같은 타입 · 가장 가까운 곳, 한글 이름은 뺀다", () => {
    expect(FOREIGN_SAME_M).toBe(50);
    // 0.0003도 ≈ 33m, 0.001도 ≈ 111m
    expect(
      pickForeignName(
        [near("Far", 0.001), near("Near", 0.0003), near("Nearest", 0.0001)],
        place,
        "12",
      ),
    ).toBe("Nearest");
    expect(pickForeignName([near("Museum", 0, "78")], place, "12")).toBeNull();
    expect(pickForeignName([near("무릉숲길")], place, "12")).toBeNull();
    // 모르는 타입이면 타입을 보지 않는다
    expect(pickForeignName([near("Any", 0, "78")], place, "")).toBe("Any");
  });

  it("withForeignNames: 언어마다 다국어 관광정보에서 찾고, 실패한 언어만 건너뛴다", async () => {
    const byService: Record<string, unknown[] | "fail"> = {
      EngService2: [near("Mureung Forest Trail")],
      ChsService2: [near("武陵林道")],
      JpnService2: "fail",
      SpnService2: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        const service = url.pathname.split("/").at(-2) ?? "";
        const v = byService[service];
        expect(url.searchParams.get("mapX")).toBe("129.05");
        expect(url.searchParams.get("radius")).toBe("200");
        if (v === "fail" || v === undefined)
          return new Response("x", { status: 500 });
        return tourBody(v);
      }),
    );
    const out = await withForeignNames(place, "12", "KEY");
    expect(out.en).toBe("Mureung Forest Trail");
    expect(out.enByApp).toBeUndefined();
    expect(out.names).toEqual({ zh: "武陵林道" });
  });
});
