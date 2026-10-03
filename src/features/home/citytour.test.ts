import { describe, expect, it } from "vitest";
import { decodeAnswers } from "../recommend/answers";
import { REFERENCE_CASES } from "../recommend/data/reference-cases";
import type { Answers } from "../recommend/survey";
import {
  type CityTour,
  courseScore,
  type CourseScoreProfile,
  recommendTourPicks,
  recommendTours,
  regionCounts,
  routeOverflows,
  tourFare,
  tourHours,
  tourProfile,
  tourTags,
  typeProfile,
} from "./citytour";
import toursData from "./data/citytour.json";
import scoresData from "./data/citytour-scores.json";

const TOURS = toursData as CityTour[];

// 명세서 §15 예제(C4 · C5 복합형, 역사 · 자연)
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

const SAMPLES: Answers[] = [
  MIXED,
  // 20대 · 친구와 · 빡빡하게 · 야경과 쇼핑 · 핫플 · 저녁 + 인기 야간 명소 · 스파 → C1
  {
    s1: "20s",
    s2: "friends",
    s3: "packed",
    s4: "night_shopping-beauty",
    s5: "trending",
    s6: "evening",
    b6: "a",
    b7: "a",
  },
  // 관심사 자료 없음(드라마 · 공연): 10대 · 혼자 · 빡빡하게 + 실제 촬영지 → C7
  {
    s1: "teens",
    s2: "solo",
    s3: "packed",
    s4: "drama_performance",
    s5: "trending",
    s6: "morning",
    b1: "a",
  },
  // 20대 · 친구와 · 적당히 · 드라마와 바다 · 핫플 · 저녁 + 동행 사진 두 번 → C2
  {
    s1: "20s",
    s2: "friends",
    s3: "moderate",
    s4: "drama_sea",
    s5: "trending",
    s6: "evening",
    b1: "c",
    b3: "c",
  },
  // 50대 · 부모님 · 적당히 · 맛집과 체험 · 한적한 곳 · 낮 + 지역 미식 · 가족 체험 → C6
  {
    s1: "50s",
    s2: "parents",
    s3: "moderate",
    s4: "food-market_activity",
    s5: "quiet",
    s6: "daytime",
    b4: "a",
    b5: "a",
  },
];

const PROFILES = scoresData as (CourseScoreProfile | null)[];
const byId = new Map(
  PROFILES.flatMap((p, i) => (p ? [[p.id, TOURS[i]] as const] : [])),
);

describe("recommendTours (내 유형 추천, 명세서 §16 코스 점수 · 관심사별 1자리 보장)", () => {
  it("점수 자료는 citytour.json과 같은 순서의 280칸이고 분석 적격 234코스만 있다", () => {
    expect(PROFILES).toHaveLength(TOURS.length);
    const present = PROFILES.filter((p) => p !== null);
    expect(present).toHaveLength(234);
    for (const p of present) {
      expect(p.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(p.coverage, 8);
      expect(p.visits).toBeGreaterThanOrEqual(2);
    }
  });

  it("명세서 예제(C4 · C5 복합형, 역사 · 자연 · 천천히): 해남(역사 자리) · 대전 생태교육(자연 자리) · 아산 · 순천 81.34, 파주 80.83", () => {
    const picks = recommendTourPicks(TOURS, typeProfile(MIXED)!, PROFILES);
    expect(
      picks.map((p) => [p.tour.region, p.tour.name, p.reservedFor]),
    ).toEqual([
      ["해남", "해남시티투어", "history"],
      ["대전", "생태교육", "nature"],
      ["아산", "역사기행 코스", null],
      ["순천", "(기획투어)나이트가든투어", null],
      ["파주", "2026 파주시티투어 당일코스(목요일)", null],
    ]);
    [81.343917, 81.343917, 81.343917, 81.343917, 80.825055].forEach((v, k) =>
      expect(picks[k].score).toBeCloseTo(v, 5),
    );
    expect(picks[0].fit).toBeCloseTo(95.150267, 5);
  });

  it("보장 자리는 순위 밖의 코스라도 먼저 채우고, 보여 주는 순서는 순위 순이다", () => {
    for (const answers of SAMPLES) {
      const type = typeProfile(answers)!;
      const picks = recommendTourPicks(TOURS, type, PROFILES);
      const reserved = picks.flatMap((p) =>
        p.reservedFor ? [p.reservedFor] : [],
      );
      // 분류가 있는 관심사마다 한 자리(234코스에서는 늘 채울 코스가 있다)
      expect(reserved).toEqual(type.tags);
      for (let k = 1; k < picks.length; k++)
        expect(picks[k].score).toBeLessThanOrEqual(picks[k - 1].score + 1e-9);
    }
  });

  it("가산 항이 없으면 점수는 범주 적합 100 · cos · 커버리지다", () => {
    const type = {
      ...typeProfile(SAMPLES[2])!,
      pace: null,
      eveningNight: false,
    };
    expect(type.tags).toEqual([]);
    for (const p of PROFILES.filter((x) => x !== null)) {
      const s = courseScore(p, type);
      expect(s.score).toBeCloseTo(s.fit, 10);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100 + 1e-9);
    }
  });

  it("한 지역에서 한 노선만, 분석 적격 코스만 고른다", () => {
    for (const answers of SAMPLES) {
      const got = recommendTours(TOURS, typeProfile(answers)!, PROFILES);
      expect(got).toHaveLength(5);
      expect(new Set(got.map((t) => t.region)).size).toBe(5);
      for (const tour of got)
        expect(PROFILES[TOURS.indexOf(tour)]).not.toBeNull();
    }
  });

  it("유형 요약: 명세서 예제는 C4 · C5, u = [0.327, 0.429, 0.028, 0.128, 0.086], 역사 · 자연 · 천천히 · 저녁 가산 없음", () => {
    const type = typeProfile(MIXED)!;
    expect(type.types).toEqual(["C4", "C5"]);
    expect(type.tags).toEqual(["history", "nature"]);
    expect(type.pace).toBe("relaxed");
    expect(type.eveningNight).toBe(false);
    [0.327463, 0.429403, 0.028433, 0.128433, 0.086269].forEach((v, k) =>
      expect(type.preference[k]).toBeCloseTo(v, 5),
    );
  });

  it("S6 저녁 · 밤까지는 S4에 야경이 없을 때만 야경 가산이다", () => {
    expect(typeProfile(SAMPLES[1])!.tags).toEqual(["night"]);
    expect(typeProfile(SAMPLES[1])!.eveningNight).toBe(false);
    expect(typeProfile(SAMPLES[3])!.eveningNight).toBe(true);
    expect(typeProfile(SAMPLES[3])!.pace).toBeNull();
  });

  it("드라마 · 공연 · 쇼핑 관심사는 경유지 분류가 없다", () => {
    expect(typeProfile(SAMPLES[2])!.tags).toEqual([]);
    expect(typeProfile(SAMPLES[3])!.tags).toEqual(["sea"]);
    expect(typeProfile(SAMPLES[2])!.types).toEqual(["C7"]);
  });

  it("완료되지 않은 답 · 예전 15문항 기록 · S4 한 가지였던 설문 6.3 기록이면 유형이 없다", () => {
    expect(typeProfile({ s1: "20s" })).toBeNull();
    expect(
      typeProfile(
        decodeAnswers(
          "s1.30s~s2.solo~s3.relaxed~s4.history~s5.quiet~s6.morning~b2.a~f1.balanced",
        ),
      ),
    ).toBeNull();
    expect(
      typeProfile(decodeAnswers("q1.60s~q2.spouse~q3.relaxed~q4.history")),
    ).toBeNull();
  });

  for (const [n, c] of REFERENCE_CASES.entries()) {
    it(`Python 참조 계산과 같은 지역 대표 5개 · 점수 (사례 ${n + 1})`, () => {
      const type = typeProfile(c.answers)!;
      const picks = recommendTourPicks(TOURS, type, PROFILES);
      expect(picks.map((p) => p.tour)).toEqual(
        c.tours.map((t) => byId.get(t.courseId)),
      );
      expect(recommendTours(TOURS, type, PROFILES)).toEqual(
        picks.map((p) => p.tour),
      );
      picks.forEach((p, k) => {
        expect(p.score).toBeCloseTo(c.tours[k].score, 9);
        expect(p.fit).toBeCloseTo(c.tours[k].fit, 9);
        expect(p.reservedFor).toBe(c.tours[k].reservedFor);
      });
    });
  }
});

