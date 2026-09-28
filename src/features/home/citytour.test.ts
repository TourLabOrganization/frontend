import { describe, expect, it } from "vitest";
import { decodeAnswers } from "../recommend/answers";
import { type Answers, evaluate } from "../recommend/survey";
import { indirectPreference } from "../recommend/theme-index";
import {
  type CityTour,
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

const TOURS = toursData as CityTour[];

// ── 목업 원본(standalone 「Tour Navigator.html」 홈 renderVals)을 옮긴 비교 기준. 적합도만 간접 선호 u의 내적으로 바꿨다 ──
const KW = [
  /궁|성곽|읍성|산성|사찰|[가-힣]사$|향교|서원|박물관|유적|고분|릉|왕|역사|문화재|한옥|민속|전통|사지|탑|기념관/,
  /산$|산 |숲|수목원|공원|호수|저수지|계곡|습지|정원|폭포|자연|생태|휴양림|둘레길|꽃|농원|수변/,
  /체험|테마파크|랜드|케이블카|레일|짚|루지|월드|과학관|전망대|스카이|목장|놀이/,
  /시장|먹거리|맛|음식|카페|막걸리|와이너리|양조|빵|맥주|술/,
  /해수욕장|해변|[가-힣]항$|바다|섬|포구|해안|등대|해상|해양|방조제/,
];
type Row = [string, string, string, string, string];
function mockProf(x: Row) {
  const st = String(x[4] || "")
    .split(/→|->|-|,|·/)
    .map((t) => t.replace(/\(.*?\)/g, "").trim())
    .filter(Boolean);
  const v = [0, 0, 0, 0, 0];
  st.forEach((t) =>
    KW.forEach((r, k) => {
      if (r.test(t)) v[k]++;
    }),
  );
  const n = Math.max(1, st.length);
  const night = /야간|야경|나이트|밤|야시장|달빛|별빛/.test(x[1] + x[4])
    ? 1
    : 0;
  return { v: v.map((y) => y / n), night, stops: st.length };
}
function mockRec(
  CT: Row[],
  R: { u: readonly number[]; cat: number | "night" | null },
) {
  const sc = CT.map((x, i) => {
    const p = mockProf(x);
    const fit = p.v.reduce((s, y, k) => s + y * R.u[k], 0);
    const bonus =
      0.5 * (R.cat === null ? 0 : R.cat === "night" ? p.night : p.v[R.cat]);
    return { x, i, s: fit + bonus + (p.stops >= 3 ? 0.02 : 0) };
  }).sort((a, b) => b.s - a.s);
  const seen: Record<string, 1> = {};
  const rec: Row[] = [];
  for (const z of sc) {
    if (seen[z.x[0]]) continue;
    seen[z.x[0]] = 1;
    rec.push(z.x);
    if (rec.length >= 5) break;
  }
  return rec.map((x) => x[1]);
}
/** S4 관심사 → 목업 분류 index(역사 0 · 자연 1 · 체험 2 · 먹거리 3 · 바다 4, 야경). 드라마 · 공연 · 쇼핑은 없다 */
const S4_CAT: Record<string, number | "night"> = {
  history: 0,
  nature: 1,
  sea: 4,
  "food-market": 3,
  activity: 2,
  night: "night",
};

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

describe("recommendTours (내 유형 추천)", () => {
  it.each(SAMPLES.map((a, i) => [i, a] as const))(
    "목업 규칙(적합도 = 분류 비율 · u)과 같은 5개를 같은 순서로 고른다 (예시 %i)",
    (_, answers) => {
      const type = typeProfile(answers)!;
      const result = evaluate(answers);
      if (result.status !== "complete") throw new Error("incomplete");
      const R = {
        u: indirectPreference(result),
        cat: S4_CAT[answers.s4!] ?? null,
      };
      const rows = TOURS.map((t) => [t.region, t.name, "", "", t.route] as Row);
      const got = recommendTours(TOURS, type).map((t) => t.name);
      expect(got).toEqual(mockRec(rows, R));
      expect(got).toHaveLength(5);
    },
  );

  it("한 지역에서 한 노선만 고른다", () => {
    const got = recommendTours(TOURS, typeProfile(MIXED)!);
    expect(new Set(got.map((t) => t.region)).size).toBe(got.length);
  });

  it("명세서 예제는 C4 · C5 복합형 · u = [0.3, 0.45, 0.025, 0.125, 0.1] · 관심사 역사", () => {
    const type = typeProfile(MIXED)!;
    expect(type.types).toEqual(["C4", "C5"]);
    expect(type.tag).toBe("history");
    [0.3, 0.45, 0.025, 0.125, 0.1].forEach((v, k) =>
      expect(type.preference[k]).toBeCloseTo(v, 10),
    );
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
