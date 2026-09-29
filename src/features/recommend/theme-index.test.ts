import { describe, expect, it } from "vitest";
import { evaluate, type Answers, type SurveyResult } from "./survey";
import {
  CATEGORIES,
  featuredCategories,
  indirectPreference,
  INTEREST_TERM,
  interestTerms,
  normalizedTypeProfile,
  rankThemes,
  TYPE_PROFILES,
} from "./theme-index";
import { THEMES } from "./themes";
import { REFERENCE_CASES } from "./data/reference-cases";

// 명세서 §15 예제(§37 혼합 응답): 설문 6.4 최종 C4 78.4 · C5 73.6, α 0.5687 · 0.4313
const MIXED: Answers = {
  s1: "30s",
  s2: "solo",
  s3: "relaxed",
  s4: "history_nature",
  s5: "quiet",
  s6: "morning",
  b2: "a",
  b3: "none",
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

  it("간접 선호 u: C4 0.5687 · C5 0.4313 → [0.327, 0.429, 0.028, 0.128, 0.086]", () => {
    const u = indirectPreference(complete(MIXED));
    close(u, [0.327463, 0.429403, 0.028433, 0.128433, 0.086269]);
    expect(u.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("단일형이면 그 유형의 정규화 프로필이다", () => {
    const single = complete({ ...MIXED, b2: "none", b3: "a", f1: undefined });
    expect(single.types).toEqual(["C5"]);
    close(indirectPreference(single), normalizedTypeProfile("C5"));
  });
});

describe("테마 적합도 지수 (명세서 §14 · §15)", () => {
  it("예제 순서와 값: 왕과 사는 남자 · 제주 · 케데헌 · RESCENE · 부산 (관심사 항은 역사 · 자연 비중의 평균)", () => {
    const ranking = rankThemes(complete(MIXED));
    expect(ranking.map((t) => t.slug)).toEqual([
      "kings-warden",
      "jeju-k-drama",
      "kpop-demon-hunters",
      "rescene-route",
      "busan-film-trip",
    ]);
    close(
      ranking.map((t) => t.index),
      [30.406435, 28.256644, 24.258385, 23.057768, 20.215158],
    );
    const [kings, jeju, kpop, rescene, busan] = ranking;
    close([kings.fit, 0.5 * kings.interest], [0.278347, 0.17775]);
    close([jeju.fit, 0.5 * jeju.interest], [0.27335, 0.1505]);
    close([kpop.fit, 0.5 * kpop.interest], [0.233495, 0.13038]);
    close([rescene.fit, 0.5 * rescene.interest], [0.222617, 0.12325]);
    close([busan.fit, 0.5 * busan.interest], [0.206727, 0.0965]);
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

  it("S4 야경의 항은 야경 비중(나누지 않은 값)이고, 자료 없는 관심사와 고르면 야경 항만 쓴다", () => {
    const result = complete({
      s1: "20s",
      s2: "couple",
      s3: "moderate",
      s4: "night_shopping-beauty",
      s5: "trending",
      s6: "evening",
      b6: "b",
      b7: "a",
      f1: "balanced",
    });
    expect(INTEREST_TERM.night).toBe("night");
    expect(interestTerms(result.interests)).toEqual(["night"]);
    const byslug = Object.fromEntries(
      rankThemes(result).map((t) => [t.slug, t]),
    );
    expect(byslug["kings-warden"].interest).toBe(0.056);
    expect(byslug["kpop-demon-hunters"].interest).toBe(0.128);
    expect(byslug["busan-film-trip"].interest).toBe(0.141);
  });

  it("관심사 항은 두 관심사 항의 평균이다(바다 + 야경)", () => {
    const result = complete({
      s1: "20s",
      s2: "couple",
      s3: "moderate",
      s4: "sea_night",
      s5: "trending",
      s6: "evening",
      b3: "c",
      b6: "b",
    });
    const busan = rankThemes(result).find((t) => t.slug === "busan-film-trip")!;
    expect(busan.interest).toBeCloseTo((busan.shares[4] + 0.141) / 2, 12);
  });

  it("S4 드라마 · 공연 · 쇼핑은 관심사 자료가 없어 r = 0이다 (additional_metadata_required)", () => {
    expect(INTEREST_TERM.drama).toBeNull();
    expect(INTEREST_TERM.performance).toBeNull();
    expect(INTEREST_TERM["shopping-beauty"]).toBeNull();
    const result = complete({
      s1: "teens",
      s2: "solo",
      s3: "packed",
      s4: "drama_performance",
      s5: "trending",
      s6: "morning",
      b1: "a",
    });
    expect(interestTerms(result.interests)).toEqual([]);
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

  it("카드의 분류 비중: 관심사 분류가 0보다 크면 그 분류들(관심사 순), 하나도 없으면 가장 큰 분류", () => {
    const bySlug = Object.fromEntries(
      rankThemes(complete(MIXED)).map((t) => [t.slug, t]),
    );
    // 역사 · 자연 관심사 → 두 비중
    const both = featuredCategories(bySlug["kings-warden"], [
      "history",
      "nature",
    ]);
    expect(both.map((x) => x.category)).toEqual(["herit", "heal"]);
    expect(both[0].share).toBeCloseTo(0.4, 10);
    expect(both[1].share).toBeCloseTo(0.311, 10);
    // RESCENE 바다 관심사 → 바다 비중(드라마는 분류가 없어 빠진다)
    const sea = featuredCategories(bySlug["rescene-route"], ["drama", "sea"]);
    expect(sea).toHaveLength(1);
    expect(sea[0].category).toBe("sea");
    expect(sea[0].share).toBeCloseTo(0.184, 10);
    // 왕과 사는 남자는 바다 0 → 가장 큰 역사
    expect(
      featuredCategories(bySlug["kings-warden"], ["sea", "night"]).map(
        (x) => x.category,
      ),
    ).toEqual(["herit"]);
    // 야경 · 자료 없는 관심사만이면 가장 큰 분류(제주 자연)
    expect(
      featuredCategories(bySlug["jeju-k-drama"], ["drama", "night"]).map(
        (x) => x.category,
      ),
    ).toEqual(["heal"]);
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
