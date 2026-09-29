import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import ja from "../../messages/ja.json";
import ko from "../../messages/ko.json";
import zh from "../../messages/zh.json";
import { hasHangul } from "./hangul";

describe("장소 시트 한국관광공사 칸 문구 (5개 언어)", () => {
  const all = { ko, en, zh, ja, es };

  it("다섯 언어 모두 같은 키가 있다", () => {
    const keys = (o: object, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" && v !== null
          ? keys(v as object, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      );
    const base = keys(ko.PlaceSheet.tour).sort();
    expect(base).toContain("crowd.levels.busy");
    for (const m of Object.values(all))
      expect(keys(m.PlaceSheet.tour).sort()).toEqual(base);
  });

  it("외국어 문구에 한글이 없고, 출처 기관명을 그 언어로 옮겼다", () => {
    for (const [locale, m] of Object.entries(all)) {
      if (locale === "ko") continue;
      const text = JSON.stringify(m.PlaceSheet.tour);
      expect(hasHangul(text)).toBe(false);
    }
    expect(en.PlaceSheet.tour.audio.sourceOdii).toContain(
      "Korea Tourism Organization",
    );
    expect(zh.PlaceSheet.tour.crowd.source).toContain("韩国观光公社");
    expect(ja.PlaceSheet.tour.crowd.source).toContain("韓国観光公社");
    expect(es.PlaceSheet.tour.related.source).toContain(
      "Organización de Turismo de Corea",
    );
  });
});
