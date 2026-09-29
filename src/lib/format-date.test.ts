import { describe, expect, it } from "vitest";
import { formatDate } from "./format-date";

describe("formatDate", () => {
  it("날짜만 있는 값(YYYY-MM-DD)을 그 언어의 보통 길이 날짜로 쓴다", () => {
    expect(formatDate("2026-09-27", "ko")).toBe("2026. 9. 27.");
    expect(formatDate("2026-09-27", "en")).toBe("Sep 27, 2026");
    expect(formatDate("2026-09-27", "zh")).toBe("2026年9月27日");
    expect(formatDate("2026-09-27", "ja")).toBe("2026/09/27");
    expect(formatDate("2026-09-27", "es")).toBe("27 sept 2026");
  });

  it("UTC로 읽어 시간대 때문에 하루 밀리지 않는다(연초 · 월말)", () => {
    expect(formatDate("2026-01-01", "en")).toBe("Jan 1, 2026");
    expect(formatDate("2026-12-31", "en")).toBe("Dec 31, 2026");
    expect(formatDate("2028-02-29", "ko")).toBe("2028. 2. 29.");
  });

  it("모양이 다르거나 없는 날짜는 받은 그대로", () => {
    expect(formatDate("2026-9-27", "en")).toBe("2026-9-27");
    expect(formatDate("2026-02-30", "en")).toBe("2026-02-30");
    expect(formatDate("", "en")).toBe("");
  });
});
