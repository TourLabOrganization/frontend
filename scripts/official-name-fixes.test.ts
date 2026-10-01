import { describe, expect, it } from "vitest";
import ja from "../src/features/names/data/ja.json";
import zh from "../src/features/names/data/zh.json";
import details from "../src/features/planner/data/place-details.json";
import appJa from "../src/features/translations/data/place-names.ja.json";
import appZh from "../src/features/translations/data/place-names.zh.json";
import {
  isOfficialName,
  WRONG_OFFICIAL_NAMES,
} from "./official-name-fixes.mjs";

describe("그 장소가 아닌 공식 명칭 거르기", () => {
  it("한글 섞임 · 빈 값 · 목록의 id는 공식 명칭이 아니다", () => {
    expect(isOfficialName("ja", "gj1", "孝友堂")).toBe(true);
    expect(isOfficialName("ja", "bcx14", "カン톤市場夜市")).toBe(false);
    expect(isOfficialName("ja", "gj1", " ")).toBe(false);
    expect(isOfficialName("ja", "gj1", undefined)).toBe(false);
    expect(isOfficialName("ja", "kdx66", "アルムダウンナラ皮膚科明洞店")).toBe(
      false,
    );
    expect(isOfficialName("zh", "kdx66", "美丽国度皮肤科")).toBe(false);
    expect(isOfficialName("zh", "nax102", "东城路")).toBe(true); // 중문 목록에는 없다
  });

  it.each([
    ["ja", ja.places, appJa],
    ["zh", zh.places, appZh],
  ] as const)(
    "%s: 목록의 id는 이름표 · place-details에 공식 명칭이 없고 앱이 옮긴 이름이 있다",
    (lang, official, app) => {
      for (const id of Object.keys(WRONG_OFFICIAL_NAMES[lang])) {
        expect(Object.hasOwn(official, id), id).toBe(false);
        expect(
          (details as Record<string, Record<string, unknown>>)[id]?.[lang],
          id,
        ).toBeUndefined();
        expect((app as Record<string, string>)[id], id).toBeTruthy();
      }
    },
  );
});
