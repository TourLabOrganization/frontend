import { afterEach, describe, expect, it, vi } from "vitest";
import plannerPlaces from "../features/planner/data/places.json";
import stories from "../features/planner/data/stories.json";
import emptyRes from "./fixtures/tour/empty.json";
import invalidKey from "./fixtures/tour/invalid-key.json";
import odiiEnBadabuchae from "./fixtures/tour/odii-en-badabuchae.json";
import odiiEnBulguksa from "./fixtures/tour/odii-en-bulguksa.json";
import odiiEnCheomseongdae from "./fixtures/tour/odii-en-cheomseongdae.json";
import odiiJpChangdeokgung from "./fixtures/tour/odii-jp-changdeokgung.json";
import odiiEnGyeongnam from "./fixtures/tour/odii-en-gyeongnam.json";
import odiiEnNearHwangnidan from "./fixtures/tour/odii-en-near-hwangnidan.json";
import odiiEnNearWindyhill from "./fixtures/tour/odii-en-near-windyhill.json";
import odiiJpBulguksa from "./fixtures/tour/odii-jp-bulguksa.json";
import odiiJpNearHwangnidan from "./fixtures/tour/odii-jp-near-hwangnidan.json";
import odiiJpNearWindyhill from "./fixtures/tour/odii-jp-near-windyhill.json";
import odiiKoBadabuchae from "./fixtures/tour/odii-ko-badabuchae.json";
import odiiKoBulguksa from "./fixtures/tour/odii-ko-bulguksa.json";
import odiiKoCheomseongdae from "./fixtures/tour/odii-ko-cheomseongdae.json";
import odiiKoHanok from "./fixtures/tour/odii-ko-hanok.json";
import odiiKoHwangnidan from "./fixtures/tour/odii-ko-hwangnidan.json";
import odiiKoJeonjuFull from "./fixtures/tour/odii-ko-jeonju-full.json";
import odiiKoWindyhill from "./fixtures/tour/odii-ko-windyhill.json";
import themeEnP1 from "./fixtures/tour/odii-theme-en-p1.json";
import themeEnP2 from "./fixtures/tour/odii-theme-en-p2.json";
import themeJpP1 from "./fixtures/tour/odii-theme-jp-p1.json";
import themeJpP2 from "./fixtures/tour/odii-theme-jp-p2.json";
import themeSearchKoHwangnidan from "./fixtures/tour/odii-theme-search-ko-hwangnidan.json";
import { hasHangul } from "./hangul";
import { parseTourItems, tourPlace } from "./tour-api";
import {
  audioForLocale,
  audioUrl,
  clearOdiiCache,
  ODII_LANG,
  odiiKoCandidates,
  odiiQueries,
  odiiThemes,
  odiiUrl,
  pickOdii,
  pickOdiiByTid,
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
// 외국어 화면의 관광지 번호(tid) 잇기에 쓰는 실제 응답:
//   odii-ko-hwangnidan · odii-ko-windyhill · odii-ko-cheomseongdae  한국어 해설 검색(tid 1312 · 1139와 2880 · 338 · 2967 · 3415)
//   odii-theme-{en,jp}-p{1,2}  관광지 목록 themeBasedList 1,000개씩 두 쪽(en 1,356 · jp 1,134곳 중 tid 2 · 562 · 617 · 1312 · 2880 등만 남겼다)
//   odii-theme-search-ko-hwangnidan  themeSearchList ko 「황리단길」 → tid 1312
//   odii-jp-bulguksa  jp 「仏国寺」(14건 중 10건). en 「Bulguksa Temple」 응답은 「Bulguksa」와 똑같아 odii-en-bulguksa를 쓴다
//   odii-en-gyeongnam  en 「Gyeongsangnam-do」 → tid 617(산청)뿐
//   odii-{en,jp}-near-{hwangnidan,windyhill}  storyLocationBasedList 반경 1km(황리단길은 앞 4건만 남겼다)
//   en 「Hwanglidan-gil」 · jp 「ファンリダンギル」 · jp 「慶尚南道(キョンサンナムド)」 이야기 검색은 0건(empty)
//   odii-ko-jeonju-full  ko 「전주한옥마을」 1건(좌표가 약 37km 남쪽이라 ±0.12도 밖), odii-ko-hanok  ko 「한옥마을」 13건 중 10건
//   odii-ko-badabuchae  ko 「정동심곡바다부채길」 2건(tid 562, 음성 파일 없이 대본만). 「정동심곡 바다부채길」(공백)로 찾으면 0건(empty)
//   odii-en-badabuchae  en 「Jeongdong-simgok Badabuchae-gil Trail」 1건(tid 562, 음성 파일 없이 대본만)
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

  it("주소: 한국관광공사 오디 이야기 검색, 30건", () => {
    const url = new URL(odiiUrl("KEY", { langCode: "jp", keyword: "昌徳宮" }));
    expect(url.origin + url.pathname).toBe(
      "https://apis.data.go.kr/B551011/Odii/storySearchList",
    );
    expect(url.searchParams.get("langCode")).toBe("jp");
    expect(url.searchParams.get("keyword")).toBe("昌徳宮");
    expect(url.searchParams.get("numOfRows")).toBe("30");
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

  it("좌표가 ±0.12도 밖이면 버리고, 같은 관광지(tid) 안에서는 음성 있는 해설을 먼저", () => {
    const list = items(odiiEnCheomseongdae);
    // 첫째는 같은 이름의 충북 화양구곡(tid 338) — 좌표로 빠진다
    expect(list[0].title).toContain("Hwayanggugok");
    const audio = pickOdii(list, at("gjx3", "Cheomseongdae"));
    // tid 2967의 첫 해설 「Cheomseongdae: On a way to observatory」는 음성이 없어, 음성 있는 해설 중 이름이 겹치는 첫째
    expect(audio).toMatchObject({
      title: "At the Cheomseong Observatory (Cheomseongdae)",
      playTime: 117,
    });
    expect(audio?.audioUrl).toMatch(/^https:/);
  });

  it("한국어 화면도 같은 규칙: 고른 해설에 음성이 없으면 같은 tid의 음성 있는 해설 (실제 항목에서 첫 해설의 음성만 뺐다)", () => {
    const [first, ...rest] = items(odiiKoBulguksa);
    const list = [{ ...first, audioUrl: "" }, ...rest];
    expect(pickOdii(list, at("gjx1", "불국사"))).toMatchObject({
      title: "부처님의 나라를 지키는 천왕문",
      playTime: 96,
    });
    // 같은 tid에 음성 있는 해설이 없으면 대본만 있는 대표(황리단길 ko: 1건, 음성 없음)
    const gj4 = pickOdii(items(odiiKoHwangnidan), at("gj4", "황리단길"));
    expect(gj4?.title).toBe("경주 황리단길");
    expect(gj4?.audioUrl).toBeUndefined();
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

describe("외국어 해설을 관광지 번호(tid)로 잇기", () => {
  it("tid는 언어가 달라도 같다: 황리단길 ko 1312 = en 「Hwanglidan-gil」 = jp 「ファンリダンギル」", () => {
    expect(items(themeSearchKoHwangnidan)[0]).toMatchObject({
      tid: "1312",
      title: "황리단길",
    });
    expect(items(odiiKoHwangnidan)[0].tid).toBe("1312");
    const en = odiiThemes([...items(themeEnP1), ...items(themeEnP2)]);
    const jp = odiiThemes([...items(themeJpP1), ...items(themeJpP2)]);
    expect(en.get("1312")?.title).toBe("Hwanglidan-gil");
    expect(jp.get("1312")?.title).toBe("ファンリダンギル");
    expect(en.get("2")?.title).toBe("Bulguksa Temple");
    // 관광지 제목의 끝 공백은 뗀다(「Gyeongsangnam-do 」)
    expect(en.get("2880")?.title).toBe("Gyeongsangnam-do");
  });

  it("한국어 해설 후보: 같은 기준으로 고를 수 있는 것 모두 (바람의 언덕: 같은 제목 · 좌표로 tid 1139 · 2880)", () => {
    expect(
      odiiKoCandidates(items(odiiKoWindyhill), at("gz4", "바람의 언덕")).map(
        (x) => x.tid,
      ),
    ).toEqual(["1139", "2880"]);
    // 첨성대: 충북 화양구곡(338)은 좌표로 빠지고 이름이 겹치는 2967 · 3415
    expect(
      odiiKoCandidates(items(odiiKoCheomseongdae), at("gjx3", "첨성대")).map(
        (x) => x.tid,
      ),
    ).toEqual(["2967", "3415"]);
  });

  it("대표 해설: 같은 tid 중 음성 있는 것 먼저, 그 안에서 제목이 관광지 제목과 같은 것 → 품는 것 → 첫째", () => {
    const gjx1 = place("gjx1");
    // en: 제목이 같은 개요 「Bulguksa Temple」은 음성이 없어, 음성 있는 해설 중 관광지 제목을 품는 첫째
    const en = pickOdiiByTid(
      items(odiiEnBulguksa),
      "2",
      "Bulguksa Temple",
      gjx1,
    );
    expect(en).toMatchObject({
      title: "Entrance (Bulguksa Temple)",
      playTime: 111,
    });
    expect(en?.audioUrl).toMatch(/^https:/);
    // 음성 있는 해설이 없으면 대본만 있는 것에서 같은 기준: 제목이 같은 개요 (실제 항목에서 음성만 뺐다)
    const noAudio = items(odiiEnBulguksa).map((x) => ({ ...x, audioUrl: "" }));
    expect(pickOdiiByTid(noAudio, "2", "Bulguksa Temple", gjx1)?.title).toBe(
      "A kingdom of Buddhism where anyone could become a Buddha",
    );
    // jp: 불국사 해설은 모두 음성이 없고 모두 「仏国寺」를 품는다 → 첫째(입구)
    expect(
      pickOdiiByTid(items(odiiJpBulguksa), "2", "仏国寺", gjx1)?.title,
    ).toBe("仏様の国「仏国寺」");
  });

  it("해설 제목이 관광지 제목과 달라도 좌표 둘레 결과에서 같은 tid를 고른다", () => {
    const gj4 = place("gj4");
    expect(
      pickOdiiByTid(items(odiiEnNearHwangnidan), "1312", "Hwanglidan-gil", gj4),
    ).toMatchObject({ title: "Creating new history for Gyeongju" });
    expect(
      pickOdiiByTid(
        items(odiiJpNearHwangnidan),
        "1312",
        "ファンリダンギル",
        gj4,
      ),
    ).toMatchObject({ title: "ファンニダンギル", playTime: 100 });
    // 도 단위 관광지(2880 「Gyeongsangnam-do」)는 제목이 겹치는 해설이 없어 가까운 첫째
    expect(
      pickOdiiByTid(
        items(odiiEnNearWindyhill),
        "2880",
        "Gyeongsangnam-do",
        place("gz4"),
      )?.title,
    ).toBe("Windy Hill");
  });

  it("다른 tid · 먼 곳 · 한글 해설은 고르지 않는다", () => {
    const gz4 = place("gz4");
    // 「Gyeongsangnam-do」로 찾으면 산청(617)만 온다
    expect(
      pickOdiiByTid(items(odiiEnGyeongnam), "2880", "Gyeongsangnam-do", gz4),
    ).toBeNull();
    expect(
      pickOdiiByTid(items(odiiEnNearWindyhill), "2880", "Gyeongsangnam-do", {
        lat: 37.5,
        lng: 127,
      }),
    ).toBeNull();
    expect(
      pickOdiiByTid(items(odiiKoBulguksa), "2", "불국사", place("gjx1")),
    ).toBeNull();
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

  /**
   * 오디 실제 응답을 오퍼레이션 · 언어 · 검색어(또는 쪽 · 좌표)로 돌려준다. 표에 없으면 실제 빈 응답.
   * 이야기 검색 「story 언어|검색어」, 관광지 목록 「theme 언어|쪽」, 좌표 둘레 「near 언어|경도,위도」
   */
  function stubOdii(table: Record<string, unknown>) {
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        const q = url.searchParams;
        const op = url.pathname.split("/").pop();
        const k =
          op === "themeBasedList"
            ? `theme ${q.get("langCode")}|${q.get("pageNo")}`
            : op === "storyLocationBasedList"
              ? `near ${q.get("langCode")}|${q.get("mapX")},${q.get("mapY")}`
              : `story ${q.get("langCode")}|${q.get("keyword")}`;
        asked.push(k);
        return Response.json(table[k] ?? emptyRes);
      }),
    );
    return asked;
  }
  const REAL = {
    "story ko|불국사": odiiKoBulguksa,
    "story ko|황리단길": odiiKoHwangnidan,
    "story ko|바람의 언덕": odiiKoWindyhill,
    "story ko|첨성대": odiiKoCheomseongdae,
    "story ko|전주한옥마을": odiiKoJeonjuFull,
    "story ko|한옥마을": odiiKoHanok,
    "story ko|정동심곡바다부채길": odiiKoBadabuchae,
    "theme en|1": themeEnP1,
    "theme en|2": themeEnP2,
    "theme jp|1": themeJpP1,
    "theme jp|2": themeJpP2,
    "story en|Bulguksa Temple": odiiEnBulguksa,
    "story jp|仏国寺": odiiJpBulguksa,
    "story en|Gyeongsangnam-do": odiiEnGyeongnam,
    "story en|Jeongdong-simgok Badabuchae-gil Trail": odiiEnBadabuchae,
    "near en|129.20971,35.837533": odiiEnNearHwangnidan,
    "near jp|129.20971,35.837533": odiiJpNearHwangnidan,
    "near en|128.663143,34.744742": odiiEnNearWindyhill,
    "near jp|128.663143,34.744742": odiiJpNearWindyhill,
    // tid를 모를 때(한국어 해설 없음)의 그 언어 이름 검색
    "story en|Bulguksa": odiiEnBulguksa,
    "story jp|昌徳宮": odiiJpChangdeokgung,
    "story en|Cheomseongdae": odiiEnCheomseongdae,
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
    expect(asked).toEqual(["story ko|불국사"]);
  });

  it("한국어 해설은 앞의 도시 이름을 뗀 이름으로도 찾는다 (전주한옥마을 → 한옥마을 「전주 한옥마을」)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    const asked = stubOdii(REAL);
    expect(await (await call("id=nax109&locale=ko")).json()).toMatchObject({
      title: "민족의 자긍심이 낳은 역사",
      source: "odii",
    });
    expect(asked).toEqual(["story ko|전주한옥마을", "story ko|한옥마을"]);
  });

  it("한국어 해설은 공백을 뺀 이름으로도 찾는다 (정동심곡 바다부채길 → 「정동심곡바다부채길」, 음성 파일이 없어 대본만)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    const asked = stubOdii(REAL);
    const body = await (await call("id=nax739&locale=ko")).json();
    expect(body).toMatchObject({
      title: "파도 소리 들으며 해안 절경을 걷는다",
      script: expect.stringContaining("정동심곡바다부채길"),
      source: "odii",
    });
    expect(body.audioUrl).toBeUndefined();
    // 같은 관광지(tid)의 다른 해설이 있으면 others로 붙는다
    for (const other of body.others ?? []) {
      expect(other.source).toBe("odii");
      expect(other.others).toBeUndefined();
    }
    // 도시 이름(강릉)으로 시작하지 않아 도시 이름을 뗀 이름은 없다
    expect(asked).toEqual([
      "story ko|정동심곡 바다부채길",
      "story ko|정동심곡바다부채길",
    ]);
  });

  it("외국어 화면도 그 한국어 해설의 tid(562)로 잇는다 → en 관광지 「Jeongdong-simgok Badabuchae-gil Trail」", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    clearOdiiCache();
    const asked = stubOdii(REAL);
    const body = await (await call("id=nax739&locale=en")).json();
    expect(body).toMatchObject({
      title: "Stroll along this beautiful beach as the waves roll in",
      source: "odii",
    });
    expect(hasHangul(JSON.stringify(body))).toBe(false);
    expect(asked).toEqual([
      "story ko|정동심곡 바다부채길",
      "story ko|정동심곡바다부채길",
      "theme en|1",
      "theme en|2",
      "story en|Jeongdong-simgok Badabuchae-gil Trail",
    ]);
  });

  it("영어 · 중국어 · 스페인어 화면: 한국어 해설의 tid(2) → en 관광지 「Bulguksa Temple」 → 같은 tid 대표 해설(음성 먼저)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    for (const locale of ["en", "zh", "es"]) {
      clearOdiiCache();
      const asked = stubOdii(REAL);
      const body = await (await call(`id=gjx1&locale=${locale}`)).json();
      expect(body).toMatchObject({
        title: "Entrance (Bulguksa Temple)",
        playTime: 111,
      });
      expect(hasHangul(JSON.stringify(body))).toBe(false);
      // en 관광지는 1,356곳이라 1,000개씩 두 쪽
      expect(asked).toEqual([
        "story ko|불국사",
        "theme en|1",
        "theme en|2",
        "story en|Bulguksa Temple",
      ]);
    }
  });

  it("일본어 화면: jp 관광지 「仏国寺」의 해설", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    clearOdiiCache();
    const asked = stubOdii(REAL);
    expect(await (await call("id=gjx1&locale=ja")).json()).toMatchObject({
      title: "仏様の国「仏国寺」",
    });
    expect(asked).toEqual([
      "story ko|불국사",
      "theme jp|1",
      "theme jp|2",
      "story jp|仏国寺",
    ]);
  });

  it("황리단길: 관광지 제목(Hwanglidan-gil)으로는 0건 → 한국어 해설 좌표 둘레에서 같은 tid(1312)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    clearOdiiCache();
    let asked = stubOdii(REAL);
    expect(await (await call("id=gj4&locale=en")).json()).toMatchObject({
      title: "Creating new history for Gyeongju",
    });
    expect(asked.slice(3)).toEqual([
      "story en|Hwanglidan-gil",
      "near en|129.20971,35.837533",
    ]);
    asked = stubOdii(REAL);
    expect(await (await call("id=gj4&locale=ja")).json()).toMatchObject({
      title: "ファンニダンギル",
      playTime: 100,
    });
  });

  it("바람의 언덕: 첫 tid(1139)는 en · jp에 없어 다음 tid(2880, 도 단위 관광지)의 좌표 둘레 해설", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    clearOdiiCache();
    const asked = stubOdii(REAL);
    expect(await (await call("id=gz4&locale=en")).json()).toMatchObject({
      title: "Windy Hill",
      playTime: 69,
    });
    expect(asked.slice(3)).toEqual([
      "story en|Gyeongsangnam-do",
      "near en|128.663143,34.744742",
    ]);
    stubOdii(REAL);
    expect(await (await call("id=gz4&locale=ja")).json()).toMatchObject({
      title: "風の丘",
    });
  });

  it("tid를 알지만 그 언어 관광지 목록에 없으면 숨긴다(그 언어 이름으로 찾지 않는다)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    clearOdiiCache();
    // 첨성대 tid 2967 · 3415는 잘라 낸 목록에 없다
    const asked = stubOdii(REAL);
    expect(await (await call("id=gjx3&locale=en")).json()).toEqual({
      empty: true,
    });
    expect(asked).not.toContain("story en|Cheomseongdae");
  });

  it("한국어 해설이 없어 tid를 모르면 그 언어 이름으로 찾는다(일본어는 공식 명칭 → 영어)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    clearOdiiCache();
    // 창덕궁: 한국어 해설 표에 없어 실제 빈 응답 → 일본어 공식 명칭 「昌徳宮」
    let asked = stubOdii(REAL);
    expect(await (await call("id=kdx1&locale=ja")).json()).toMatchObject({
      title: "北村一景：昌徳宮(チャンドックン)",
    });
    expect(asked).toEqual(["story ko|창덕궁", "story jp|昌徳宮"]);
    // 효우당: 어디에도 없으면 결과 없음
    asked = stubOdii(REAL);
    expect(await (await call("id=gj1&locale=en")).json()).toEqual({
      empty: true,
    });
    expect(asked).toEqual(["story ko|효우당", "story en|Hyowoodang"]);
  });

  it("관광지 목록은 서버 메모리에 두고 한 번만 받는다", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    clearOdiiCache();
    const asked = stubOdii(REAL);
    await call("id=gjx1&locale=en");
    await call("id=gj4&locale=en");
    expect(asked.filter((k) => k.startsWith("theme "))).toEqual([
      "theme en|1",
      "theme en|2",
    ]);
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

  it("외국어 화면에 한글 해설이 오면 고르지 않는다 (en 검색에 한국어 실제 응답을 돌려 본다)", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    clearOdiiCache();
    stubOdii({ ...REAL, "story en|Bulguksa Temple": odiiKoBulguksa });
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

describe("같은 관광지의 다른 해설(others)", () => {
  it("한국어: 불국사 대표(경주 불국사) 뒤에 나머지 9건이 오디 순서로 붙고, 각 항목에는 others가 없다", () => {
    const audio = pickOdii(items(odiiKoBulguksa), at("gjx1", "불국사"));
    expect(audio?.title).toBe("경주 불국사");
    expect(audio?.others?.map((x) => x.title)).toEqual([
      "부처님의 나라를 지키는 천왕문",
      "청운교, 백운교",
      "자연과 인공의 조화 불국사 석축",
      "화려한 보석을 걸친 다보탑",
      "조화로운 비례, 석가탑",
      "석가모니 부처를 모신 대웅전",
      "말이 없는 집, 무설전",
      "관음전을 오르는 낙가교",
      "관음보살님이 있는 관음전",
    ]);
    expect(audio?.others?.every((x) => x.others === undefined)).toBe(true);
    expect(audio?.others?.[0]).toMatchObject({ playTime: 96, source: "odii" });
    expect(audio?.others?.[0].audioUrl).toMatch(/^https:\/\//);
  });

  it("해설이 하나뿐이면 others를 붙이지 않는다", () => {
    const [first] = items(odiiKoBulguksa);
    expect(pickOdii([first], at("gjx1", "불국사"))?.others).toBeUndefined();
  });

  it("외국어 화면: 한글이 섞인 다른 해설은 뺀다, 모두 빠지면 others를 뺀다", () => {
    const en = pickOdii(items(odiiKoBulguksa), at("gjx1", "불국사"))!;
    const mixed = {
      ...en,
      title: "Bulguksa",
      script: "ok",
      others: [
        { ...en.others![0], title: "Gate", script: "fine" },
        { ...en.others![1], title: "청운교", script: "fine" },
      ],
    };
    expect(audioForLocale(mixed, "en")?.others?.map((x) => x.title)).toEqual([
      "Gate",
    ]);
    expect(
      audioForLocale({ ...mixed, others: [mixed.others[1]] }, "en")?.others,
    ).toBeUndefined();
    expect(audioForLocale(mixed, "ko")?.others).toHaveLength(2);
  });

  it("영어 tid 해설도 대표 뒤에 나머지가 붙는다", () => {
    const en = pickOdiiByTid(items(odiiEnBulguksa), "2", "Bulguksa Temple", {
      lat: 35.79,
      lng: 129.332,
    });
    expect(en?.others?.length ?? 0).toBeGreaterThan(0);
    expect(en?.others?.some((x) => x.title === en?.title)).toBe(false);
  });
});
