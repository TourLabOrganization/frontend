import { describe, expect, it } from "vitest";
import { getThemePlaces } from "../course/places";
import cities from "./data/cities.json";
import { corePlaces } from "./place-meta";
import {
  cityGroups,
  displayNumbers,
  distanceLabel,
  hasViews,
  haversineKm,
  inCity,
  orderByCities,
  scopeCity,
  searchCards,
  sortCards,
  type ThemeCity,
} from "./place-list";

const YEONGWOL = cities["kings-warden"][0];
const RESCENE: readonly ThemeCity[] = cities["rescene-route"];

describe("haversineKm · distanceLabel", () => {
  it("같은 점은 0", () => {
    expect(haversineKm(YEONGWOL, YEONGWOL)).toBe(0);
  });

  it("목업 영월 목록과 같은 거리(도시 center에서 장소까지)", () => {
    const core = corePlaces(getThemePlaces("kings-warden"));
    // 목업(9/27 warden.html) 지도 탭: 청령포 2.7 · 관풍헌 1.3 · 영월 장릉 0.8 · 선돌 3.3 · 어라연 8.1 km
    expect(core.map((p) => distanceLabel(p, YEONGWOL))).toEqual([
      "2.7",
      "1.3",
      "0.8",
      "3.3",
      "8.1",
    ]);
  });

  it("도시가 섞인 보기(null)에서는 거리를 보이지 않는다", () => {
    expect(distanceLabel(YEONGWOL, null)).toBeNull();
  });
});

describe("scopeCity · inCity", () => {
  it("도시가 하나뿐인 테마는 고르지 않아도 그 도시", () => {
    expect(scopeCity([YEONGWOL], null)).toBe(YEONGWOL);
  });

  it("여러 도시 테마는 고른 도시, 고르지 않으면 전국(null)", () => {
    expect(scopeCity(RESCENE, "경주")?.en).toBe("Gyeongju");
    expect(scopeCity(RESCENE, null)).toBeNull();
    expect(scopeCity(RESCENE, "없는 도시")).toBeNull();
  });

  it("RESCENE 도시 칩은 목업 순서(거제 · 경주) 뒤에 전국 목록의 나머지 도시(PoC 장소 목록 순서)", () => {
    expect(RESCENE.map((c) => c.ko)).toEqual([
      "거제",
      "경주",
      "수원",
      "정선",
      "대전",
      "충주",
      "동해",
    ]);
    // 더한 도시는 영어 이름 · 좌표가 투어 플래너 도시 값(regions.json)
    expect(RESCENE.find((c) => c.ko === "수원")).toEqual({
      ko: "수원",
      en: "Suwon",
      lat: 37.2827,
      lng: 127.0123,
    });
  });

  it("고른 도시의 장소만 남긴다", () => {
    const places = getThemePlaces("rescene-route");
    expect(places.filter((p) => inCity(p, null))).toHaveLength(places.length);
    expect(corePlaces(places).filter((p) => inCity(p, "경주"))).toHaveLength(7);
    expect(corePlaces(places).filter((p) => inCity(p, "거제"))).toHaveLength(
      14,
    );
    // 더한 도시 칩: 수원 5 · 정선 2 · 대전 4 · 충주 2 · 동해 2
    expect(
      ["수원", "정선", "대전", "충주", "동해"].map(
        (c) => corePlaces(places).filter((p) => inCity(p, c)).length,
      ),
    ).toEqual([5, 2, 4, 2, 2]);
  });
});

describe("cityGroups", () => {
  it("RESCENE 핵심 장소 36곳을 도시 순서대로 묶는다", () => {
    const groups = cityGroups(corePlaces(getThemePlaces("rescene-route")));
    expect(groups.slice(0, 2)).toEqual([
      { city: "경주", count: 7 },
      { city: "거제", count: 14 },
    ]);
    expect(groups.reduce((s, g) => s + g.count, 0)).toBe(36);
  });

  it("빈 목록은 빈 묶음", () => {
    expect(cityGroups([])).toEqual([]);
  });
});

