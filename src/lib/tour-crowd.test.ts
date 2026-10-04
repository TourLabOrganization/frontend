import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crowdBulguksa from "./fixtures/tour/crowd-bulguksa.json";
import crowdDonggung from "./fixtures/tour/crowd-donggung.json";
import crowdHanok from "./fixtures/tour/crowd-hanok.json";
import crowdJeonjuhan from "./fixtures/tour/crowd-jeonjuhan.json";
import emptyRes from "./fixtures/tour/empty.json";
import invalidKey from "./fixtures/tour/invalid-key.json";
import { parseTourItems, tourPlace } from "./tour-api";
import {
  crowdName,
  crowdScore,
  findCrowd,
  pickCrowd,
  tourCrowdResponse,
} from "./tour-crowd";

// 관광지 집중률 방문자 추이 예측(TatsCnctrRateService) 실제 응답(2026-09-29 받음, fixtures/tour, 키는 지웠다):
//   crowd-bulguksa  tAtsNm=불국사 areaCd=47 signguCd=47130 → 「경주 불국사 [유네스코 세계유산]」 30일(2026-09-29 ~ 10-28), 집중률은 소수 글자
//   crowd-donggung  tAtsNm=동궁과 → 「경주 동궁과 월지」 30일(「동궁과 월지」로 찾아도 같은 30일)
//   crowd-jeonjuhan tAtsNm=전주한 → 「전주한벽문화관」(30일 중 3일만 남겼다), crowd-hanok tAtsNm=한옥마을 → 「전북 전주 한옥마을 [슬로시티]」 30일
//   empty           결과 없음(집중률 「효우당」 · 「전주한옥마을」 · 「정동심곡 바다부채길」 · 「정동심」 · 「정동심곡바다부채길」)
const items = (body: unknown) => parseTourItems(body) ?? [];

describe("이름 점수 (PoC getCrowd score)", () => {
  const me = crowdName("불국사");

  it("같은 이름 3 · 한쪽이 다른 쪽을 품음 2 · 아니면 0 (대괄호 · 괄호 · 공백 · 가운뎃점 무시)", () => {
    expect(crowdScore("불국사", me)).toBe(3);
    expect(crowdScore("경주 불국사 [유네스코 세계유산]", me)).toBe(2);
    expect(crowdScore("불국", me)).toBe(2);
    expect(crowdScore("경주 동궁과 월지", me)).toBe(0);
    expect(crowdScore("[없음]", me)).toBe(0);
  });
});

describe("한 곳 고르기 · 날짜순 — 불국사 실제 응답", () => {
  const me = crowdName("불국사");

  it("이름 점수로 한 곳, 오늘부터 날짜순(YYYYMMDD → YYYY-MM-DD, 집중률은 숫자로)", () => {
    const crowd = pickCrowd(items(crowdBulguksa), me, "2026-09-29");
    expect(crowd?.name).toBe("경주 불국사 [유네스코 세계유산]");
    expect(crowd?.days).toHaveLength(30);
    expect(crowd?.days.slice(0, 3)).toEqual([
      { date: "2026-09-29", rate: 41.2 },
      { date: "2026-09-30", rate: 46.66 },
      { date: "2026-10-01", rate: 70.63 },
    ]);
    expect(crowd?.days.at(-1)).toEqual({ date: "2026-10-28", rate: 47.05 });
  });

  it("오늘 전 날짜는 버린다, 순서가 섞여 와도 날짜순", () => {
    const shuffled = [...items(crowdBulguksa)].reverse();
    const crowd = pickCrowd(shuffled, me, "2026-10-20");
    expect(crowd?.days.map((d) => d.date)).toEqual([
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
    ]);
  });

  it("이름이 맞는 곳이 없으면 null", () => {
    expect(pickCrowd(items(crowdDonggung), me, "2026-09-29")).toBeNull();
    expect(pickCrowd(items(emptyRes), me, "2026-09-29")).toBeNull();
  });
});

/** 집중률 실제 응답을 관광지 이름(tAtsNm)으로 돌려준다. 표에 없으면 실제 빈 응답 */
function stubCrowd(table: Record<string, unknown>) {
  const asked: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input);
      asked.push(url);
      return Response.json(
        table[url.searchParams.get("tAtsNm") ?? ""] ?? emptyRes,
      );
    }),
  );
  return asked;
}

