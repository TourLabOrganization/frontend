import { describe, expect, it } from "vitest";
import {
  AIRLINE_LINKS,
  airlineShares,
  BUSAN_AIRPORTS,
  busanSummary,
  flightCount,
  JEJU_AIRPORTS,
  jejuAirportFor,
  jejuSummary,
  showBusanFlights,
  showJejuFlights,
} from "./flights";
import { PLANNER_ORIGINS } from "./regions";

describe("보이는 조건 (PoC flightBoardShow · busanAirShow)", () => {
  it("제주 카드: 제주 여행 · 항공 · 자가용 아님", () => {
    expect(showJejuFlights({ island: "jeju", own: false, choice: "air" })).toBe(
      true,
    );
    expect(
      showJejuFlights({ island: "jeju", own: false, choice: "ship" }),
    ).toBe(false);
    expect(showJejuFlights({ island: "jeju", own: true, choice: "air" })).toBe(
      false,
    );
    expect(
      showJejuFlights({ island: "ulleung", own: false, choice: "air" }),
    ).toBe(false);
    expect(showJejuFlights({ island: null, own: false, choice: "air" })).toBe(
      false,
    );
  });
  it("김해 카드: 첫 도시가 부산 · 김해 · 양산 · 창원 · 거제 · 항공 · 자가용 아님", () => {
    for (const d of ["부산", "김해", "양산", "창원", "거제"])
      expect(
        showBusanFlights({ destination: d, own: false, choice: "air" }),
      ).toBe(true);
    expect(
      showBusanFlights({ destination: "울산", own: false, choice: "air" }),
    ).toBe(false);
    expect(
      showBusanFlights({ destination: "부산", own: false, choice: "rail" }),
    ).toBe(false);
    expect(
      showBusanFlights({ destination: "부산", own: true, choice: "air" }),
    ).toBe(false);
    expect(
      showBusanFlights({ destination: null, own: false, choice: "air" }),
    ).toBe(false);
  });
});

describe("편성 자료 (scripts/build-flights.mjs, PoC 하드코딩 값)", () => {
  it("제주 노선 10개 공항 · 김해 3개 노선 · 시간표 링크 10개", () => {
    expect(JEJU_AIRPORTS.map((a) => a.code)).toEqual([
      "GMP",
      "ICN",
      "PUS",
      "CJJ",
      "TAE",
      "KWJ",
      "RSU",
      "USN",
      "KUV",
      "WJU",
    ]);
    expect(BUSAN_AIRPORTS.map((a) => a.code)).toEqual(["CJU", "YNY", "GMP"]);
    expect(AIRLINE_LINKS).toHaveLength(10);
    for (const a of AIRLINE_LINKS) expect(a.url).toMatch(/^https:\/\//);
  });
});

describe("flightCount", () => {
  it("「a~b편」 · 「편도 90~100편」 · 「주 2~3편」 · 한 숫자", () => {
    expect(flightCount("18~22편")).toEqual({ lo: 18, hi: 22, weekly: false });
    expect(flightCount("편도 90~100편")).toEqual({
      lo: 90,
      hi: 100,
      weekly: false,
    });
    expect(flightCount("주 2~3편(운항 시)")).toEqual({
      lo: 2,
      hi: 3,
      weekly: true,
    });
    expect(flightCount("1회")).toEqual({ lo: 1, hi: 1, weekly: false });
    expect(flightCount("—")).toBeNull();
  });
});

describe("요약 표 (PoC flightSched)", () => {
  it("항공사표가 있는 노선(김포 → 제주)은 합계 · 첫 · 막 편을 표에서 다시 계산한다", () => {
    const s = jejuSummary("GMP", true)!;
    expect(s.fromTable).toBe(true);
    expect(s.airlines).toHaveLength(8);
    expect(s.airlines.slice(0, 3)).toEqual([
      "대한항공",
      "아시아나항공",
      "제주항공",
    ]);
    // 18+10+10+9+8+6+5+4 = 70, 22+14+14+12+11+8+8+6 = 95
    expect(s.count).toEqual({ lo: 70, hi: 95, weekly: false });
    expect([s.first, s.last, s.minutes]).toEqual(["06:00", "21:20", 65]);
  });

  it("항공사표가 없는 노선(인천 → 제주)은 PoC 요약 그대로, 영어면 항공사 이름을 바꾼다", () => {
    const s = jejuSummary("ICN", true)!;
    expect(s.fromTable).toBe(false);
    expect(s.airlines).toEqual([
      "대한항공",
      "아시아나",
      "제주항공",
      "진에어",
      "티웨이",
    ]);
    expect(s.count).toEqual({ lo: 15, hi: 20, weekly: false });
    expect(jejuSummary("ICN", false)!.airlines).toEqual([
      "Korean Air",
      "Asiana",
      "Jeju Air",
      "Jin Air",
      "T'way",
    ]);
  });

  it("김해: 김포 노선은 정기 운항 없음, 양양은 부정기 · 주 단위", () => {
    const gmp = busanSummary("GMP", true)!;
    expect(gmp.special).toBe("noRegular");
    expect([gmp.count, gmp.first, gmp.minutes]).toEqual([null, null, null]);
    const yny = busanSummary("YNY", false)!;
    expect(yny.special).toBe("irregular");
    expect(yny.count).toEqual({ lo: 2, hi: 3, weekly: true });
    // 김해 → 제주는 제주 카드의 김해 출발과 같은 값이다
    expect(busanSummary("CJU", true)).toEqual(jejuSummary("PUS", true));
    expect(jejuSummary("XXX", true)).toBeNull();
  });
});

describe("항공사별 운항 개요 (PoC airlineRows)", () => {
  it("편수 범위의 가운데 값으로 비중, 많은 순", () => {
    const rows = airlineShares("PUS-CJU", true);
    expect(rows.map((r) => r.name)).toEqual([
      "에어부산",
      "대한항공",
      "제주항공",
      "진에어",
      "티웨이항공",
    ]);
    // 가운데 값 8 · 6 · 5 · 4 · 3, 합 26
    expect(rows.map((r) => r.share)).toEqual([31, 23, 19, 15, 12]);
    expect(rows[0].window).toBe("07:10–21:00");
    expect(airlineShares("ICN-CJU", true)).toEqual([]);
  });
});

describe("처음 고를 제주 노선 공항 (출발지)", () => {
  it("출발지가 공항이면 그 공항, 아니면 김포", () => {
    const airportKey = (re: RegExp) =>
      Object.keys(PLANNER_ORIGINS).find(
        (k) =>
          re.test(PLANNER_ORIGINS[k].ko) && /공항/.test(PLANNER_ORIGINS[k].ko),
      );
    const gimhae = airportKey(/김해/);
    const cheongju = airportKey(/청주/);
    if (gimhae) expect(jejuAirportFor(gimhae)).toBe("PUS");
    if (cheongju) expect(jejuAirportFor(cheongju)).toBe("CJJ");
    expect(jejuAirportFor("seoul")).toBe("GMP");
    expect(jejuAirportFor(null)).toBe("GMP");
    expect(jejuAirportFor("no-such-origin")).toBe("GMP");
  });
});
