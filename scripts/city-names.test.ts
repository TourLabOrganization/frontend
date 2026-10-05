import { describe, expect, it } from "vitest";
import {
  applyCityNames,
  cityNameProblems,
  loadCityNames,
} from "./city-names.mjs";
import es from "../src/features/names/data/es.json";
import ja from "../src/features/names/data/ja.json";
import zh from "../src/features/names/data/zh.json";
import regions from "../src/features/planner/data/regions.json";

const rows = loadCityNames();
const cities = regions.regions.flatMap((r) => r.cities);

describe("도시 이름표(scripts/data/city-names.csv)", () => {
  it("모든 도시에 5개 언어 이름이 있고, 외국어 이름에 한글이 없다", () => {
    expect(cityNameProblems(rows, cities)).toEqual([]);
  });

  it("표가 regions.json(영어)과 이름표(중 · 일 · 스페인어)에 그대로 들어가 있다", () => {
    const tables: Record<string, { cities: Record<string, string> }> = {
      zh,
      ja,
      es,
    };
    const cityInfo = regions.cities as Record<string, { en: string }>;
    for (const r of rows) {
      expect(cityInfo[r.ko]?.en, r.ko).toBe(r.en);
      for (const l of ["zh", "ja", "es"])
        expect(tables[l].cities[r.ko], `${r.ko} ${l}`).toBe(r[l]);
    }
  });

  it("문제를 잡고, 덮어쓰기는 여러 번 해도 같다", () => {
    expect(
      cityNameProblems(
        [
          { ko: "가", en: "Ga", zh: "", ja: "ガ", es: "Ga" },
          { ko: "나", en: "Na", zh: "나", ja: "ナ", es: "Na" },
        ],
        ["가", "나", "다"],
      ),
    ).toEqual(["가: zh 빈 칸", "나: zh에 한글 (나)", "다: 표에 없다"]);
    const reg = { cities: { 가: { en: "" } } };
    const tables = { zh: { cities: {} }, ja: { cities: {} }, es: {} };
    const row = [{ ko: "가", en: "Ga", zh: "加", ja: "ガ", es: "Ga" }];
    expect(applyCityNames(reg, tables, row)).toBe(4);
    expect(applyCityNames(reg, tables, row)).toBe(0);
    expect(reg.cities.가.en).toBe("Ga");
  });
});
