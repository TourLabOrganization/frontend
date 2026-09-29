import { describe, expect, it } from "vitest";
import { evaluate, type Answers, type SurveyResult } from "./survey";
import {
  CATEGORIES,
  featuredCategory,
  indirectPreference,
  INTEREST_TERM,
  normalizedTypeProfile,
  rankThemes,
  TYPE_PROFILES,
} from "./theme-index";
import { THEMES } from "./themes";
import { REFERENCE_CASES } from "./data/reference-cases";

// 명세서 §15 예제(§37 혼합 응답): 설문 6.3 최종 C4 74.7 · C5 71.1, α 0.5517 · 0.4483
const MIXED: Answers = {
  s1: "30s",
  s2: "solo",
  s3: "relaxed",
  s4: "history",
  s5: "quiet",
  s6: "morning",
  b2: "a",
  f1: "balanced",
};

function complete(answers: Answers): SurveyResult {
  const result = evaluate(answers);
  if (result.status !== "complete") throw new Error(JSON.stringify(result));
  return result;
}

const TOLERANCE = 1e-5;
const close = (got: readonly number[], want: readonly number[]) => {
  expect(got).toHaveLength(want.length);
  got.forEach((v, i) => expect(Math.abs(v - want[i])).toBeLessThan(TOLERANCE));
};

