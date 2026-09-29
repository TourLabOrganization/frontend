import { afterEach, describe, expect, it, vi } from "vitest";
import plannerPlaces from "../features/planner/data/places.json";
import stories from "../features/planner/data/stories.json";
import emptyRes from "./fixtures/tour/empty.json";
import invalidKey from "./fixtures/tour/invalid-key.json";
import odiiEnBulguksa from "./fixtures/tour/odii-en-bulguksa.json";
import odiiEnCheomseongdae from "./fixtures/tour/odii-en-cheomseongdae.json";
import odiiJpChangdeokgung from "./fixtures/tour/odii-jp-changdeokgung.json";
import odiiKoBulguksa from "./fixtures/tour/odii-ko-bulguksa.json";
import { hasHangul } from "./hangul";
import { parseTourItems, tourPlace } from "./tour-api";
import {
  audioForLocale,
  audioUrl,
  ODII_LANG,
  odiiQueries,
  odiiUrl,
  pickOdii,
  playSeconds,
  storyFor,
  tourAudioResponse,
} from "./tour-audio";

// 오디(Odii storySearchList) 실제 응답(2026-09-29 받음, fixtures/tour, 키는 지웠다):
//   odii-ko-bulguksa      langCode=ko keyword=불국사 (15건 중 10건)
//   odii-en-bulguksa      langCode=en keyword=Bulguksa (9건). 한국어 「불국사」로 찾으면 en · jp 모두 0건(empty.json)
//   odii-en-cheomseongdae langCode=en keyword=Cheomseongdae (4건, 첫째는 충북 화양구곡이라 좌표로 걸러진다)
//   odii-jp-changdeokgung langCode=jp keyword=昌徳宮 (3건). 「慶州 瞻星台」로 찾으면 0건(empty.json)
//   empty                 결과 없음(오디 「효우당」 등, items가 빈 문자열)
//   invalid-key           등록되지 않은 키(HTTP 403, OpenAPI_ServiceResponse)
const items = (body: unknown) => parseTourItems(body) ?? [];
const place = (id: string) => tourPlace(id)!;
const at = (id: string, name: string) => ({
  name,
  lat: place(id).lat,
  lng: place(id).lng,
});

describe("오디 언어 코드 · 검색어 (2026-09-29 실제 호출로 확인)", () => {
  it("ko → ko · en → en · ja → jp · zh → en · es → en (오디에는 ko · en · jp 자료만 있다)", () => {
    expect(ODII_LANG).toEqual({
      ko: "ko",
      en: "en",
      ja: "jp",
      zh: "en",
      es: "en",
    });
  });

  it("그 언어 이름으로 찾는다: 한국어 이름 · 영어 이름 · 일본어 공식 명칭(없으면 영어)", () => {
    const gjx1 = place("gjx1");
    expect(odiiQueries(gjx1, "ko")).toEqual([
      { langCode: "ko", keyword: "불국사" },
    ]);
    for (const locale of ["en", "zh", "es"] as const)
      expect(odiiQueries(gjx1, locale)).toEqual([
        { langCode: "en", keyword: "Bulguksa" },
      ]);
    // 일본어 공식 명칭이 이름표에 없는 곳은 영어로
    expect(odiiQueries(gjx1, "ja")).toEqual([
      { langCode: "en", keyword: "Bulguksa" },
    ]);
    // 있으면 jp 먼저, 결과가 없으면 영어
    expect(odiiQueries(place("kdx1"), "ja", "昌徳宮")).toEqual([
      { langCode: "jp", keyword: "昌徳宮" },
      { langCode: "en", keyword: "Changdeokgung Palace" },
    ]);
  });

  it("주소: 한국관광공사 오디 이야기 검색, 10건", () => {
    const url = new URL(odiiUrl("KEY", { langCode: "jp", keyword: "昌徳宮" }));
    expect(url.origin + url.pathname).toBe(
      "https://apis.data.go.kr/B551011/Odii/storySearchList",
    );
    expect(url.searchParams.get("langCode")).toBe("jp");
    expect(url.searchParams.get("keyword")).toBe("昌徳宮");
    expect(url.searchParams.get("numOfRows")).toBe("10");
    expect(url.searchParams.get("_type")).toBe("json");
  });
});

