import { afterEach, describe, expect, it, vi } from "vitest";
import { tourPlace } from "./tour-api";
import {
  crowdName,
  crowdScore,
  findCrowd,
  pickCrowd,
  tourCrowdResponse,
} from "./tour-crowd";

/** 집중률 item (PoC getCrowd가 읽는 필드) */
const row = (tAtsNm: string, baseYmd: string, cnctrRate: string | number) => ({
  baseYmd,
  areaCd: "47",
  signguCd: "47130",
  tAtsNm,
  cnctrRate,
});

describe("이름 점수 (PoC getCrowd score)", () => {
  const me = crowdName("불국사");

  it("같은 이름 3 · 한쪽이 다른 쪽을 품음 2 · 아니면 0 (괄호 · 대괄호 · 공백 · 가운뎃점 무시)", () => {
    expect(crowdScore("불국사", me)).toBe(3);
    expect(crowdScore("[경주] 불국사 (사찰)", me)).toBe(3);
    expect(crowdScore("경주 불국사", me)).toBe(2);
    expect(crowdScore("불국", me)).toBe(2);
    expect(crowdScore("석굴암", me)).toBe(0);
    expect(crowdScore("(없음)", me)).toBe(0);
  });
});

describe("한 곳 고르기 · 날짜순", () => {
  const me = crowdName("불국사");
  const today = "2026-09-29";

  it("이름 점수가 가장 높은 한 곳의 날짜별 집중률을 오늘부터 날짜순으로", () => {
    const items = [
      row("경주 불국사", "20260929", "11"),
      row("불국사", "20261001", "72.5"),
      row("불국사", "20260928", "30"),
      row("불국사", "20260929", 45),
      row("불국사", "20260930", "39"),
    ];
    expect(pickCrowd(items, me, today)).toEqual({
      name: "불국사",
      days: [
        { date: "2026-09-29", rate: 45 },
        { date: "2026-09-30", rate: 39 },
        { date: "2026-10-01", rate: 72.5 },
      ],
    });
  });

  it("같은 날이 여러 번이면 뒤의 값, 숫자가 아니면 뺀다", () => {
    const items = [
      row("불국사", "20260929", "10"),
      row("불국사", "20260929", "20"),
      row("불국사", "20260930", ""),
      row("불국사", "2026-10-01", "x"),
    ];
    expect(pickCrowd(items, me, today)?.days).toEqual([
      { date: "2026-09-29", rate: 20 },
    ]);
  });

  it("이름이 맞는 곳이 없으면 null", () => {
    expect(pickCrowd([row("석굴암", "20260929", "10")], me, today)).toBeNull();
    expect(pickCrowd([], me, today)).toBeNull();
  });
});

/** 공공데이터포털 JSON 응답 */
const ok = (items: unknown[]) =>
  new Response(
    JSON.stringify({
      response: {
        header: { resultCode: "0000", resultMsg: "OK" },
        body: { items: items.length ? { item: items } : "" },
      },
    }),
  );

describe("집중률 찾기 (PoC getCrowd)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const now = new Date("2026-09-29T03:00:00Z");

  it("이름으로 찾고, 없고 이름이 3글자보다 길면 정규화한 앞 3글자로 다시 찾는다", async () => {
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        const name = url.searchParams.get("tAtsNm")!;
        asked.push(name);
        return name === "동궁과"
          ? ok([row("동궁과 월지", "20260929", "55")])
          : ok([]);
      }),
    );
    const place = tourPlace("gj3")!;
    const crowd = await findCrowd(place, "KEY", now);
    expect(asked).toEqual(["동궁과 월지", "동궁과"]);
    expect(crowd).toEqual({
      name: "동궁과 월지",
      days: [{ date: "2026-09-29", rate: 55 }],
    });
  });

  it("주소: 관광지 집중률 목록, 시군구 코드 앞 2자리가 areaCd", async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        urls.push(new URL(input));
        return ok([]);
      }),
    );
    const place = tourPlace("gjx1")!;
    expect(await findCrowd(place, "KEY", now)).toBeNull();
    // 「불국사」는 3글자라 다시 찾지 않는다
    expect(urls).toHaveLength(1);
    expect(urls[0].origin + urls[0].pathname).toBe(
      "https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList",
    );
    expect(urls[0].searchParams.get("tAtsNm")).toBe("불국사");
    expect(urls[0].searchParams.get("signguCd")).toBe(place.signgu);
    expect(urls[0].searchParams.get("areaCd")).toBe(place.signgu.slice(0, 2));
  });
});

describe("GET /api/tour/crowd", () => {
  afterEach(() => {
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

  it("외부 실패는 502, 응답에 키가 없다", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("error", { status: 500 })),
    );
    const res = await call("id=gjx1");
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("SECRET-KEY");
  });

  it("이름이 맞는 곳이 없으면 결과 없음, 있으면 { name, days }", async () => {
    vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok([row("석굴암", "20990101", "10")])),
    );
    expect(await (await call("id=gjx1")).json()).toEqual({ empty: true });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ok([row("불국사", "20990102", "80"), row("불국사", "20990101", "20")]),
      ),
    );
    const res = await call("id=gjx1");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=21600");
    expect(await res.json()).toEqual({
      name: "불국사",
      days: [
        { date: "2099-01-01", rate: 20 },
        { date: "2099-01-02", rate: 80 },
      ],
    });
  });
});