describe("집중률 찾기 (PoC getCrowd)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const now = new Date("2026-09-29T03:00:00Z");

  it("주소: 관광지 집중률 목록, 시군구 코드 앞 2자리가 areaCd, 이름 부분일치", async () => {
    const asked = stubCrowd({ 불국사: crowdBulguksa });
    const crowd = await findCrowd(tourPlace("gjx1")!, "KEY", now);
    expect(crowd?.days).toHaveLength(30);
    // 「불국사」는 3글자라 다시 찾지 않는다
    expect(asked).toHaveLength(1);
    expect(asked[0].origin + asked[0].pathname).toBe(
      "https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList",
    );
    expect(asked[0].searchParams.get("tAtsNm")).toBe("불국사");
    expect(asked[0].searchParams.get("signguCd")).toBe("47130");
    expect(asked[0].searchParams.get("areaCd")).toBe("47");
    expect(asked[0].searchParams.get("numOfRows")).toBe("100");
  });

  it("이름으로 없고 이름이 3글자보다 길면 정규화한 앞 3글자로 다시 찾는다 (첫 검색에 실제 빈 응답을 돌려 본다)", async () => {
    const asked = stubCrowd({ 동궁과: crowdDonggung });
    const crowd = await findCrowd(tourPlace("gj3")!, "KEY", now);
    expect(asked.map((u) => u.searchParams.get("tAtsNm"))).toEqual([
      "동궁과 월지",
      "동궁과",
    ]);
    expect(crowd?.name).toBe("경주 동궁과 월지");
    expect(crowd?.days[0]).toEqual({ date: "2026-09-29", rate: 59.59 });
  });

  it("앞 후보에서 한 곳을 고르지 못하면 앞의 도시 이름을 뗀 이름으로 (전주한옥마을 → 한옥마을)", async () => {
    const asked = stubCrowd({ 전주한: crowdJeonjuhan, 한옥마을: crowdHanok });
    const crowd = await findCrowd(tourPlace("nax109")!, "KEY", now);
    // 「전주한옥마을」 0건(새 코드 52 · 옛 코드 45 모두) → 「전주한」은 전주한벽문화관뿐(이름 점수 0) → 「한옥마을」
    const names = asked.map((u) => u.searchParams.get("tAtsNm"));
    expect([...new Set(names)]).toEqual(["전주한옥마을", "전주한", "한옥마을"]);
    // 새 코드로 없으면 옛 코드(전북 45)로 한 번 더 부른다
    expect(
      asked.slice(0, 2).map((u) => u.searchParams.get("signguCd")),
    ).toEqual(["52111", "45111"]);
    expect(crowd?.name).toBe("전북 전주 한옥마을 [슬로시티]");
    expect(crowd?.days).toHaveLength(30);
  });

  it("이름에 공백이 있으면 마지막에 공백을 뺀 이름으로 (정동심곡 바다부채길: 셋 다 실제 0건)", async () => {
    const asked = stubCrowd({});
    expect(await findCrowd(tourPlace("nax739")!, "KEY", now)).toBeNull();
    expect([
      ...new Set(asked.map((u) => u.searchParams.get("tAtsNm"))),
    ]).toEqual(["정동심곡 바다부채길", "정동심", "정동심곡바다부채길"]);
  });

  it("다른 시군구 행은 쓰지 않는다(서비스가 시군구 조건을 무시하고 전국 결과를 줄 때)", async () => {
    const row = (name: string, signgu: string) => ({
      tAtsNm: name,
      baseYmd: "20260929",
      cnctrRate: "50",
      signguCd: signgu,
    });
    const body = (item: unknown[]) => ({
      response: {
        header: { resultCode: "0000" },
        body: { items: { item }, totalCount: item.length },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(body([row("불국사", "11110"), row("불국사", "50110")])),
      ),
    );
    // 경주(47130) 불국사: 같은 이름이지만 다른 시군구 행뿐이라 없음
    expect(await findCrowd(tourPlace("gjx1")!, "KEY", now)).toBeNull();
  });

  it("집중률이 없는 장소는 null (효우당: 실제 0건)", async () => {
    stubCrowd({});
    expect(await findCrowd(tourPlace("gj1")!, "KEY", now)).toBeNull();
  });
});

describe("GET /api/tour/crowd", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T03:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const call = (qs: string) =>
    tourCrowdResponse(new Request(`http://localhost/api/tour/crowd?${qs}`));

  it("키가 없으면 503", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "");
    const res = await call("id=gjx1");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ message: "not configured" });
  });

  it("id가 없으면 400, 모르는 장소는 404", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    expect((await call("")).status).toBe(400);
    expect((await call("id=nope")).status).toBe(404);
  });

  it("외부 실패는 502(등록되지 않은 키의 실제 응답), 응답에 키가 없다", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(invalidKey, { status: 403 })),
    );
    const res = await call("id=gjx1");
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("SECRET-KEY");
  });

  it("결과 { name, days }(6시간 캐시), 결과가 없으면 결과 없음", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    stubCrowd({ 불국사: crowdBulguksa });
    const res = await call("id=gjx1");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=600, s-maxage=21600",
    );
    const body = (await res.json()) as { name: string; days: unknown[] };
    expect(body.name).toBe("경주 불국사 [유네스코 세계유산]");
    expect(body.days).toHaveLength(30);
    expect(await (await call("id=gj1")).json()).toEqual({ empty: true });
  });
});
