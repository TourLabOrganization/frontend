import { afterEach, describe, expect, it, vi } from "vitest";
import plannerPlaces from "../features/planner/data/places.json";
import stories from "../features/planner/data/stories.json";
import { hasHangul } from "./hangul";
import {
  audioForLocale,
  audioUrl,
  ODII_LANG,
  odiiUrl,
  pickOdii,
  playSeconds,
  storyFor,
  tourAudioResponse,
} from "./tour-audio";

// 첨성대(gjx3, 경주 35.8347 · 129.2190 부근)
const PLACE = { ko: "첨성대", lat: 35.8347, lng: 129.219 };

/** 오디 storySearchList item (PoC loadAudio가 읽는 필드) */
const item = (over: Record<string, unknown> = {}) => ({
  title: "첨성대",
  audioTitle: "첨성대의 비밀",
  script: "첨성대는 신라 선덕여왕 때 세운 천문대입니다.",
  mapX: "129.2190",
  mapY: "35.8347",
  audioUrl: "http://example.com/odii/a.mp3",
  playTime: "185",
  ...over,
});

describe("오디 언어 코드 (PoC ODII_LANG)", () => {
  it("ko → ko · en → en · ja → ja · zh → ch · es → en", () => {
    expect(ODII_LANG).toEqual({
      ko: "ko",
      en: "en",
      ja: "ja",
      zh: "ch",
      es: "en",
    });
  });

  it("검색어는 화면 언어와 상관없이 한국어 이름이다", () => {
    const url = new URL(odiiUrl("KEY", "zh", "첨성대"));
    expect(url.origin + url.pathname).toBe(
      "https://apis.data.go.kr/B551011/Odii/storySearchList",
    );
    expect(url.searchParams.get("langCode")).toBe("ch");
    expect(url.searchParams.get("keyword")).toBe("첨성대");
    expect(url.searchParams.get("numOfRows")).toBe("10");
    expect(url.searchParams.get("_type")).toBe("json");
  });
});

describe("오디 결과 고르기 (PoC loadAudio)", () => {
  it("좌표가 ±0.12도 안이고 이름이 겹치는 것을 고른다", () => {
    const far = item({ title: "첨성대", mapY: "37.5", mapX: "127.0" });
    const other = item({ title: "대릉원", audioTitle: "대릉원" });
    const hit = item({ title: "경주 첨성대", audioTitle: "별을 보던 곳" });
    expect(pickOdii([far, other, hit], PLACE)?.title).toBe("별을 보던 곳");
  });

  it("이름이 겹치는 것이 없으면 좌표 안의 첫째", () => {
    const a = item({ title: "대릉원", audioTitle: "대릉원 이야기" });
    const b = item({ title: "계림", audioTitle: "계림 이야기" });
    expect(pickOdii([a, b], PLACE)?.title).toBe("대릉원 이야기");
  });

  it("경계: 위도 · 경도 어느 쪽이든 0.12도를 넘으면 버린다", () => {
    const north = item({ mapY: String(PLACE.lat + 0.1201) });
    const east = item({ mapX: String(PLACE.lng + 0.1201) });
    const inside = item({ mapY: String(PLACE.lat - 0.1199) });
    expect(pickOdii([north], PLACE)).toBeNull();
    expect(pickOdii([east], PLACE)).toBeNull();
    expect(pickOdii([inside], PLACE)).not.toBeNull();
  });

  it("오디 좌표가 없으면 좌표 비교 없이 통과, 대본이 없으면 버린다", () => {
    expect(pickOdii([item({ mapY: "", mapX: "" })], PLACE)).not.toBeNull();
    expect(pickOdii([item({ script: "" })], PLACE)).toBeNull();
    expect(pickOdii([], PLACE)).toBeNull();
  });

  it("제목은 audioTitle → title, 음성 주소는 https로, 재생 시간은 초", () => {
    expect(pickOdii([item()], PLACE)).toEqual({
      title: "첨성대의 비밀",
      script: "첨성대는 신라 선덕여왕 때 세운 천문대입니다.",
      audioUrl: "https://example.com/odii/a.mp3",
      playTime: 185,
      source: "odii",
    });
    expect(pickOdii([item({ audioTitle: "" })], PLACE)?.title).toBe("첨성대");
    const noAudio = pickOdii([item({ audioUrl: "" })], PLACE);
    expect(noAudio?.audioUrl).toBeUndefined();
    expect(noAudio?.playTime).toBeUndefined();
  });

  it("음성 주소는 http(s)만, 재생 시간은 초 · 분:초를 읽는다", () => {
    expect(audioUrl("javascript:alert(1)")).toBeUndefined();
    expect(audioUrl("not a url")).toBeUndefined();
    expect(audioUrl("https://a.example/x.mp3")).toBe("https://a.example/x.mp3");
    expect(playSeconds(90)).toBe(90);
    expect(playSeconds("03:05")).toBe(185);
    expect(playSeconds("1:02:03")).toBe(3723);
    expect(playSeconds("abc")).toBeUndefined();
    expect(playSeconds(0)).toBeUndefined();
  });
});

