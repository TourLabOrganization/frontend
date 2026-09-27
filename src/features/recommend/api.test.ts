import { afterEach, describe, expect, it, vi } from "vitest";
import ko from "../../../messages/ko.json";
import {
  API_CATS,
  buildRecommendRequest,
  pickCategory,
  type RecommendResponse,
  type RecommendThemeResponse,
  regionName,
  SOURCE_KEYS,
  toThemeCards,
} from "./api";
import { QUESTION_BY_ID } from "./questions";
import { CATEGORY_IDS, INTEREST_CATEGORY, THEMES } from "./themes";

const share = (values: number[]) =>
  Object.fromEntries(API_CATS.map((name, i) => [name, values[i]]));

const item = (
  theme: string,
  values = [0.4, 0.3, 0.2, 0.1, 0],
): RecommendThemeResponse => ({
  theme,
  fit: 0,
  interest: 0,
  region: 0,
  score: 0,
  share: share(values),
});

const response = (themes: RecommendThemeResponse[]): RecommendResponse => ({
  cluster: "C4",
  cats: [...API_CATS],
  region: null,
  regionApplied: false,
  sources: ["국민여행조사", "외래관광객조사"],
  themes,
});

describe("관심 카테고리 순서", () => {
  it("CATEGORY_IDS는 추천 API cats 순서와 같다", () => {
    expect(CATEGORY_IDS.map((id) => ko.Result.categories[id])).toEqual([
      ...API_CATS,
    ]);
  });

  it("Q4 관심사 index는 API cats의 같은 이름을 가리킨다", () => {
    const expected: Record<string, string> = {
      history: "역사·문화",
      nature: "힐링·생태",
      activity: "테마파크·액티비티",
      "food-market": "로컬·먹거리",
      sea: "해양·자연",
    };
    for (const [option, name] of Object.entries(expected)) {
      expect(API_CATS[INTEREST_CATEGORY[option]]).toBe(name);
    }
  });
});

describe("buildRecommendRequest", () => {
  it("Q4 관심사 · 야경 · Q15 지역을 요청으로 옮긴다", () => {
    expect(
      buildRecommendRequest(
        {
          q1: ["60s"],
          q4: ["history", "night"],
          q15: ["gyeongju"],
        },
        "C4",
      ),
    ).toEqual({ cluster: "C4", interests: [0], night: true, region: "경주" });
  });

  it("Q15를 안 골랐으면 region을 보내지 않는다", () => {
    const request = buildRecommendRequest({ q4: ["sea", "drama"] }, "C2");
    expect(request).toEqual({ cluster: "C2", interests: [4], night: false });
    expect("region" in request).toBe(false);
  });

  it("Q15 보기는 모두 API 지역 이름이 있다", () => {
    expect(
      QUESTION_BY_ID.q15.options.map((option) => regionName(option)),
    ).toEqual(["서울", "부산", "경주", "제주", "거제", "영월"]);
    expect(regionName("gangwon")).toBeUndefined();
    expect(regionName(undefined)).toBeUndefined();
  });
});

describe("toThemeCards", () => {
  it("API 테마 이름을 우리 테마 slug로 잇는다", () => {
    const names: Record<string, string> = {
      "왕과 사는 남자": "kings-warden",
      "케이팝 데몬 헌터스": "kpop-demon-hunters",
      "RESCENE Route": "rescene-route",
      "제주 K-Drama": "jeju-k-drama",
      "부산 영화 기행": "busan-film-trip",
    };
    const cards = toThemeCards(
      response(Object.keys(names).map((name) => item(name))),
      [],
    );
    expect(cards.map((c) => c.slug)).toEqual(Object.values(names));
    expect(THEMES).toHaveLength(Object.keys(names).length);
  });

  it("[가상] 테마와 모르는 테마는 빼고, API 순서대로 순위를 매긴다", () => {
    const cards = toThemeCards(
      response([
        item("[가상] 대구·안동 먹방 예능 로드"),
        item("부산 영화 기행"),
        item("모르는 테마"),
        item("왕과 사는 남자"),
      ]),
      [],
    );
    expect(cards.map((c) => [c.slug, c.rank])).toEqual([
      ["busan-film-trip", 1],
      ["kings-warden", 2],
    ]);
    expect(cards[0].regions).toEqual(["busan"]);
  });

  it("분류 비중은 API share에서 고른 관심사 중 가장 큰 분류를 보인다", () => {
    const [card] = toThemeCards(
      response([item("제주 K-Drama", [0.1654, 0.437, 0.084, 0.0519, 0.2617])]),
      [0, 4],
    );
    expect(card.category).toEqual({
      id: "nature",
      share: 0.2617,
      matched: true,
    });
  });
});

