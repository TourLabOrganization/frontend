import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FESTIVAL_LIMIT,
  festivalDistricts,
  festivalUrl,
  festivalYmd,
  parseFestivals,
  tourFestivalResponse,
} from "./tour-festival";

const row = (
  id: string,
  title: string,
  start: string,
  end: string,
  extra: Record<string, unknown> = {},
) => ({
  contentid: id,
  title,
  eventstartdate: start,
  eventenddate: end,
  addr1: "경상북도 경주시 어딘가 1",
  mapx: "129.21",
  mapy: "35.84",
  ...extra,
});
const body = (item: unknown[]) => ({
  response: {
    header: { resultCode: "0000", resultMsg: "OK" },
    body: { items: item.length ? { item } : "", totalCount: item.length },
  },
});

describe("축제 · 행사 (parseFestivals)", () => {
  it("끝난 것 · 날짜 없는 것은 빼고, 진행 중(종료일 순) → 예정(시작일 순), 같은 contentid는 한 번, 최대 20건", () => {
    const today = "2026-10-03";
    const got = parseFestivals(
      [
        row("1", "예정 B", "20261020", "20261022"),
        row("2", "끝난 것", "20260901", "20261002"),
        row("3", "진행 중 늦게 끝남", "20261001", "20261031"),
        row("4", "진행 중 곧 끝남", "20260925", "20261005", {
          firstimage: "http://tong.visitkorea.or.kr/a.jpg",
          tel: "054-779-6000",
          addr2: "(동부동)",
        }),
        row("5", "예정 A", "20261010", "20261012"),
        row("4", "중복", "20260925", "20261005"),
        { contentid: "6", title: "날짜 없음" },
        row("7", "오늘 시작", "20261003", "20261003", { mapx: "", mapy: "" }),
      ],
      today,
    );
    expect(got.map((x) => [x.id, x.ongoing])).toEqual([
      ["7", true],
      ["4", true],
      ["3", true],
      ["5", false],
      ["1", false],
    ]);
    expect(got[1]).toMatchObject({
      title: "진행 중 곧 끝남",
      start: "2026-09-25",
      end: "2026-10-05",
      addr: "경상북도 경주시 어딘가 1 (동부동)",
      image: "https://tong.visitkorea.or.kr/a.jpg",
      tel: "054-779-6000",
      lat: 35.84,
      lng: 129.21,
    });
    expect(got[0]).not.toHaveProperty("lat");
    const many = parseFestivals(
      Array.from({ length: 30 }, (_, i) =>
        row(String(100 + i), `f${i}`, "20261101", "20261102"),
      ),
      today,
    );
    expect(many).toHaveLength(FESTIVAL_LIMIT);
  });

  it("날짜 · 주소 · 시군구", () => {
    expect(festivalYmd("20261003")).toBe("2026-10-03");
    expect(festivalYmd("2026-10")).toBeNull();
    const url = new URL(festivalUrl("K", "ja", "47130", "20261001"));
    expect(url.pathname).toContain("JpnService2/searchFestival2");
    expect(url.searchParams.get("lDongRegnCd")).toBe("47");
    expect(url.searchParams.get("lDongSignguCd")).toBe("130");
    expect(url.searchParams.get("eventStartDate")).toBe("20261001");
    expect(
      new URL(festivalUrl("K", "ko", "11110", "20261001")).pathname,
    ).toContain("KorService2/searchFestival2");
    expect(festivalDistricts("경주")).toContain("47130");
    expect(festivalDistricts("없는도시")).toEqual([]);
  });
});

describe("GET /api/tour/festival", () => {
  beforeEach(() => vi.stubEnv("DATA_GO_KR_KEY", "SECRET-KEY"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const req = (qs: string) => new Request(`http://x/api/tour/festival?${qs}`);

  it("모르는 도시 · 언어는 400, 키가 없으면 503", async () => {
    expect((await tourFestivalResponse(req("city=화성시"))).status).toBe(400);
    expect(
      (await tourFestivalResponse(req("city=경주&locale=fr"))).status,
    ).toBe(400);
    vi.stubEnv("DATA_GO_KR_KEY", "");
    expect((await tourFestivalResponse(req("city=경주"))).status).toBe(503);
  });

  it("시군구마다 이달 1일부터 받아 합치고 6시간 캐시로 보낸다. 결과가 없으면 empty", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        calls.push(url.searchParams.get("lDongSignguCd") ?? "");
        return Response.json(
          body(
            url.searchParams.get("lDongSignguCd") === "130"
              ? [row("1", "경주 축제", "20261001", "20261031")]
              : [],
          ),
        );
      }),
    );
    const now = new Date("2026-10-03T03:00:00Z");
    const res = await tourFestivalResponse(req("city=경주&locale=en"), now);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=600, s-maxage=21600",
    );
    const got = (await res.json()) as { city: string; items: unknown[] };
    expect(got.city).toBe("경주");
    expect(got.items).toHaveLength(1);
    expect(calls.length).toBeGreaterThan(0);
    const first = new URL(
      String(
        (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0],
      ),
    );
    expect(first.pathname).toContain("EngService2/searchFestival2");
    expect(first.searchParams.get("eventStartDate")).toBe("20261001");
    expect(String(first)).not.toContain("SECRET-KEY".toLowerCase());

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body([]))),
    );
    const empty = await tourFestivalResponse(req("city=경주"), now);
    expect(await empty.json()).toEqual({ empty: true });
  });
});
