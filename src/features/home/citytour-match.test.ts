import { describe, expect, it } from "vitest";
import {
  type MatchPlace,
  matchStops,
  normalizeName,
  splitStops,
  stopPool,
} from "./citytour-match";

const place = (
  id: string,
  ko: string,
  locKo: string,
  extra: Partial<MatchPlace> = {},
): MatchPlace => ({ id, ko, locKo, cat: "herit", ...extra });

describe("splitStops · normalizeName", () => {
  it("화살표 · 쉼표로 나누고 번호 · 괄호 · 소요 시간 · 머리말을 뗀다", () => {
    expect(
      splitStops(
        "1. 하당 → ①목포역(출발) → 갓바위 30분 소요 → 유달산, 노적봉 및 삼학도",
      ),
    ).toEqual(["하당", "목포역", "갓바위", "유달산", "노적봉", "삼학도"]);
    expect(splitStops("토요일: 하당 → 목포역")).toEqual(["하당", "목포역"]);
    expect(splitStops("인천역+화개정원+대룡시장")).toEqual([
      "인천역",
      "화개정원",
      "대룡시장",
    ]);
  });

  it("비교 이름에서 괄호 · 끝말 · 띄어쓰기를 뗀다", () => {
    expect(normalizeName("국립 경주 박물관(본관) 입구")).toBe("국립경주박물관");
    expect(normalizeName("부산역 출발")).toBe("부산역");
  });
});

describe("stopPool", () => {
  const places = [
    place("s1", "남산서울타워", "서울", { pickCity: "서울" }),
    place("s2", "광장시장", "서울"),
    place("g1", "봉선사", "가평"),
    place("x1", "어딘가", "진주"),
  ];

  it("전용 화면 도시는 도시 고르기 목록 장소(pickCity)만", () => {
    expect(stopPool("서울", places).map((p) => p.id)).toEqual(["s1"]);
  });

  it("다른 도시는 그 시군 장소, 없으면 전체", () => {
    expect(stopPool("가평", places).map((p) => p.id)).toEqual(["g1"]);
    expect(stopPool("부천", places)).toHaveLength(4);
  });
});

describe("matchStops", () => {
  const pool = [
    place("a", "불국사", "경주"),
    place("b", "경주 동궁과 월지", "경주", { ct: true }),
    place("c", "보문관광단지 호텔", "경주", { cat: "stay" }),
    place("d", "국립경주박물관", "경주"),
  ];

  it("같은 이름 → 시티투어 경유 장소 → 서로 품는 이름 순으로 찾고 관광지가 아닌 정류장은 건너뛴다", () => {
    const got = matchStops(
      "경주역(출발) → 불국사 → 동궁과월지 → 국립 경주 박물관 → 점심 → 첨성대 → 경주역(도착)",
      pool,
      "경주",
    );
    expect(got.ids).toEqual(["a", "b", "d"]);
    expect(got.missed).toEqual(["첨성대"]);
  });

  it("숙박 장소는 담지 않고, 같은 장소는 한 번만", () => {
    expect(
      matchStops("보문관광단지 호텔 → 불국사 → 불국사", pool, "경주").ids,
    ).toEqual(["a"]);
  });

  it("노선 지역 이름과 같은 경유지(출발 · 도착 도시)는 대조하지 않는다", () => {
    const seoul = [place("s1", "남산서울타워", "서울", { ct: true })];
    expect(matchStops("서울 → 대부도 → 서울", seoul, "서울")).toEqual({
      ids: [],
      missed: ["대부도"],
    });
  });

  it("부분 이름은 관광지를 먼저 보고, 경유지 이름이 앞부분일 뿐인 식당에는 대조하지 않는다", () => {
    const busan = [
      place("f1", "해운대가야밀면", "부산", { cat: "food" }),
      place("s1", "해운대해수욕장", "부산", { cat: "sea" }),
    ];
    expect(
      matchStops("부산역 → 해운대(미포) → 부산역", busan, "부산").ids,
    ).toEqual(["s1"]);
    expect(
      matchStops(
        "해운대",
        [place("f1", "해운대가야밀면", "부산", { cat: "food" })],
        "부산",
      ),
    ).toEqual({ ids: [], missed: ["해운대"] });
  });

  it("먹거리는 시장 · 거리 경유지, 이름 끝 대조, 시티투어 경유 장소일 때만 부분 이름으로 담는다", () => {
    const pool = [
      place("m", "교동대룡시장", "인천", { cat: "food" }),
      place("g", "부산 광복로", "부산", { cat: "food" }),
      place("c", "창원가로수길 카페거리", "창원", { cat: "food", ct: true }),
      place("r", "으능정이 스카이로드", "대전", { cat: "food" }),
    ];
    expect(
      matchStops("대룡시장 → 광복로 → 창원가로수길 → 으능정이", pool).ids,
    ).toEqual(["m", "g", "c"]);
  });

  it("후보가 여럿이면 이름이 가장 가까운 곳, 같은 순위면 애매해서 담지 않는다", () => {
    const pool = [
      place("a", "제부마리나 클럽하우스", "화성"),
      place("b", "제부도", "화성", { cat: "sea" }),
    ];
    expect(matchStops("제부", pool, "화성").ids).toEqual(["b"]);
    const tie = [
      place("x", "평화광장 분수", "목포"),
      place("y", "평화광장 공원", "목포"),
    ];
    expect(matchStops("평화광장", tie, "목포")).toEqual({
      ids: [],
      missed: ["평화광장"],
    });
  });
});
