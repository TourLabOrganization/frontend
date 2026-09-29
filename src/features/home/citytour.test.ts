import { describe, expect, it } from "vitest";
import { decodeAnswers } from "../recommend/answers";
import { REFERENCE_CASES } from "../recommend/data/reference-cases";
import type { Answers } from "../recommend/survey";
import {
  type CityTour,
  courseScore,
  type CourseScoreProfile,
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

// 명세서 §15 예제(C4 · C5 복합형, 역사)
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

const SAMPLES: Answers[] = [
  MIXED,
  // 20대 · 친구와 · 빡빡하게 · 야경 · 핫플 · 저녁 + 인기 야간 명소
  {
    s1: "20s",
    s2: "friends",
    s3: "packed",
    s4: "night",
    s5: "trending",
    s6: "evening",
    b6: "a",
  },
  // 관심사 자료 없음(드라마): 10대 · 혼자 · 빡빡하게 + 실제 촬영지 → C7
  {
    s1: "teens",
    s2: "solo",
    s3: "packed",
    s4: "drama",
    s5: "trending",
    s6: "morning",
    b1: "a",
  },
  // 복합형(C2 · C1, BALANCED): 20대 · 친구와 · 적당히 · 바다 · 핫플 · 저녁 + 동행 사진
  {
    s1: "20s",
    s2: "friends",
    s3: "moderate",
    s4: "sea",
    s5: "trending",
    s6: "evening",
    b3: "c",
    f1: "balanced",
  },
  // 50대 · 부모님 · 적당히 · 맛집 · 한적한 곳 · 낮 + 지역 미식
  {
    s1: "50s",
    s2: "parents",
    s3: "moderate",
    s4: "food-market",
    s5: "quiet",
    s6: "daytime",
    b4: "a",
  },
];

const PROFILES = scoresData as (CourseScoreProfile | null)[];
const byId = new Map(
  PROFILES.flatMap((p, i) => (p ? [[p.id, TOURS[i]] as const] : [])),
);

describe("recommendTours (내 유형 추천, 명세서 §16 코스 점수)", () => {
  it("점수 자료는 citytour.json과 같은 순서의 280칸이고 분석 적격 234코스만 있다", () => {
    expect(PROFILES).toHaveLength(TOURS.length);
    const present = PROFILES.filter((p) => p !== null);
    expect(present).toHaveLength(234);
    for (const p of present) {
      expect(p.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(p.coverage, 8);
      expect(p.visits).toBeGreaterThanOrEqual(2);
    }
  });

  it("명세서 예제(C4 · C5 복합형, 역사 · 천천히): 해남 · 대전 생태교육 · 아산 · 순천 81.18, 천안 80.52", () => {
    const got = recommendTours(TOURS, typeProfile(MIXED)!, PROFILES);
    expect(got.map((t) => [t.region, t.name])).toEqual([
      ["해남", "해남시티투어"],
      ["대전", "생태교육"],
      ["아산", "역사기행 코스"],
      ["순천", "(기획투어)나이트가든투어"],
      ["천안", "목요일"],
    ]);
    const type = typeProfile(MIXED)!;
    const scores = got.map(
      (tour) => courseScore(PROFILES[TOURS.indexOf(tour)]!, type).score,
    );
    [81.179956, 81.179956, 81.179956, 81.179956, 80.51904].forEach((v, k) =>
      expect(scores[k]).toBeCloseTo(v, 5),
    );
  });

  it("가산 항이 없으면 점수는 범주 적합 100 · cos · 커버리지다", () => {
    const type = {
      ...typeProfile(SAMPLES[2])!,
      pace: null,
      eveningNight: false,
    };
    expect(type.tag).toBeNull();
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

  it("유형 요약: 명세서 예제는 C4 · C5, u = [0.321, 0.434, 0.028, 0.128, 0.090], 역사 · 천천히 · 저녁 가산 없음", () => {
    const type = typeProfile(MIXED)!;
    expect(type.types).toEqual(["C4", "C5"]);
    expect(type.tag).toBe("history");
    expect(type.pace).toBe("relaxed");
    expect(type.eveningNight).toBe(false);
    [0.32069, 0.434483, 0.027586, 0.127586, 0.089655].forEach((v, k) =>
      expect(type.preference[k]).toBeCloseTo(v, 5),
    );
  });

  it("S6 저녁 · 밤까지는 S4가 야경이 아닐 때만 야경 가산이다", () => {
    expect(typeProfile(SAMPLES[1])!.tag).toBe("night");
    expect(typeProfile(SAMPLES[1])!.eveningNight).toBe(false);
    expect(typeProfile(SAMPLES[3])!.eveningNight).toBe(true);
    expect(typeProfile(SAMPLES[3])!.pace).toBeNull();
  });

  it("드라마 · 공연 · 쇼핑 관심사는 경유지 분류가 없다", () => {
    expect(typeProfile(SAMPLES[2])!.tag).toBeNull();
    expect(typeProfile(SAMPLES[2])!.types).toEqual(["C7"]);
  });

  it("완료되지 않은 답 · 예전 15문항 기록이면 유형이 없다", () => {
    expect(typeProfile({ s1: "20s" })).toBeNull();
    expect(
      typeProfile(decodeAnswers("q1.60s~q2.spouse~q3.relaxed~q4.history")),
    ).toBeNull();
  });

  for (const [n, c] of REFERENCE_CASES.entries()) {
    it(`Python 참조 계산과 같은 지역 대표 5개 · 점수 (사례 ${n + 1})`, () => {
      const type = typeProfile(c.answers)!;
      const got = recommendTours(TOURS, type, PROFILES);
      expect(got).toEqual(c.tours.map((t) => byId.get(t.courseId)));
      got.forEach((tour, k) =>
        expect(
          courseScore(PROFILES[TOURS.indexOf(tour)]!, type).score,
        ).toBeCloseTo(c.tours[k].score, 9),
      );
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
    expect(counts.size).toBe(72);
    expect(counts.get("서울")).toBe(12);
    expect(counts.get("가평")).toBe(2);
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
