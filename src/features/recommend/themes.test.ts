import { describe, expect, it } from "vitest";
import type { ClusterId } from "./scoring";
import { rankThemes, type ScoreProfile, THEMES } from "./themes";

// 원본 calc2.py 출력과 대조한다.
// 입력: Tour-Navigator-App/테마 추천 알고리즘/src/calc2.py 의 users 목록 (군집, ints, night, ai)
//   ints → interests, night → night, ai가 숫자면 ageIndex(Q1 보기 index), 군집 문자열이면 외래객(ageIndex 없음)
// 기대값: calc2.py를 읽기 전용 복사본으로 돌려 얻은 U[사용자] 중 실제 테마 5개
//   (scratchpad/calc2run/fixtures.json). 각 행 = [테마, fit, 관심사가산, 지역보정, 최종],
//   calc2.py처럼 fit · 가산 · 최종은 소수 둘째 자리, 지역보정은 셋째 자리로 반올림한 값이다.
type Row = [string, number, number, number, number];
const USERS: {
  name: string;
  cluster: ClusterId;
  profile: ScoreProfile;
  rows: Row[];
}[] = [
  {
    name: "A 60대·배우자·천천히 (역사+자연)",
    cluster: "C4",
    profile: { interests: [0, 1], night: false, ageIndex: 5 },
    rows: [
      ["왕과 사는 남자", 0.31, 0.36, -0.001, 0.67],
      ["제주 K-Drama", 0.23, 0.3, 0.014, 0.54],
      ["RESCENE Route", 0.25, 0.25, 0.016, 0.51],
      ["케이팝 데몬 헌터스", 0.26, 0.26, -0.04, 0.48],
      ["부산 영화 기행", 0.19, 0.19, -0.034, 0.35],
    ],
  },
  {
    name: "B 40대·아이 가족 (체험+바다)",
    cluster: "C3",
    profile: { interests: [2, 4], night: false, ageIndex: 3 },
    rows: [
      ["부산 영화 기행", 0.18, 0.17, 0.0, 0.36],
      ["제주 K-Drama", 0.16, 0.17, -0.002, 0.33],
      ["RESCENE Route", 0.17, 0.16, 0.003, 0.33],
      ["왕과 사는 남자", 0.19, 0.12, 0.002, 0.31],
      ["케이팝 데몬 헌터스", 0.19, 0.11, -0.018, 0.28],
    ],
  },
  {
    name: "C 50대·친구·미식 (맛집+역사)",
    cluster: "C6",
    profile: { interests: [3, 0], night: false, ageIndex: 4 },
    rows: [
      ["케이팝 데몬 헌터스", 0.26, 0.27, -0.027, 0.5],
      ["RESCENE Route", 0.22, 0.26, 0.007, 0.48],
      ["부산 영화 기행", 0.23, 0.2, -0.011, 0.43],
      ["왕과 사는 남자", 0.15, 0.23, 0.001, 0.37],
      ["제주 K-Drama", 0.1, 0.11, 0.011, 0.22],
    ],
  },
  {
    name: "D 20대·연인·핫플 (바다+야경)",
    cluster: "C2",
    profile: { interests: [4], night: true, ageIndex: 1 },
    rows: [
      ["부산 영화 기행", 0.22, 0.17, 0.047, 0.43],
      ["제주 K-Drama", 0.21, 0.15, -0.018, 0.34],
      ["RESCENE Route", 0.19, 0.12, -0.016, 0.3],
      ["케이팝 데몬 헌터스", 0.18, 0.07, 0.05, 0.29],
      ["왕과 사는 남자", 0.14, 0.03, 0.003, 0.17],
    ],
  },
  {
    name: "E 해외 20대·혼자·K팝 (K팝+공연)",
    cluster: "C7",
    profile: { interests: [], night: false, ageIndex: null },
    rows: [
      ["케이팝 데몬 헌터스", 0.21, 0.0, 0.016, 0.23],
      ["부산 영화 기행", 0.19, 0.0, -0.023, 0.17],
      ["왕과 사는 남자", 0.19, 0.0, -0.038, 0.15],
      ["RESCENE Route", 0.2, 0.0, -0.05, 0.15],
      ["제주 K-Drama", 0.13, 0.0, -0.05, 0.08],
    ],
  },
  {
    name: "F 해외 30대·친구·뷰티 (맛집)",
    cluster: "C8",
    profile: { interests: [3], night: false, ageIndex: null },
    rows: [
      ["부산 영화 기행", 0.24, 0.13, -0.029, 0.34],
      ["케이팝 데몬 헌터스", 0.2, 0.13, 0.015, 0.34],
      ["RESCENE Route", 0.2, 0.1, -0.05, 0.24],
      ["제주 K-Drama", 0.21, 0.03, -0.05, 0.19],
      ["왕과 사는 남자", 0.14, 0.03, 0.002, 0.17],
    ],
  },
  {
    name: "G 해외 30대·가족·자연 (자연+바다)",
    cluster: "C9",
    profile: { interests: [1, 4], night: false, ageIndex: null },
    rows: [
      ["제주 K-Drama", 0.26, 0.35, 0.05, 0.66],
      ["부산 영화 기행", 0.22, 0.22, -0.03, 0.41],
      ["RESCENE Route", 0.18, 0.17, -0.05, 0.3],
      ["왕과 사는 남자", 0.14, 0.16, -0.05, 0.24],
      ["케이팝 데몬 헌터스", 0.15, 0.12, -0.032, 0.24],
    ],
  },
  {
    name: "H 해외 60대·배우자·역사 (역사+체험)",
    cluster: "C10",
    profile: { interests: [0, 2], night: false, ageIndex: null },
    rows: [
      ["왕과 사는 남자", 0.23, 0.32, 0.05, 0.6],
      ["RESCENE Route", 0.22, 0.23, 0.05, 0.49],
      ["케이팝 데몬 헌터스", 0.21, 0.25, 0.003, 0.47],
      ["부산 영화 기행", 0.19, 0.15, 0.05, 0.39],
      ["제주 K-Drama", 0.2, 0.12, -0.048, 0.28],
    ],
  },
];

const keyOf = (slug: string) => THEMES.find((t) => t.slug === slug)!.key;
const round = (x: number, digits: number) => Number(x.toFixed(digits));

describe("calc2.py 원본 출력과 일치", () => {
  for (const user of USERS) {
    it(user.name, () => {
      const ranked = rankThemes(
        [{ id: user.cluster, score: 0, probability: 1 }],
        false,
        THEMES,
        user.profile,
      );
      const actual: Row[] = ranked.map((t) => [
        keyOf(t.slug),
        round(t.evidence.breakdown.fit, 2),
        round(t.evidence.breakdown.interest, 2),
        round(t.evidence.breakdown.region, 3),
        round(t.score, 2),
      ]);
      expect(actual).toEqual(user.rows);
    });
  }
});
