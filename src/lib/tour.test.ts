import { describe, expect, it } from "vitest";
import {
  crowdLevel,
  foldScript,
  formatPlayTime,
  isTourEmpty,
  SCRIPT_FOLD,
  tourPath,
  upcomingCrowdDays,
} from "./tour";

describe("방문 집중률 수준 (PoC crowdLvl)", () => {
  it("40 · 70이 경계다: 39 여유 · 40 보통 · 69 보통 · 70 혼잡", () => {
    expect(crowdLevel(0)).toBe("quiet");
    expect(crowdLevel(39)).toBe("quiet");
    expect(crowdLevel(39.9)).toBe("quiet");
    expect(crowdLevel(40)).toBe("moderate");
    expect(crowdLevel(69)).toBe("moderate");
    expect(crowdLevel(70)).toBe("busy");
    expect(crowdLevel(100)).toBe("busy");
  });
});

describe("오늘부터 7일 (upcomingCrowdDays)", () => {
  // 2026-09-29 00:30 한국 = 2026-09-28 15:30 UTC
  const now = new Date("2026-09-28T15:30:00Z");
  const day = (date: string, rate = 50) => ({ date, rate });

  it("한국 날짜 오늘부터 7일만 날짜순으로 고른다(어제 · 8일째는 버린다)", () => {
    const days = [
      day("2026-10-06"),
      day("2026-09-28"),
      day("2026-09-30"),
      day("2026-09-29"),
      day("2026-10-05"),
    ];
    expect(upcomingCrowdDays(days, now).map((d) => d.date)).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-05",
    ]);
  });

  it("빠진 날은 만들지 않는다", () => {
    expect(upcomingCrowdDays([], now)).toEqual([]);
  });
});

describe("대본 접기 · 재생 시간", () => {
  it("240자를 넘으면 앞 240자 + 「…」, 넘지 않으면 그대로", () => {
    const short = "가".repeat(SCRIPT_FOLD);
    expect(foldScript(short)).toBe(short);
    const long = "가".repeat(SCRIPT_FOLD + 1);
    expect(foldScript(long)).toBe("가".repeat(SCRIPT_FOLD) + "…");
  });

  it("초를 「분:초」로 쓴다", () => {
    expect(formatPlayTime(0)).toBe("0:00");
    expect(formatPlayTime(65)).toBe("1:05");
    expect(formatPlayTime(3600)).toBe("60:00");
  });
});

describe("Route Handler 주소", () => {
  it("입력은 장소 id와 화면 언어뿐이다", () => {
    expect(tourPath("audio", "gjx1", "en")).toBe(
      "/api/tour/audio?id=gjx1&locale=en&v=2",
    );
    expect(tourPath("crowd", "gjx1")).toBe("/api/tour/crowd?id=gjx1");
  });

  it("결과 없음 응답을 알아본다", () => {
    expect(isTourEmpty({ empty: true })).toBe(true);
    expect(isTourEmpty({ month: "202607", items: [] })).toBe(false);
    expect(isTourEmpty(null)).toBe(false);
  });
});
