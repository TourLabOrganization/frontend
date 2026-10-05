import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./apply-badge-lists.mjs";
import {
  applyCourseCoords,
  applyFixes,
  applyNameFixes,
  placeCounts,
} from "./apply-place-fixes.mjs";
import addedPlaces from "../src/features/planner/data/added-places.json";
import places from "../src/features/planner/data/places.json";
import regions from "../src/features/planner/data/regions.json";
import course from "../src/features/course/data/places.json";

const fixes = parseCsv(
  readFileSync(new URL("./data/place-fixes.csv", import.meta.url), "utf8"),
);
const all = [...places, ...addedPlaces] as {
  id: string;
  locKo: string;
  pickCity?: string;
  lat: number;
  lng: number;
}[];

describe("장소 도시 · 좌표 수정 표", () => {
  it("표대로 데이터에 들어가 있다(대전 시티투어 경유지의 영동 · 금산 · 옥천 …)", () => {
    const byId = new Map(all.map((p) => [p.id, p]));
    for (const f of fixes) {
      const p = byId.get(f.id)!;
      expect(p, f.id).toBeDefined();
      if (f.city) expect([p.locKo, p.pickCity], f.id).toEqual([f.city, f.city]);
      if (f.lat)
        expect([p.lat, p.lng], f.id).toEqual([Number(f.lat), Number(f.lng)]);
    }
    expect(byId.get("ctm12e9fdbb")!.locKo).toBe("옥천");
  });

  it("테마 코스 장소에 같은 id가 있으면 그 좌표도 표대로다(광치기해변 · 흰여울문화마을 …)", () => {
    const fixed = new Map(fixes.filter((f) => f.lat).map((f) => [f.id, f]));
    const lists = Object.values(course) as {
      id: string;
      lat: number;
      lng: number;
    }[][];
    for (const p of lists.flat()) {
      const f = fixed.get(p.id);
      if (f)
        expect([p.lat, p.lng], p.id).toEqual([Number(f.lat), Number(f.lng)]);
    }
    const xs = { t: [{ id: "a", lat: 1, lng: 2 }] };
    expect(applyCourseCoords(xs, [{ id: "a", lat: "3", lng: "4" }])).toBe(1);
    expect(applyCourseCoords(xs, [{ id: "a", lat: "3", lng: "4" }])).toBe(0);
    expect(xs.t[0]).toEqual({ id: "a", lat: 3, lng: 4 });
  });

  it("이름 열이 있으면 장소 이름과 옮긴 이름 표를 고친다(주왕산온천관광호텔)", () => {
    const xs = [{ id: "a", ko: "옛 이름", en: "Old", locKo: "청송" }];
    const fix = { id: "a", ko: "새 이름", en: "New", zh: "新" };
    expect(applyFixes(xs, [fix], regions)).toBe(1);
    expect(xs[0]).toMatchObject({ ko: "새 이름", en: "New", locKo: "청송" });
    const zh = { a: "旧", b: "乙" };
    expect(applyNameFixes(zh, [fix], "zh")).toBe(1);
    expect(applyNameFixes(zh, [fix], "ja")).toBe(0);
    expect(zh).toEqual({ a: "新", b: "乙" });
    const p = (all as { id: string; ko?: string }[]).find(
      (q) => q.id === "rs284",
    );
    expect(p?.ko).toBe("주왕산온천관광호텔");
  });

  it("도시를 바꾸면 권역도 그 도시 것으로, 장소 수는 pickCity로 센다", () => {
    const xs = [
      {
        id: "a",
        locKo: "대전",
        pickCity: "대전",
        macro: "chungcheong",
        lat: 1,
        lng: 2,
      },
    ];
    expect(
      applyFixes(xs, [{ id: "a", city: "화성", lat: "", lng: "" }], regions),
    ).toBe(1);
    expect(xs[0]).toMatchObject({
      locKo: "화성",
      pickCity: "화성",
      macro: "capital",
    });
    expect(placeCounts(xs)).toEqual({ 화성: 1 });
    expect(regions.placeCounts).toEqual(placeCounts(all));
  });
});
