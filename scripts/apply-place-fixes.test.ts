import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./apply-badge-lists.mjs";
import { applyFixes, placeCounts } from "./apply-place-fixes.mjs";
import addedPlaces from "../src/features/planner/data/added-places.json";
import places from "../src/features/planner/data/places.json";
import regions from "../src/features/planner/data/regions.json";

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
