import { describe, expect, it } from "vitest";
import { cityName, CITY_INFO, regionName, REGIONS } from "../planner/regions";
import { placeName } from "../theme/place-meta";
import es from "./data/es.json";
import ja from "./data/ja.json";
import zh from "./data/zh.json";
import { loadNameTable } from "./server";

describe("언어별 이름표 (features/names)", () => {
  const place = { id: "gj1", ko: "효우당", en: "Hyowoodang" };

  it("중 · 일은 공식 명칭, 없으면 영어 → 한국어로 떨어진다", () => {
    expect(placeName(place, "zh", zh)).toBe(zh.places.gj1);
    expect(placeName(place, "ja", ja)).toBe(ja.places.gj1);
    expect(placeName({ ...place, id: "없는-id" }, "zh", zh)).toBe("Hyowoodang");
    expect(placeName({ id: "x", ko: "효우당", en: "" }, "ja", ja)).toBe(
      "효우당",
    );
    expect(placeName(place, "es", es)).toBe("Hyowoodang");
    expect(placeName(place, "ko", zh)).toBe("효우당");
  });

  it("권역 · 도시는 PoC 표기(REG · CITY_NAME), 없으면 영어", () => {
    const capital = REGIONS.find((r) => r.key === "capital")!;
    expect(regionName(capital, "zh", zh)).toBe("首都圈");
    expect(regionName(capital, "es", es)).toBe("Área Metropolitana de Seúl");
    expect(cityName("서울", "ja", ja)).toBe("ソウル");
    const noZh = Object.keys(CITY_INFO).find((c) => !(c in zh.cities));
    if (noZh) expect(cityName(noZh, "zh", zh)).toBe(CITY_INFO[noZh].en || noZh);
  });

  it("권역 7개가 세 언어 모두 있다", () => {
    for (const table of [zh, ja, es])
      expect(Object.keys(table.regions).sort()).toEqual(
        REGIONS.map((r) => r.key).sort(),
      );
  });

  it("한국어 · 영어 화면은 이름표를 싣지 않는다", async () => {
    for (const locale of ["ko", "en"]) {
      const table = await loadNameTable(locale);
      expect(Object.keys(table.places)).toHaveLength(0);
      expect(Object.keys(table.cities)).toHaveLength(0);
    }
    expect(Object.keys((await loadNameTable("zh")).places).length).toBe(
      Object.keys(zh.places).length,
    );
  });
});
