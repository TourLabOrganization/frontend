import { describe, expect, it } from "vitest";
import extrasData from "./data/extras.json";
import { workTitle } from "./work-titles";

describe("workTitle (PoC TX_DICT_TITLES)", () => {
  it("작품명만 바꾸고 연도 표기는 그대로", () => {
    expect(workTitle("왕과 사는 남자 (2026)", "en")).toBe(
      "The King's Warden (2026)",
    );
    expect(workTitle("왕과 사는 남자 (2026)", "zh")).toBe(
      "与王同住的男人 (2026)",
    );
    expect(workTitle("왕과 사는 남자 (2026)", "ja")).toBe(
      "王と生きる男 (2026)",
    );
    expect(workTitle("왕과 사는 남자 (2026)", "es")).toBe(
      "The King's Warden (2026)",
    );
    expect(workTitle("해운대 (2009)", "ja")).toBe("TSUNAMI (2009)");
  });

  it("한국어 화면 · 표에 없는 이름은 그대로", () => {
    expect(workTitle("왕과 사는 남자 (2026)", "ko")).toBe(
      "왕과 사는 남자 (2026)",
    );
    expect(workTitle("RESCENE", "en")).toBe("RESCENE");
  });

  it("긴 이름부터 바꾼다(PoC와 다른 점)", () => {
    expect(workTitle("국가유산청 공식 유튜브", "en")).toBe(
      "Korea Heritage Service official YouTube",
    );
    expect(workTitle("RESCENE 공식 유튜브", "ja")).toBe("RESCENE 公式YouTube");
  });

  it("테마 데이터의 작품명은 외국어 화면에서 한글이 남지 않는다", () => {
    const works = new Set<string>();
    for (const theme of Object.values(extrasData))
      for (const e of Object.values(theme) as { work?: string }[])
        if (e.work) works.add(e.work);
    expect(works.size).toBeGreaterThan(0);
    for (const w of works)
      for (const locale of ["en", "zh", "ja", "es"])
        expect(workTitle(w, locale)).not.toMatch(/[가-힣]/);
  });
});