describe("유형 프로필 W (명세서 §13)", () => {
  it("행 합으로 나눠 쓴다: C8 · C9(추천 6.3 개정값, 합 1)", () => {
    close(
      normalizedTypeProfile("C8"),
      [0.079208, 0.257426, 0, 0.435644, 0.227723],
    );
    close(normalizedTypeProfile("C9"), [0.02, 0.3, 0.07, 0.11, 0.5]);
    for (const c of Object.keys(
      TYPE_PROFILES,
    ) as (keyof typeof TYPE_PROFILES)[])
      expect(normalizedTypeProfile(c).reduce((a, b) => a + b, 0)).toBeCloseTo(
        1,
        12,
      );
  });

  it("간접 선호 u: C4 0.5517 · C5 0.4483 → [0.321, 0.434, 0.028, 0.128, 0.090]", () => {
    const u = indirectPreference(complete(MIXED));
    close(u, [0.32069, 0.434483, 0.027586, 0.127586, 0.089655]);
    expect(u.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("단일형이면 그 유형의 정규화 프로필이다", () => {
    const single = complete({ ...MIXED, b2: "none", f1: undefined });
    expect(single.types).toEqual(["C5"]);
    close(indirectPreference(single), normalizedTypeProfile("C5"));
  });
});

describe("테마 적합도 지수 (명세서 §14 · §15)", () => {
  it("예제 순서와 값: 왕과 사는 남자 · RESCENE · 케데헌 · 제주 · 부산", () => {
    const ranking = rankThemes(complete(MIXED));
    expect(ranking.map((t) => t.slug)).toEqual([
      "kings-warden",
      "rescene-route",
      "kpop-demon-hunters",
      "jeju-k-drama",
      "busan-film-trip",
    ]);
    close(
      ranking.map((t) => t.index),
      [31.798165, 25.70552, 25.263197, 23.848271, 18.522067],
    );
    const [kings, rescene, kpop, jeju, busan] = ranking;
    close([kings.fit, 0.5 * kings.interest], [0.276972, 0.2]);
    close([rescene.fit, 0.5 * rescene.interest], [0.221583, 0.164]);
    close([kpop.fit, 0.5 * kpop.interest], [0.232301, 0.146647]);
    close([jeju.fit, 0.5 * jeju.interest], [0.275224, 0.0825]);
    close([busan.fit, 0.5 * busan.interest], [0.207331, 0.0705]);
  });

  it("화면에 나눠 보이는 기여의 합이 지수다 (유형 100F/1.5 + 관심사 100·0.5r/1.5)", () => {
    for (const t of rankThemes(complete(MIXED))) {
      expect(t.typePart).toBeCloseTo((100 * t.fit) / 1.5, 10);
      expect(t.interestPart).toBeCloseTo((100 * 0.5 * t.interest) / 1.5, 10);
      expect(t.typePart + t.interestPart).toBeCloseTo(t.index, 10);
    }
  });

  it("테마 5범주는 합으로 나눈다(케데헌 0.999)", () => {
    for (const t of rankThemes(complete(MIXED)))
      expect(t.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("S4 야경이면 관심사 항은 야경 비중(나누지 않은 값)이다", () => {
    const result = complete({
      s1: "20s",
      s2: "couple",
      s3: "moderate",
      s4: "night",
      s5: "trending",
      s6: "evening",
      b6: "b",
    });
    expect(INTEREST_TERM.night).toBe("night");
    const byslug = Object.fromEntries(
      rankThemes(result).map((t) => [t.slug, t]),
    );
    expect(byslug["kings-warden"].interest).toBe(0.056);
    expect(byslug["kpop-demon-hunters"].interest).toBe(0.128);
    expect(byslug["busan-film-trip"].interest).toBe(0.141);
  });

  it("S4 드라마 · 공연 · 쇼핑은 관심사 자료가 없어 r = 0이다 (additional_metadata_required)", () => {
    expect(INTEREST_TERM.drama).toBeNull();
    expect(INTEREST_TERM.performance).toBeNull();
    expect(INTEREST_TERM["shopping-beauty"]).toBeNull();
    const result = complete({
      s1: "teens",
      s2: "solo",
      s3: "packed",
      s4: "drama",
      s5: "trending",
      s6: "morning",
      b1: "a",
    });
    for (const t of rankThemes(result)) {
      expect(t.interest).toBe(0);
      expect(t.interestPart).toBe(0);
      expect(t.index).toBeCloseTo(t.typePart, 12);
    }
  });

  it("관심사 범주는 앱 분류 순서(역사 · 자연 · 체험 · 음식 · 바다)를 가리킨다", () => {
    expect(CATEGORIES).toEqual(["herit", "heal", "activity", "food", "sea"]);
    expect(INTEREST_TERM.history).toBe("herit");
    expect(INTEREST_TERM.nature).toBe("heal");
    expect(INTEREST_TERM.activity).toBe("activity");
    expect(INTEREST_TERM["food-market"]).toBe("food");
    expect(INTEREST_TERM.sea).toBe("sea");
  });

  it("카드의 분류 비중: 관심사 분류가 0보다 크면 그 분류, 아니면 가장 큰 분류", () => {
    const bySlug = Object.fromEntries(
      rankThemes(complete(MIXED)).map((t) => [t.slug, t]),
    );
    // 역사 관심사 → 역사 비중
    const history = featuredCategory(bySlug["kings-warden"], "history");
    expect(history.category).toBe("herit");
    expect(history.share).toBeCloseTo(0.4, 10);
    // RESCENE 바다 관심사 → 바다 비중
    const sea = featuredCategory(bySlug["rescene-route"], "sea");
    expect(sea.category).toBe("sea");
    expect(sea.share).toBeCloseTo(0.184, 10);
    // 왕과 사는 남자는 바다 0 → 가장 큰 역사
    expect(featuredCategory(bySlug["kings-warden"], "sea").category).toBe(
      "herit",
    );
    // 야경 · 자료 없는 관심사는 가장 큰 분류(제주 자연)
    expect(featuredCategory(bySlug["jeju-k-drama"], "night").category).toBe(
      "heal",
    );
    expect(featuredCategory(bySlug["jeju-k-drama"], "drama").category).toBe(
      "heal",
    );
  });

  it("테마 5개 모두 지수를 낸다(THEMES 순서 = 명세서 표 순서)", () => {
    expect(THEMES.map((t) => t.slug)).toEqual([
      "kings-warden",
      "kpop-demon-hunters",
      "rescene-route",
      "jeju-k-drama",
      "busan-film-trip",
    ]);
    expect(rankThemes(complete(MIXED))).toHaveLength(5);
  });
});

describe("Python 참조 계산과 같은 값 (recommend_reference.py 테마 부분)", () => {
  for (const [n, c] of REFERENCE_CASES.entries()) {
    it(`사례 ${n + 1}: 간접 선호 u · 테마 지수 · 상위 3개`, () => {
      const result = complete(c.answers);
      close(indirectPreference(result), c.preference);
      const ranking = rankThemes(result);
      for (const t of ranking)
        expect(t.index, t.slug).toBeCloseTo(c.themeIndex[t.slug], 9);
      expect(ranking.slice(0, 3).map((t) => t.slug)).toEqual(c.themeTop3);
    });
  }
});
