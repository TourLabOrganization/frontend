import { describe, expect, it } from "vitest";
import {
  airportLeadMin,
  airportProcessUrl,
  toAirportProcess,
} from "./airport-process";

const item = (apt: string, all: number, at = "2026-09-29 14:05") => ({
  IATA_APCD: apt,
  STY_TCT_AVG_ALL: String(all),
  STY_TCT_AVG_A: "300",
  STY_TCT_AVG_B: "450",
  STY_TCT_AVG_C: "600",
  STY_TCT_AVG_D: "",
  PRC_HR: at,
  OPR_STS_CD: "1",
});

describe("toAirportProcess (PoC getAirportProcess)", () => {
  it("초 → 분(반올림), 공항 IATA별", () => {
    const got = toAirportProcess({
      response: {
        header: { resultCode: "00" },
        body: { items: { item: [item("GMP", 1530), item("CJU", 1199)] } },
      },
    });
    expect(got).toEqual({
      GMP: { all: 26, a: 5, b: 8, c: 10, d: 0, at: "2026-09-29 14:05" },
      CJU: { all: 20, a: 5, b: 8, c: 10, d: 0, at: "2026-09-29 14:05" },
    });
  });

  it("item이 하나면 객체로 온다. 제공 공항(김포 · 제주 · 김해 · 청주 · 대구) 밖은 뺀다", () => {
    expect(
      toAirportProcess({
        response: { body: { items: { item: item("PUS", 600) } } },
      }),
    ).toEqual({
      PUS: { all: 10, a: 5, b: 8, c: 10, d: 0, at: "2026-09-29 14:05" },
    });
    expect(
      toAirportProcess({
        response: { body: { items: { item: item("ICN", 600) } } },
      }),
    ).toBeNull();
  });

  it("resultCode 오류 · 모양이 다르면 null", () => {
    expect(
      toAirportProcess({ response: { header: { resultCode: "30" } } }),
    ).toBeNull();
    expect(toAirportProcess({ response: { body: { items: "" } } })).toBeNull();
    expect(toAirportProcess("<xml/>")).toBeNull();
  });
});

describe("탑승까지 잡을 시간 (PoC aptLeadMin)", () => {
  it("수속 + 20분, 최소 30분", () => {
    expect(airportLeadMin({ all: 26 })).toBe(46);
    expect(airportLeadMin({ all: 5 })).toBe(30);
  });
  it("주소는 고정 호스트 · type=json", () => {
    const url = new URL(airportProcessUrl("KEY"));
    expect(url.origin + url.pathname).toBe(
      "https://apis.data.go.kr/B551178/airport-process-time/v1",
    );
    expect(url.searchParams.get("type")).toBe("json");
  });
});
