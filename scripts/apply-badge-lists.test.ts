import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyBadges,
  applyK100Details,
  k100Info,
  listIds,
  parseCsv,
} from "./apply-badge-lists.mjs";
import addedPlaces from "../src/features/planner/data/added-places.json";
import places from "../src/features/planner/data/places.json";
import course from "../src/features/course/data/places.json";

const read = (f: string) =>
  parseCsv(readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
const k100Rows = read("k100-list.csv");
const bfRows = read("open-tourism-list.csv");
const all = [...places, ...addedPlaces] as {
  id: string;
  k100: boolean;
  bf: boolean;
}[];

describe("한국관광 100선 · 열린관광지 명단 → 배지", () => {
  it("100선은 2025~2026 100건, 대응 장소가 없는 건 제주올레길뿐", () => {
    expect(k100Rows).toHaveLength(100);
    expect(new Set(k100Rows.map((r) => r.no)).size).toBe(100);
    expect(
      k100Rows.filter((r) => !r.placeIds.trim()).map((r) => r.name),
    ).toEqual(["제주올레길"]);
  });

  it("열린관광지는 2015~2026 연도별 선정지, 장소가 없는 건 주민 시설 1건", () => {
    const years = new Set(bfRows.map((r) => r.year));
    expect([...years].sort()).toEqual(
      Array.from({ length: 12 }, (_, i) => String(2015 + i)),
    );
    expect(bfRows.filter((r) => !r.placeIds.trim()).map((r) => r.name)).toEqual(
      ["행주송학커뮤니티센터"],
    );
  });

  it("표의 id는 모두 플래너 장소이고, 배지는 표의 장소에만 있다", () => {
    const k100 = listIds(k100Rows);
    const bf = listIds(bfRows);
    const ids = new Set(all.map((p) => p.id));
    expect([...k100, ...bf].filter((id) => !ids.has(id))).toEqual([]);
    expect(new Set(all.filter((p) => p.k100).map((p) => p.id))).toEqual(k100);
    expect(new Set(all.filter((p) => p.bf).map((p) => p.id))).toEqual(bf);
    for (const list of Object.values(course) as {
      id: string;
      k100: boolean;
      bf: boolean;
    }[][])
      for (const p of list) {
        expect(p.k100, p.id).toBe(k100.has(p.id));
        expect(p.bf, p.id).toBe(bf.has(p.id));
      }
  });

  it("applyBadges는 표에 없는 장소의 배지를 끈다", () => {
    const xs = [
      { id: "a", k100: true, bf: true },
      { id: "b", k100: false, bf: false },
    ];
    expect(applyBadges(xs, new Set(["b"]), new Set())).toBe(2);
    expect(xs).toEqual([
      { id: "a", k100: false, bf: false },
      { id: "b", k100: true, bf: false },
    ]);
  });

  it("100선 선정 정보: 판 · 명단 이름 · 그 건의 장소 수, 명단 밖 장소는 지운다", () => {
    const info = k100Info(k100Rows);
    expect(info.get("kd10")).toEqual({
      edition: "2025~2026",
      entry: "5대 고궁(경복궁·창덕궁·창경궁·덕수궁·종묘)",
      places: 5,
    });
    const d: Record<string, { k100?: unknown }> = {
      kd10: {},
      zz: { k100: { edition: "2023~2024", entry: "옛", places: 1 } },
    };
    expect(applyK100Details(d, info)).toBe(2);
    expect(d.zz.k100).toBeUndefined();
    expect(d.kd10.k100).toEqual(info.get("kd10"));
  });
});