describe("한국어 스토리텔링 대체 (PoC STORY_DB)", () => {
  it("31곳이 모두 플래너 장소 이름과 맞는다", () => {
    const names = new Set(plannerPlaces.map((p) => p.ko));
    expect(Object.keys(stories)).toHaveLength(31);
    for (const name of Object.keys(stories)) expect(names.has(name)).toBe(true);
  });

  it("이름으로 찾고, 없으면 null", () => {
    expect(storyFor("불국사")).toMatchObject({
      title: "자연과 인공의 조화 불국사 석축",
      source: "story",
    });
    expect(storyFor("효우당")).toBeNull();
    expect(storyFor("toString")).toBeNull();
  });
});

describe("외국어 화면 한글 거르기", () => {
  const audio = pickOdii([item()], PLACE)!;
  const english = {
    ...audio,
    title: "Cheomseongdae",
    script: "An astronomical observatory from the Silla era.",
  };

  it("외국어 화면은 제목 · 대본에 한글이 섞이면 버린다", () => {
    expect(audioForLocale(audio, "en")).toBeNull();
    expect(
      audioForLocale({ ...english, script: english.script + " 첨성대" }, "ja"),
    ).toBeNull();
    expect(audioForLocale(english, "en")).toEqual(english);
  });

  it("한국어 화면은 그대로", () => {
    expect(audioForLocale(audio, "ko")).toEqual(audio);
  });
});

describe("GET /api/tour/audio", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const call = (qs: string) =>
    tourAudioResponse(new Request(`http://localhost/api/tour/audio?${qs}`));
  const odii = (items: unknown[]) =>
    new Response(
      JSON.stringify({
        response: {
          header: { resultCode: "0000", resultMsg: "OK" },
          body: { items: items.length ? { item: items } : "" },
        },
      }),
    );

  it("키가 없어도 한국어 화면의 스토리텔링 장소는 보인다(캐시하지 않는다)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await call("id=gjx3&locale=ko");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({
      title: "고대 사람들은 왜 별을 관측했을까요",
      source: "story",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("키가 없으면 외국어 화면은 503, 한국어 화면의 스토리텔링이 없는 장소는 결과 없음", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "");
    const res = await call("id=gjx3&locale=en");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ message: "not configured" });
    const none = await call("id=gj1&locale=ko");
    expect(none.status).toBe(200);
    expect(none.headers.get("Cache-Control")).toBe("no-store");
    expect(await none.json()).toEqual({ empty: true });
  });

  it("id · 언어가 없거나 틀리면 400, 모르는 장소는 404", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    expect((await call("locale=ko")).status).toBe(400);
    expect((await call("id=gjx3")).status).toBe(400);
    expect((await call("id=gjx3&locale=fr")).status).toBe(400);
    expect((await call("id=nope&locale=ko")).status).toBe(404);
  });

  it("오디 결과를 보내고, 없으면 한국어 화면은 스토리텔링 · 외국어 화면은 결과 없음", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => odii([item()])),
    );
    const hit = await call("id=gjx3&locale=ko");
    expect(await hit.json()).toMatchObject({
      title: "첨성대의 비밀",
      source: "odii",
    });
    expect(hit.headers.get("Cache-Control")).toBe("public, max-age=86400");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => odii([])),
    );
    expect(await (await call("id=gjx3&locale=ko")).json()).toMatchObject({
      source: "story",
    });
    expect(await (await call("id=gjx3&locale=en")).json()).toEqual({
      empty: true,
    });
  });

  it("외국어 화면에 한글 대본이 오면 결과 없음", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => odii([item()])),
    );
    const body = await (await call("id=gjx3&locale=ja")).json();
    expect(body).toEqual({ empty: true });
    expect(hasHangul(JSON.stringify(body))).toBe(false);
  });

  it("외부 실패는 502(한국어 스토리텔링 장소는 스토리텔링), 키는 응답에 없다", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<OpenAPI_ServiceResponse/>")),
    );
    const res = await call("id=gj1&locale=ko");
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("SECRET-KEY");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const story = await call("id=gjx3&locale=ko");
    expect(story.status).toBe(200);
    expect(story.headers.get("Cache-Control")).toBe("no-store");
    expect((await call("id=gjx3&locale=en")).status).toBe(502);
  });

  it("키는 서버 환경변수로 공공데이터포털 주소에만 싣는다", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        urls.push(input);
        return odii([item()]);
      }),
    );
    const res = await call("id=gjx3&locale=zh");
    const url = new URL(urls[0]);
    expect(url.host).toBe("apis.data.go.kr");
    expect(url.searchParams.get("serviceKey")).toBe("SECRET-KEY");
    expect(url.searchParams.get("langCode")).toBe("ch");
    expect(await res.text()).not.toContain("SECRET-KEY");
  });
});