describe("pickCategory", () => {
  it("관심사가 없으면 테마에서 가장 큰 분류", () => {
    expect(pickCategory([0.1, 0.5, 0.2, 0.1, 0.1], [])).toEqual({
      id: "healing",
      share: 0.5,
      matched: false,
    });
  });

  it("고른 관심사 분류가 0%면 테마에서 가장 큰 분류", () => {
    expect(pickCategory([0.4, 0.3, 0.2, 0.1, 0], [4])).toEqual({
      id: "history",
      share: 0.4,
      matched: false,
    });
  });

  it("share가 비어 있으면 null", () => {
    expect(pickCategory([0, 0, 0, 0, 0], [])).toBeNull();
  });
});

describe("fetchRecommendation (가짜 fetch)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // client.ts는 불러올 때 NEXT_PUBLIC_API_BASE_URL을 읽는다. 환경변수를 넣고 새로 불러온다
  async function load(fetchImpl: typeof fetch) {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://backend.test");
    vi.stubGlobal("fetch", vi.fn(fetchImpl));
    vi.resetModules();
    return import("./api");
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  it("성공하면 data를 돌려주고 요청을 JSON POST로 보낸다", async () => {
    const data = response([item("왕과 사는 남자")]);
    const { fetchRecommendation } = await load(async () =>
      json(200, { code: "API_SUCCESS", message: "ok", data }),
    );
    const result = await fetchRecommendation({
      cluster: "C4",
      interests: [0],
      night: false,
      region: "경주",
    });
    expect(result).toEqual({ ok: true, data });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://backend.test/api/v1/recommend");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      cluster: "C4",
      interests: [0],
      night: false,
      region: "경주",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("ApiError(400)는 실패로 돌려준다", async () => {
    const { fetchRecommendation } = await load(async () =>
      json(400, { code: "INVALID_INPUT_VALUE", message: "bad" }),
    );
    const result = await fetchRecommendation({
      cluster: "C99",
      interests: [],
      night: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({
        name: "ApiError",
        status: 400,
        code: "INVALID_INPUT_VALUE",
      });
    }
  });

  it("네트워크 오류 · 시간 초과는 실패로 돌려준다", async () => {
    for (const error of [
      new TypeError("fetch failed"),
      new DOMException("The operation timed out.", "TimeoutError"),
    ]) {
      const { fetchRecommendation } = await load(async () => {
        throw error;
      });
      const result = await fetchRecommendation({
        cluster: "C4",
        interests: [],
        night: false,
      });
      expect(result).toEqual({ ok: false, error });
    }
  });

  it("주소가 설정되지 않았으면 실패로 돌려준다", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    vi.resetModules();
    const { fetchRecommendation } = await import("./api");
    const result = await fetchRecommendation({
      cluster: "C4",
      interests: [],
      night: false,
    });
    expect(result.ok).toBe(false);
  });
});

describe("출처 이름 표", () => {
  it("백엔드가 보내는 출처 이름 3개를 모두 화면 문구 키로 바꾼다", () => {
    expect(
      [
        "국민여행조사",
        "외래관광객조사",
        "한국관광 데이터랩 (지역×테마 강도 TFI)",
      ].map((name) => SOURCE_KEYS[name]),
    ).toEqual(["nationalTravel", "inbound", "datalabTfi"]);
  });
});
