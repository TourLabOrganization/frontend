import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mergeDetail,
  mergeNames,
  mergePlace,
  placeCounts,
  readSamePlaces,
  withAliases,
  withDroppedNames,
} from "./merge-same-places.mjs";
import addedPlaces from "../src/features/planner/data/added-places.json";
import aliases from "../src/features/planner/data/place-aliases.json";
import details from "../src/features/planner/data/place-details.json";
import places from "../src/features/planner/data/places.json";
import signgu from "../src/features/planner/data/signgu.json";

const CSV = readFileSync(
  new URL("./data/same-places.csv", import.meta.url),
  "utf8",
);

describe("같은 장소 통합(scripts/data/same-places.csv · merge-same-places.mjs)", () => {
  const pairs = readSamePlaces(CSV);
  const all = [...places, ...addedPlaces];
  const ids = new Set(all.map((p) => p.id));

  it("표의 keep은 데이터에 있고 drop은 없다. drop → keep이 place-aliases.json과 같다", () => {
    expect(pairs.length).toBeGreaterThan(0);
    for (const [keep, drop] of pairs) {
      expect(ids.has(keep), keep).toBe(true);
      expect(ids.has(drop), drop).toBe(false);
      expect(aliases[drop as keyof typeof aliases], drop).toBe(keep);
    }
    expect(Object.keys(aliases).sort()).toEqual(
      [...new Set(pairs.map(([, drop]) => drop))].sort(),
    );
  });

  it("뺀 장소는 상세 · 시군구 표에도 없고, 남긴 장소는 둘 다 있다", () => {
    for (const [keep, drop] of pairs) {
      expect(drop in details, drop).toBe(false);
      expect(drop in signgu, drop).toBe(false);
      expect(keep in details, keep).toBe(true);
      expect(keep in signgu, keep).toBe(true);
    }
  });

  it("같은 도시에 정규화한 이름이 같은 장소가 없다(앞의 도시 이름도 뗀다: 「부여 무량사」 = 「무량사」)", () => {
    const norm = (s: string, city: string) => {
      let k = s
        .replace(/\(.*?\)|\[.*?\]/g, "")
        .replace(/[\s·\-_.,'"]/g, "")
        .toLowerCase();
      if (k.startsWith(city) && k.length > city.length + 1)
        k = k.slice(city.length);
      return k;
    };
    const seen = new Map<string, string>();
    for (const p of all) {
      if (p.cat === "stay") continue;
      const key = `${p.locKo}|${norm(p.ko, p.locKo)}`;
      expect(
        seen.get(key),
        `${p.id} ${p.ko} = ${seen.get(key)}`,
      ).toBeUndefined();
      seen.set(key, p.id);
    }
  });

  it("mergePlace: keep에 없는 값만 옮긴다(인기 순위는 작은 쪽, 표식은 OR, off는 둘 다일 때만)", () => {
    const keep = {
      popRank: 50,
      n: null,
      hrs: "",
      open: null,
      close: null,
      yt: false,
      k100: true,
      un: false,
      bf: false,
      off: true,
      locKo: "서울",
    } as Parameters<typeof mergePlace>[0];
    const drop = {
      popRank: 7,
      n: 3,
      hrs: "09:00–18:00",
      open: 540,
      close: 1080,
      yt: true,
      k100: false,
      un: false,
      bf: false,
      off: false,
      vz: "관광특구",
    } as Parameters<typeof mergePlace>[1];
    const changed = mergePlace(keep, drop);
    expect(keep).toMatchObject({
      popRank: 7,
      n: 3,
      hrs: "09:00–18:00",
      open: 540,
      close: 1080,
      yt: true,
      k100: true,
      off: false,
      vz: "관광특구",
      pickCity: "서울",
    });
    expect(changed).toEqual([
      "popRank",
      "n",
      "hrs",
      "open",
      "close",
      "vz",
      "yt",
      "off",
      "pickCity",
    ]);
    expect(mergePlace(keep, drop)).toEqual([]);
  });

  it("mergeDetail: 설명은 언어별로, ct · rs는 OR, 나머지는 keep에 없을 때만", () => {
    expect(
      mergeDetail(
        { desc: { ko: "가" }, src: { ko: "출처" }, url: "" },
        { desc: { ko: "나", en: "B" }, img: "i.jpg", ct: true, url: "u" },
      ),
    ).toEqual({
      desc: { ko: "가", en: "B" },
      src: { ko: "출처" },
      url: "u",
      img: "i.jpg",
      ct: true,
    });
    expect(mergeDetail(undefined, { rs: true })).toEqual({ rs: true });
  });

  it("mergeNames: 공식 명칭이 앱 이름보다 앞이고 두 표의 id가 겹치지 않는다", () => {
    const off: Record<string, string> = { d1: "官方" };
    const app: Record<string, string> = { k1: "应用", d1: "应用d" };
    mergeNames(off, app, "k1", "d1");
    expect(off).toEqual({ k1: "官方" });
    expect(app).toEqual({});
    const app2: Record<string, string> = { d2: "应用d" };
    mergeNames({}, app2, "k2", "d2");
    expect(app2).toEqual({ k2: "应用d" });
    const app3: Record<string, string> = { d3: "x" };
    mergeNames(null, app3, "k3", "d3"); // 영어 표: 옮기지 않고 지운다
    expect(app3).toEqual({});
  });

  it("withDroppedNames: 표에 없는 뺀 장소 이름만 더하고 한글 섞인 영어는 넣지 않는다", () => {
    expect(
      withDroppedNames({ 서울숲: "Seoul Forest" }, [
        { ko: "서울숲", en: "Seoul Forest Park" },
        { ko: "장릉", en: "Yeongwol Jangneung Royal Tomb" },
        { ko: "황남빵", en: "황남빵" },
        { ko: "전등사", en: "Jeondeungsa 사" },
      ]),
    ).toEqual({
      서울숲: "Seoul Forest",
      장릉: "Yeongwol Jangneung Royal Tomb",
    });
  });

  it("withAliases: 사슬은 끝까지 따라가고 키 순서로 정렬한다", () => {
    expect(
      withAliases({ z: "y" }, [
        ["y", "x"],
        ["b", "a"],
      ]),
    ).toEqual({ a: "b", x: "y", z: "y" });
  });

  it("placeCounts: pickCity 수, 기존 키 순서 유지, 0인 도시는 뺀다", () => {
    expect(
      placeCounts(
        [{ pickCity: "부산" }, { pickCity: "서울" }, { pickCity: "부산" }, {}],
        { 서울: 9, 대구: 1 },
      ),
    ).toEqual({ 서울: 1, 부산: 2 });
  });
});
