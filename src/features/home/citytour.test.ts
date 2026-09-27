import { describe, expect, it } from "vitest";
import type { Answers } from "../recommend/questions";
import { classify, CLUSTER_IDS } from "../recommend/scoring";
import {
  type CityTour,
  CLUSTER_PREFS,
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

// ── 목업 원본(standalone 「Tour Navigator.html」 홈 renderVals)을 그대로 옮긴 비교 기준 ──
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
  R: {
    p: number;
    s2: number;
    pr: number;
    pr2: number;
    mix: boolean;
    cats: (number | "night")[];
  },
) {
  const CL = CLUSTER_IDS.map((c) => CLUSTER_PREFS[c]);
  const w1 = CL[R.p];
  const w2 = R.mix && CL[R.s2] ? CL[R.s2] : null;
  const a1 = R.pr || 100;
  const a2 = R.pr2 || 0;
  const sc = CT.map((x, i) => {
    const p = mockProf(x);
    let fit = p.v.reduce((s, y, k) => s + y * w1[k], 0);
    if (w2)
      fit =
        (a1 * fit + a2 * p.v.reduce((s, y, k) => s + y * w2[k], 0)) / (a1 + a2);
    const bonus =
      0.5 *
      R.cats.reduce<number>(
        (s, k) => s + (k === "night" ? p.night : p.v[k]),
        0,
      );
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
const Q4_CAT: Record<string, number | "night"> = {
  history: 0,
  nature: 1,
  sea: 4,
  "food-market": 3,
  activity: 2,
  night: "night",
};

const SAMPLES: Answers[] = [
  // 60대 · 배우자 · 천천히 · 역사 + 자연 → C4
  {
    q1: ["60s"],
    q2: ["spouse"],
    q3: ["relaxed"],
    q4: ["history", "nature"],
    q5: ["quiet"],
    q6: ["domestic"],
  },
  // 20대 · 친구 · 빡빡하게 · 야경 + 맛집
  {
    q1: ["20s"],
    q2: ["friends"],
    q3: ["packed"],
    q4: ["night", "food-market"],
  },
  // 섞기(1위 확률 50% 미만): 30대 · 아이 · 적당히 · 바다
  { q1: ["30s"], q2: ["kids-family"], q3: ["moderate"], q4: ["sea"] },
  // 해외 방문 · 드라마 + 체험
  {
    q1: ["teens"],
    q2: ["solo"],
    q3: ["packed"],
    q4: ["drama", "activity"],
    q6: ["overseas"],
  },
];

describe("recommendTours (내 유형 추천)", () => {
  it.each(SAMPLES.map((a, i) => [i, a] as const))(
    "목업 규칙과 같은 5개를 같은 순서로 고른다 (예시 %i)",
    (_, answers) => {
      const type = typeProfile(answers, "ko")!;
      const { clusters, mixed } = classify(answers, "ko");
      const R = {
        p: CLUSTER_IDS.indexOf(clusters[0].id),
        s2: CLUSTER_IDS.indexOf(clusters[1].id),
        pr: Math.round(clusters[0].probability * 100),
        pr2: Math.round(clusters[1].probability * 100),
        mix: mixed,
        cats: (answers.q4 ?? []).flatMap((o) =>
          o in Q4_CAT ? [Q4_CAT[o]] : [],
        ),
      };
      const rows = TOURS.map((t) => [t.region, t.name, "", "", t.route] as Row);
      const got = recommendTours(TOURS, type).map((t) => t.name);
      expect(got).toEqual(mockRec(rows, R));
      expect(got).toHaveLength(5);
    },
  );

  it("한 지역에서 한 노선만 고른다", () => {
    const got = recommendTours(TOURS, typeProfile(SAMPLES[0], "ko")!);
    expect(new Set(got.map((t) => t.region)).size).toBe(got.length);
  });

  it("60대 · 배우자 · 천천히 예시는 C4 70% · 섞지 않음 · 관심사 역사 · 자연", () => {
    expect(typeProfile(SAMPLES[0], "ko")).toEqual({
      primary: "C4",
      secondary: "C5",
      pr: 70,
      pr2: 25,
      mixed: false,
      tags: ["history", "nature"],
    });
  });

  it("필수 문항이 비면 유형이 없다", () => {
    expect(typeProfile({ q1: ["20s"] }, "ko")).toBeNull();
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
