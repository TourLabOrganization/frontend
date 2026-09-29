import { describe, expect, it } from "vitest";
import { hasBadge, parseZone, zoneLabel } from "./badges";

const base = { un: false, k100: false, bf: false };

describe("배지", () => {
  it("데이터랩 인기는 순위가 있을 때, 관광특구 · 관광단지는 지정구역 문구가 있을 때", () => {
    expect(hasBadge({ ...base, popRank: 1 }, "pop")).toBe(true);
    expect(hasBadge(base, "pop")).toBe(false);
    expect(hasBadge({ ...base, vz: "제주시 관광지 (2008 지정)" }, "zone")).toBe(
      true,
    );
    expect(hasBadge(base, "zone")).toBe(false);
  });

  it("지정구역 문구 → 종류 · 연도. 연도 0000은 모른다(null)", () => {
    expect(parseZone("경주시 관광단지 (2008 지정)")).toEqual({
      kind: "관광단지",
      year: "2008",
    });
    expect(parseZone("유성구 관광특구 (0000 지정)")).toEqual({
      kind: "관광특구",
      year: null,
    });
    // 시군 이름에 빈칸이 있어도 된다
    expect(parseZone("포항시 남구 관광지 (0000 지정)")).toEqual({
      kind: "관광지",
      year: null,
    });
    expect(parseZone("알 수 없는 문구")).toBeNull();
  });

  it("장소 배지 문구: 종류와 연도, 외국어는 kr-units 치환", () => {
    expect(zoneLabel("경주시 관광단지 (2008 지정)", "ko")).toBe(
      "관광단지 (2008 지정)",
    );
    expect(zoneLabel("유성구 관광특구 (0000 지정)", "ko")).toBe("관광특구");
    expect(zoneLabel("경주시 관광단지 (2008 지정)", "en")).toBe(
      "Tourist Complex (designated 2008)",
    );
    expect(zoneLabel("유성구 관광특구 (0000 지정)", "en")).toBe(
      "Special Tourist Zone",
    );
    expect(zoneLabel("제주시 관광지 (2013 지정)", "zh")).toBe(
      "指定景区 (2013年指定)",
    );
    expect(zoneLabel("제주시 관광지 (2013 지정)", "ja")).toBe(
      "指定観光地 (2013年指定)",
    );
    expect(zoneLabel("수원시 관광특구 (2016 지정)", "es")).toBe(
      "Zona turística especial (designado en 2016)",
    );
  });
});