describe("오디 결과 고르기 (PoC loadAudio)", () => {
  it("한국어: 이름이 겹치는 첫째 — 「경주 불국사」, 음성 주소(https) · 재생 시간(초)", () => {
    const audio = pickOdii(items(odiiKoBulguksa), at("gjx1", "불국사"));
    expect(audio).toMatchObject({
      title: "경주 불국사",
      audioUrl:
        "https://sfj608538-sfj608538.ktcdn.co.kr/file/audio/56/16101.mp3",
      playTime: 121,
      source: "odii",
    });
    expect(audio?.script.startsWith("“성불하십시오”")).toBe(true);
  });

  it("영어 · 일본어도 그 언어 이름이 겹치는 첫째", () => {
    expect(pickOdii(items(odiiEnBulguksa), at("gjx1", "Bulguksa"))?.title).toBe(
      "Entrance (Bulguksa Temple)",
    );
    expect(
      pickOdii(items(odiiJpChangdeokgung), at("kdx1", "昌徳宮"))?.title,
    ).toBe("北村一景：昌徳宮(チャンドックン)");
  });

  it("좌표가 ±0.12도 밖이면 버린다 (같은 이름의 충북 화양구곡 첨성대)", () => {
    const list = items(odiiEnCheomseongdae);
    expect(list[0].title).toContain("Hwayanggugok");
    const audio = pickOdii(list, at("gjx3", "Cheomseongdae"));
    expect(audio?.title).toBe("Cheomseong Observatory, A star-gazing tower");
    // 이 항목은 음성 주소가 없다 → 재생 칸 없이 대본만
    expect(audio?.audioUrl).toBeUndefined();
    expect(audio?.playTime).toBeUndefined();
  });

  it("경계: 모든 항목에서 0.12도를 넘게 떨어진 곳이면 없음, 안이면 고른다", () => {
    const list = items(odiiKoBulguksa);
    const lats = list.map((x) => Number(x.mapY));
    const lng = place("gjx1").lng;
    const far = { name: "불국사", lat: Math.max(...lats) + 0.1201, lng };
    const near = { name: "불국사", lat: Math.min(...lats) + 0.11, lng };
    expect(pickOdii(list, far)).toBeNull();
    expect(pickOdii(list, near)?.title).toBe("경주 불국사");
  });

  it("대본이 없으면 버리고, 오디 좌표가 없으면 좌표 비교 없이 통과 (실제 항목에서 그 필드만 뺐다)", () => {
    const [first] = items(odiiKoBulguksa);
    expect(pickOdii([{ ...first, script: "" }], at("gjx1", "불국사"))).toBe(
      null,
    );
    const far = { name: "불국사", lat: 37.5, lng: 127 };
    expect(pickOdii([{ ...first, mapX: "", mapY: "" }], far)?.title).toBe(
      "경주 불국사",
    );
    expect(pickOdii(items(emptyRes), at("gjx1", "불국사"))).toBeNull();
  });

  it("음성 주소는 http(s)만(https로), 재생 시간은 초", () => {
    const real =
      "https://sfj608538-sfj608538.ktcdn.co.kr/file/audio/56/16101.mp3";
    expect(audioUrl(real)).toBe(real);
    expect(audioUrl(real.replace("https:", "http:"))).toBe(real);
    expect(audioUrl("javascript:alert(1)")).toBeUndefined();
    expect(audioUrl("")).toBeUndefined();
    expect(playSeconds("121")).toBe(121);
    expect(playSeconds("")).toBeUndefined();
    expect(playSeconds("0")).toBeUndefined();
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
  it("외국어 화면에 한글이 섞인 대본이면 버리고, 영어 대본은 그대로", () => {
    const ko = pickOdii(items(odiiKoBulguksa), at("gjx1", "불국사"));
    const en = pickOdii(items(odiiEnBulguksa), at("gjx1", "Bulguksa"));
    expect(audioForLocale(ko, "en")).toBeNull();
    expect(audioForLocale(en, "es")).toEqual(en);
    expect(hasHangul(JSON.stringify(en))).toBe(false);
    expect(audioForLocale(ko, "ko")).toEqual(ko);
  });
});

describe("GET /api/tour/audio", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const call = (qs: string) =>
    tourAudioResponse(new Request(`http://localhost/api/tour/audio?${qs}`));

  /** 오디 실제 응답을 언어 코드 · 검색어로 돌려준다. 표에 없는 검색은 실제 빈 응답 */
  function stubOdii(table: Record<string, unknown>) {
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        const k = `${url.searchParams.get("langCode")}|${url.searchParams.get("keyword")}`;
        asked.push(k);
        return Response.json(table[k] ?? emptyRes);
      }),
    );
    return asked;
  }
  const REAL = {
    "ko|불국사": odiiKoBulguksa,
    "en|Bulguksa": odiiEnBulguksa,
    "en|Cheomseongdae": odiiEnCheomseongdae,
    "jp|昌徳宮": odiiJpChangdeokgung,
  };

  it("키가 없으면: 한국어 화면은 스토리텔링 또는 결과 없음(캐시하지 않는다), 외국어 화면은 503", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const story = await call("id=gjx3&locale=ko");
    expect(story.status).toBe(200);
    expect(story.headers.get("Cache-Control")).toBe("no-store");
    expect(await story.json()).toMatchObject({
      title: "고대 사람들은 왜 별을 관측했을까요",
      source: "story",
    });
    expect(await (await call("id=gj1&locale=ko")).json()).toEqual({
      empty: true,
    });
    const en = await call("id=gjx3&locale=en");
    expect(en.status).toBe(503);
    expect(await en.json()).toEqual({ message: "not configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("id · 언어가 없거나 틀리면 400, 모르는 장소는 404", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    expect((await call("locale=ko")).status).toBe(400);
    expect((await call("id=gjx3")).status).toBe(400);
    expect((await call("id=gjx3&locale=fr")).status).toBe(400);
    expect((await call("id=nope&locale=ko")).status).toBe(404);
  });

  it("한국어 화면: 오디 결과(하루 캐시)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    const asked = stubOdii(REAL);
    const res = await call("id=gjx1&locale=ko");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(await res.json()).toMatchObject({
      title: "경주 불국사",
      playTime: 121,
      source: "odii",
    });
    expect(asked).toEqual(["ko|불국사"]);
  });

  it("영어 · 중국어 · 스페인어 화면은 영어 이름으로 en 자료", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    for (const locale of ["en", "zh", "es"]) {
      const asked = stubOdii(REAL);
      const body = await (await call(`id=gjx1&locale=${locale}`)).json();
      expect(body).toMatchObject({ title: "Entrance (Bulguksa Temple)" });
      expect(hasHangul(JSON.stringify(body))).toBe(false);
      expect(asked).toEqual(["en|Bulguksa"]);
    }
  });

  it("일본어 화면: 공식 명칭으로 jp, 결과가 없거나 명칭이 없으면 영어", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    let asked = stubOdii(REAL);
    expect(await (await call("id=kdx1&locale=ja")).json()).toMatchObject({
      title: "北村一景：昌徳宮(チャンドックン)",
    });
    expect(asked).toEqual(["jp|昌徳宮"]);

    // 첨성대: 일본어 공식 명칭 「慶州 瞻星台」로는 0건(실제) → 영어
    asked = stubOdii(REAL);
    expect(await (await call("id=gjx3&locale=ja")).json()).toMatchObject({
      title: "Cheomseong Observatory, A star-gazing tower",
    });
    expect(asked).toEqual(["jp|慶州 瞻星台", "en|Cheomseongdae"]);

    // 불국사: 일본어 공식 명칭이 이름표에 없다 → 바로 영어
    asked = stubOdii(REAL);
    await call("id=gjx1&locale=ja");
    expect(asked).toEqual(["en|Bulguksa"]);
  });

  it("오디에 결과가 없으면 한국어 화면은 스토리텔링, 외국어 화면은 결과 없음", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    stubOdii({});
    expect(await (await call("id=gjx3&locale=ko")).json()).toMatchObject({
      source: "story",
    });
    expect(await (await call("id=gjx3&locale=en")).json()).toEqual({
      empty: true,
    });
  });

  it("외국어 화면에 한글 대본이 오면 결과 없음 (en 검색에 한국어 실제 응답을 돌려 본다)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    stubOdii({ "en|Bulguksa": odiiKoBulguksa });
    const body = await (await call("id=gjx1&locale=en")).json();
    expect(body).toEqual({ empty: true });
  });

  it("외부 실패는 502(한국어 스토리텔링 장소는 스토리텔링), 키는 응답에 없다", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    // 등록되지 않은 키의 실제 응답(HTTP 403)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(invalidKey, { status: 403 })),
    );
    const res = await call("id=gj1&locale=ko");
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("SECRET-KEY");
    const story = await call("id=gjx3&locale=ko");
    expect(story.status).toBe(200);
    expect(story.headers.get("Cache-Control")).toBe("no-store");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    expect((await call("id=gjx3&locale=en")).status).toBe(502);
  });

  it("키는 서버 환경변수로 공공데이터포털 주소에만 싣는다", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        urls.push(input);
        return Response.json(odiiKoBulguksa);
      }),
    );
    const res = await call("id=gjx1&locale=ko");
    const url = new URL(urls[0]);
    expect(url.host).toBe("apis.data.go.kr");
    expect(url.searchParams.get("serviceKey")).toBe("SECRET-KEY");
    expect(await res.text()).not.toContain("SECRET-KEY");
  });
});
