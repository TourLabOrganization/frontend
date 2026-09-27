import { describe, expect, it } from "vitest";
import { legacyToSaved, mergeSaved } from "./legacy-bookmarks";

const NAMES = {
  "kings-warden": {
    yw1: { ko: "청령포", en: "Cheongnyeongpo" },
    yw2: { ko: "영월 장릉", en: "Jangneung" },
  },
};

describe("예전 테마 북마크 옮기기", () => {
  it("이름표에 있는 id만 저장한 장소 형식으로 바꾼다", () => {
    expect(legacyToSaved("kings-warden", ["yw1", "gone"], NAMES, 5)).toEqual([
      {
        id: "yw1",
        source: "kings-warden",
        savedAt: 5,
        name: { ko: "청령포", en: "Cheongnyeongpo" },
      },
    ]);
    expect(legacyToSaved("unknown-theme", ["yw1"], NAMES, 5)).toEqual([]);
  });

  it("이미 저장한 것(같은 id · 출처)은 건너뛰고 나머지를 뒤에 더한다", () => {
    const saved = legacyToSaved("kings-warden", ["yw1"], NAMES, 1);
    const add = legacyToSaved("kings-warden", ["yw1", "yw2"], NAMES, 2);
    const merged = mergeSaved(saved, add);
    expect(merged.map((p) => [p.id, p.savedAt])).toEqual([
      ["yw1", 1],
      ["yw2", 2],
    ]);
  });
});