describe("orderByCities", () => {
  it("RESCENE 전국 목록은 도시 칩 순서(거제 · 경주 · 수원 · 정선 · 대전 · 충주 · 동해)로 묶는다", () => {
    const core = corePlaces(getThemePlaces("rescene-route"));
    const ordered = orderByCities(core, RESCENE);
    const groups = cityGroups(ordered);
    expect(groups).toEqual([
      { city: "거제", count: 14 },
      { city: "경주", count: 7 },
      { city: "수원", count: 5 },
      { city: "정선", count: 2 },
      { city: "대전", count: 4 },
      { city: "충주", count: 2 },
      { city: "동해", count: 2 },
    ]);
    // 같은 도시 안에서는 번호 순서 그대로
    expect(ordered.slice(0, 3).map((p) => p.n)).toEqual([8, 9, 10]);
    expect(ordered).toHaveLength(core.length);
  });

  it("칩이 없거나 한 도시면 순서를 바꾸지 않는다", () => {
    const core = corePlaces(getThemePlaces("rescene-route"));
    expect(orderByCities(core, [])).toEqual(core);
  });

  it("칩에 없는 도시는 원래 순서대로 뒤에 둔다", () => {
    const core = corePlaces(getThemePlaces("rescene-route"));
    const groups = cityGroups(orderByCities(core, RESCENE.slice(0, 2)));
    expect(groups.slice(0, 2).map((g) => g.city)).toEqual(["거제", "경주"]);
    expect(groups.slice(2)).toEqual(cityGroups(core).slice(2));
  });
});

describe("sortCards", () => {
  const cards = [
    { id: "a", date: "2026.06.01", views: 10 },
    { id: "b", date: "2026.08.01" },
    { id: "c", date: "2026.07.01", views: 30 },
  ];
  const ids = (list: { id: string }[]) => list.map((c) => c.id);

  it("장면순은 그대로, 역순은 뒤집는다(원본은 그대로)", () => {
    expect(ids(sortCards(cards, "asc"))).toEqual(["a", "b", "c"]);
    expect(ids(sortCards(cards, "desc"))).toEqual(["c", "b", "a"]);
    expect(ids(cards)).toEqual(["a", "b", "c"]);
  });

  it("인기순은 조회수 큰 순, 조회수 없는 영상은 뒤", () => {
    expect(ids(sortCards(cards, "popular"))).toEqual(["c", "a", "b"]);
  });

  it("최신순은 게시일 늦은 순", () => {
    expect(ids(sortCards(cards, "latest"))).toEqual(["b", "c", "a"]);
  });

  it("조회수가 하나라도 있어야 인기순을 둔다", () => {
    expect(hasViews(cards)).toBe(true);
    expect(hasViews([{ date: "2026.01.01" }])).toBe(false);
  });
});

describe("searchCards", () => {
  const cards = [
    { id: "1", texts: ["강을 건너", "청령포", "Cheongnyeongpo"] },
    { id: "2", texts: ["유배지", "관풍헌"] },
  ];

  it("띄어쓰기 · 대소문자를 무시하고 장면 · 장소 이름으로 찾는다", () => {
    expect(searchCards(cards, "강을건너").map((c) => c.id)).toEqual(["1"]);
    expect(searchCards(cards, "cheong").map((c) => c.id)).toEqual(["1"]);
    expect(searchCards(cards, "관풍").map((c) => c.id)).toEqual(["2"]);
  });

  it("빈 검색어는 모두", () => {
    expect(searchCards(cards, "  ")).toHaveLength(2);
  });
});

describe("displayNumbers", () => {
  it("RESCENE은 도시 칩 순서(거제부터) 1번부터, 같은 도시 안은 원래 순번 순서", () => {
    const places = getThemePlaces("rescene-route");
    const numbers = displayNumbers(places, RESCENE);
    const ordered = orderByCities(corePlaces(places), RESCENE);
    expect(ordered[0].locKo).toBe("거제");
    expect(numbers.get(ordered[0].id)).toBe(1);
    // 핵심 장소 수만큼 1 … N이 빠짐없이 한 번씩
    expect([...numbers.values()].sort((a, b) => a - b)).toEqual(
      ordered.map((_, i) => i + 1),
    );
    // 목록 밖 장소(off)는 번호가 없다
    for (const p of places.filter((x) => x.off))
      expect(numbers.has(p.id)).toBe(false);
  });

  it("한 도시 테마는 원래 순번 순서 그대로 1번부터", () => {
    const places = getThemePlaces("kings-warden");
    const numbers = displayNumbers(places, [YEONGWOL]);
    expect(corePlaces(places).map((p) => numbers.get(p.id))).toEqual(
      corePlaces(places).map((_, i) => i + 1),
    );
  });
});
