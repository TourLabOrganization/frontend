import { describe, expect, it } from "vitest";
import { THEMES } from "./themes";
import { THEME_WORK, themeBackdrop, themePoster, tmdbImage } from "./works";

describe("테마 작품 이미지 (TMDB)", () => {
  it("RESCENE 말고는 테마마다 작품이 있고, 경로는 TMDB 이미지 파일 형식이다", () => {
    for (const { slug } of THEMES) {
      const work = THEME_WORK[slug];
      if (slug === "rescene-route") {
        expect(work).toBeUndefined();
        continue;
      }
      expect(work?.poster.ko, slug).toMatch(/^\/\w+\.jpg$/);
      expect(work?.poster.en, slug).toMatch(/^\/\w+\.jpg$/);
      expect(work?.backdrop, slug).toMatch(/^\/\w+\.jpg$/);
    }
  });

  it("테마마다 포스터 · 카드 이미지가 있다 (RESCENE은 목업 로고 이미지)", () => {
    for (const { slug } of THEMES) {
      expect(themePoster(slug, "ko"), slug).toBeTruthy();
      expect(themeBackdrop(slug), slug).toBeTruthy();
    }
    expect(themePoster("rescene-route", "en")).toBe(
      "/themes/rescene-poster.jpg",
    );
    expect(themePoster("kings-warden", "en")).not.toBe(
      themePoster("kings-warden", "ko"),
    );
  });

  it("이미지 주소는 TMDB 이미지 서버 + 크기 + 경로", () => {
    expect(tmdbImage("/a.jpg", "w500")).toBe(
      "https://image.tmdb.org/t/p/w500/a.jpg",
    );
  });
});
