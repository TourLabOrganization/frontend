import { describe, expect, it } from "vitest";
import { isPlannerCity } from "../features/planner/regions";
import { POPULAR_CITIES } from "./tour";
import {
  citySigngu,
  isPopularCity,
  matchPlace,
  POPULAR_MAX_DISTRICTS,
  rankSpots,
} from "./tour-popular";

const row = (name: string, date: string, rate: number, signgu = "47130") => ({
  tAtsNm: name,
  baseYmd: date.replace(/-/g, ""),
  cnctrRate: String(rate),
  signguCd: signgu,
  signguNm: "경주시",
});

describe("도시 · 시군구", () => {
  it("홈 칩 도시는 모두 플래너 도시다(장소가 있다)", () => {
    for (const c of POPULAR_CITIES) {
      expect(isPlannerCity(c), c).toBe(true);
      expect(isPopularCity(c)).toBe(true);
    }
    expect(isPopularCity("평양")).toBe(false);
  });

  it("도시마다 장소가 많은 시군구 최대 4곳(5곳 이상)", () => {
    for (const c of POPULAR_CITIES) {
      const codes = citySigngu(c);
      expect(codes.length, c).toBeGreaterThan(0);
      expect(codes.length).toBeLessThanOrEqual(POPULAR_MAX_DISTRICTS);
      for (const code of codes) expect(code).toMatch(/^\d{5}$/);
    }
    expect(citySigngu("경주")).toEqual(["47130"]);
    // 서울: 종로 · 송파 · 영등포 · 용산(장소가 여러 구에 퍼져 있어도 4곳을 부른다)
    expect(citySigngu("서울")).toEqual(["11110", "11710", "11560", "11170"]);
    expect(citySigngu("제주")).toEqual(["50110", "50130"]);
    expect(citySigngu("없는도시")).toEqual([]);
  });

  it("합성 자료: 장소 5곳 미만 시군구는 빼고, 숙박은 세지 않는다", () => {
    const spots = (prefix: string, n: number, cat = "herit") =>
      Array.from({ length: n }, (_, i) => ({
        id: `${prefix}${i}`,
        locKo: "X",
        cat,
      }));
    const places = [
      ...spots("a", 9),
      ...spots("b", 5),
      ...spots("c", 4),
      ...spots("d", 6, "stay"),
    ] as never[];
    const codes: Record<string, string> = {
      a: "11110",
      b: "11140",
      c: "11170",
      d: "11200",
    };
    expect(citySigngu("X", places, (id) => codes[id[0]] ?? "")).toEqual([
      "11110",
      "11140",
    ]);
  });
});

describe("rankSpots", () => {
  it("오늘 집중률 높은 순, 같은 값이면 이름 순, 오늘 이전은 뺀다", () => {
    const got = rankSpots(
      [
        row("불국사", "2026-09-29", 80),
        row("첨성대", "2026-09-29", 91.5),
        row("대릉원", "2026-09-29", 80),
        row("불국사", "2026-09-30", 10),
        row("석굴암", "2026-09-28", 99),
      ],
      "2026-09-29",
    );
    expect(got?.date).toBe("2026-09-29");
    expect(got?.spots.map((s) => [s.name, s.rate])).toEqual([
      ["첨성대", 91.5],
      ["대릉원", 80],
      ["불국사", 80],
    ]);
  });

  it("오늘 값이 없으면 오늘 이후 가장 이른 날, 아무것도 없으면 null", () => {
    expect(
      rankSpots(
        [row("불국사", "2026-10-01", 50), row("첨성대", "2026-09-30", 40)],
        "2026-09-29",
      )?.date,
    ).toBe("2026-09-30");
    expect(
      rankSpots([row("불국사", "2026-09-01", 50)], "2026-09-29"),
    ).toBeNull();
    expect(
      rankSpots(
        [{ tAtsNm: "x", baseYmd: "2026", cnctrRate: "a" }],
        "2026-09-29",
      ),
    ).toBeNull();
  });

  it("같은 시군구 · 같은 이름이 여러 번이면 뒤의 값, 시군구가 다르면 따로", () => {
    const got = rankSpots(
      [
        row("해변", "2026-09-29", 30, "26350"),
        row("해변", "2026-09-29", 60, "26350"),
        row("해변", "2026-09-29", 50, "26500"),
      ],
      "2026-09-29",
    );
    expect(got?.spots.map((s) => [s.signgu, s.rate])).toEqual([
      ["26350", 60],
      ["26500", 50],
    ]);
  });
});

describe("matchPlace", () => {
  it("같은 도시 · 같은 시군구에서 이름이 맞는 플래너 장소", () => {
    const places = [
      { id: "p1", ko: "불국사", locKo: "경주", cat: "herit" },
      { id: "p2", ko: "경주 대릉원", locKo: "경주", cat: "herit" },
      { id: "p3", ko: "불국사", locKo: "부산", cat: "herit" },
    ] as never[];
    const sg = () => "47130";
    expect(
      matchPlace({ name: "불국사", signgu: "47130" }, "경주", places, sg)?.id,
    ).toBe("p1");
    expect(
      matchPlace({ name: "대릉원", signgu: "47130" }, "경주", places, sg)?.id,
    ).toBe("p2");
    expect(
      matchPlace({ name: "석굴암", signgu: "47130" }, "경주", places, sg),
    ).toBeNull();
    expect(
      matchPlace({ name: "불국사", signgu: "11110" }, "경주", places, sg),
    ).toBeNull();
  });
});
