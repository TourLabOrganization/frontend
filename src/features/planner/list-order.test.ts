import { describe, expect, it } from "vitest";
import { compareText, sortPlaces } from "./list-order";

type P = { id: string; name: string; city: string; popRank?: number };
const opts = (nation: boolean) => ({
  nation,
  name: (p: P) => p.name,
  city: (p: P) => p.city,
});
const ids = (list: P[]) => list.map((p) => p.id);

describe("플래너 목록 순서 (인기 먼저 + 나머지 가나다)", () => {
  const places: P[] = [
    { id: "a", name: "다", city: "경주" },
    { id: "b", name: "가", city: "경주" },
    { id: "c", name: "나", city: "경주", popRank: 5 },
    { id: "d", name: "라", city: "경주", popRank: 1 },
    { id: "e", name: "마", city: "경주", popRank: 5 },
  ];

  it("도시 안: 순위 오름차순이 먼저, 같은 순위는 이름순, 나머지는 이름순", () => {
    expect(ids(sortPlaces(places, opts(false)))).toEqual([
      "d",
      "c",
      "e",
      "b",
      "a",
    ]);
  });

  it("순위가 없는 도시는 이름순 그대로", () => {
    const plain = places.map((p) => ({ ...p, popRank: undefined }));
    expect(ids(sortPlaces(plain, opts(false)))).toEqual([
      "b",
      "c",
      "a",
      "d",
      "e",
    ]);
  });

  it("전국: 도시 이름 → 도시 안에서 인기 → 이름", () => {
    const nation: P[] = [
      { id: "g1", name: "가", city: "경주" },
      { id: "s1", name: "가", city: "서울", popRank: 2 },
      { id: "g2", name: "하", city: "경주", popRank: 9 },
      { id: "b1", name: "나", city: "부산" },
      { id: "s2", name: "나", city: "서울" },
    ];
    expect(ids(sortPlaces(nation, opts(true)))).toEqual([
      "g2",
      "g1",
      "b1",
      "s1",
      "s2",
    ]);
  });

  it("원래 배열은 바꾸지 않고, 비교는 대소문자를 가리지 않는다", () => {
    const before = ids(places);
    sortPlaces(places, opts(false));
    expect(ids(places)).toEqual(before);
    expect(compareText("abc", "ABD")).toBe(-1);
    expect(compareText("B", "b")).toBe(0);
  });
});