describe("tourProfile · tourTags", () => {
  it("경유지를 나눠 분류 비율과 야간 여부를 센다", () => {
    const p = tourProfile({
      name: "야경투어",
      route: "경주역 → 불국사 → 보문호수(산책) → 황리단길 카페 → 경주역",
    });
    expect(p.stops).toBe(5);
    // 불국사(역사 [가-힣]사$) · 보문호수(자연) · 카페(먹거리)
    expect(p.share).toEqual([0.2, 0.2, 0, 0.2, 0]);
    expect(p.night).toBe(true);
    expect(tourTags(p)).toEqual(["night", "history"]);
  });

  it("분류가 없으면 칩이 없다", () => {
    expect(tourTags(tourProfile({ name: "A", route: "가 → 나" }))).toEqual([]);
  });
});

describe("regionCounts · 표시 문구", () => {
  it("데이터의 지역 · 노선 수를 센다", () => {
    const counts = regionCounts(TOURS);
    expect(TOURS).toHaveLength(280);
    // 여행지(visits) 기준: 서울 출발 EG투어버스 12노선은 경기 각지로, 대전 광역투어는 대전 + 이웃 도시로 센다
    expect(counts.size).toBe(82);
    expect(counts.get("서울")).toBeUndefined();
    expect(counts.get("파주")).toBe(8);
    expect(counts.get("안산")).toBe(11);
    expect(counts.get("가평")).toBe(2);
    expect(TOURS.filter((t) => t.region === "서울")).toHaveLength(12);
    expect(TOURS.every((t) => t.visits.length > 0)).toBe(true);
  });

  it("운행 시간은 앞자리 0을 뗀다", () => {
    expect(tourHours({ first: "08:20", last: "17:50" })).toBe("8:20–17:50");
    expect(tourHours({ first: "", last: "17:50" })).toBe("17:50");
  });

  it("숫자만 있는 요금은 단위를 몰라 보이지 않는다", () => {
    expect(tourFare({ fare: "88" })).toBeNull();
    expect(tourFare({ fare: "성인 5000원" })).toBe("성인 5000원");
    expect(tourFare({ fare: " " })).toBeNull();
  });

  it("넣을 장소가 있는 노선만 코스 도시가 있다", () => {
    for (const t of TOURS) {
      expect(t.city === null).toBe(t.placeIds.length === 0);
    }
  });
});

describe("routeOverflows (경로 접기 기준)", () => {
  it("잘린 높이가 1px보다 크면 접는다", () => {
    expect(routeOverflows(90, 67)).toBe(true);
    expect(routeOverflows(67, 67)).toBe(false);
    // 반올림 차이 1px는 넘친 것으로 보지 않는다
    expect(routeOverflows(68, 67)).toBe(false);
  });
});
