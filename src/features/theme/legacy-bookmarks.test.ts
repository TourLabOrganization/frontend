import { afterEach, describe, expect, it, vi } from "vitest";
import {
  legacyToSaved,
  mergeSaved,
  migrateLegacyBookmarks,
} from "./legacy-bookmarks";

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

describe("migrateLegacyBookmarks (가짜 localStorage)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubStorage(initial: Record<string, string>, failWrites: boolean) {
    const data = new Map(Object.entries(initial));
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (failWrites) throw new DOMException("full", "QuotaExceededError");
          data.set(k, v);
        },
        removeItem: (k: string) => void data.delete(k),
      },
      dispatchEvent: () => true,
    });
    return data;
  }

  it("옮겨 쓰기에 성공하면 예전 키를 지운다", () => {
    const data = stubStorage(
      { "tn.bookmarks.kings-warden": JSON.stringify(["yw1"]) },
      false,
    );
    migrateLegacyBookmarks(NAMES, 7);
    expect(data.has("tn.bookmarks.kings-warden")).toBe(false);
    expect(JSON.parse(data.get("tn.savedPlaces") ?? "[]")).toEqual([
      {
        id: "yw1",
        source: "kings-warden",
        savedAt: 7,
        name: { ko: "청령포", en: "Cheongnyeongpo" },
      },
    ]);
  });

  it("쓰기에 실패하면(저장 공간 가득 참 등) 예전 키를 남긴다", () => {
    const raw = JSON.stringify(["yw1", "yw2"]);
    const data = stubStorage({ "tn.bookmarks.kings-warden": raw }, true);
    migrateLegacyBookmarks(NAMES, 7);
    expect(data.get("tn.bookmarks.kings-warden")).toBe(raw);
    expect(data.has("tn.savedPlaces")).toBe(false);
  });

  it("옮길 것이 없으면(이름표에 없는 id뿐) 쓰지 않고 예전 키를 지운다", () => {
    const data = stubStorage(
      { "tn.bookmarks.kings-warden": JSON.stringify(["gone"]) },
      true,
    );
    migrateLegacyBookmarks(NAMES, 7);
    expect(data.has("tn.bookmarks.kings-warden")).toBe(false);
  });
});
