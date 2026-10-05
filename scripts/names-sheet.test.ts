import { describe, expect, it } from "vitest";
import { currentSheet, diffSheet, toCsv } from "./names-sheet.mjs";
import { parseCsv } from "./apply-badge-lists.mjs";

describe("다국어 지명 검토 시트(scripts/names-sheet.mjs)", () => {
  const sheet = currentSheet();

  it("도시와 장소가 모두 들어 있고, 장소마다 5개 언어 이름이 있다", () => {
    expect(sheet.filter((r) => r.kind === "city").length).toBeGreaterThan(100);
    for (const r of sheet.filter((x) => x.kind === "place"))
      for (const l of ["ko", "en", "zh", "ja", "es"] as const)
        expect(r[l], `${r.id} ${l}`).not.toBe("");
  });

  it("내보낸 시트를 그대로 받으면 바뀐 칸이 없다(CSV 따옴표 · 쉼표 포함)", () => {
    const back = parseCsv(toCsv(sheet));
    expect(diffSheet(sheet, back)).toEqual({ cities: [], places: [] });
  });

  it("바뀐 칸만 찾고, 공식 명칭이 있는 중 · 일 이름은 표시한다", () => {
    const now = [
      {
        kind: "city",
        id: "가",
        ko: "가",
        en: "Ga",
        zh: "加",
        ja: "ガ",
        es: "Ga",
      },
      {
        kind: "place",
        id: "p1",
        ko: "절",
        en: "Jeol",
        zh: "寺",
        ja: "寺",
        es: "Templo",
        zh_src: "공식",
        ja_src: "앱",
      },
    ];
    const edited = [
      { ...now[0], zh: "伽" },
      { ...now[1], zh: "佛寺", ja: "お寺", es: "" },
    ];
    expect(diffSheet(now, edited)).toEqual({
      cities: [{ ko: "가", field: "zh", from: "加", to: "伽" }],
      places: [
        { id: "p1", field: "zh", from: "寺", to: "佛寺", official: true },
        { id: "p1", field: "ja", from: "寺", to: "お寺", official: false },
      ],
    });
  });
});
