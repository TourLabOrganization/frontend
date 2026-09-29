import { describe, expect, it } from "vitest";
import { cityName, CITY_INFO, regionName, REGIONS } from "../planner/regions";
import { placeName } from "../theme/place-meta";
import es from "./data/es.json";
import ja from "./data/ja.json";
import zh from "./data/zh.json";
import plannerPlaces from "../planner/data/places.json";
import appEs from "../translations/data/place-names.es.json";
import appJa from "../translations/data/place-names.ja.json";
import appZh from "../translations/data/place-names.zh.json";
import { loadAppPlaceNames, loadNameTable } from "./server";

describe("언어별 이름표 (features/names)", () => {
  const place = { id: "gj1", ko: "효우당", en: "Hyowoodang" };

  it("중 · 일은 공식 명칭, 없으면 영어 → 한국어로 떨어진다", () => {
    expect(placeName(place, "zh", zh)).toBe(zh.places.gj1);
    expect(placeName(place, "ja", ja)).toBe(ja.places.gj1);
    expect(placeName({ ...place, id: "없는-id" }, "zh", zh)).toBe("Hyowoodang");
    expect(placeName({ id: "x", ko: "효우당", en: "" }, "ja", ja)).toBe(
      "효우당",
    );
    expect(placeName(place, "es", es)).toBe("Hyowoodang");
    expect(placeName(place, "ko", zh)).toBe("효우당");
  });

  it("권역 · 도시는 PoC 표기(REG · CITY_NAME), 없으면 영어", () => {
    const capital = REGIONS.find((r) => r.key === "capital")!;
    expect(regionName(capital, "zh", zh)).toBe("首都圈");
    expect(regionName(capital, "es", es)).toBe("Área Metropolitana de Seúl");
    expect(cityName("서울", "ja", ja)).toBe("ソウル");
    const noZh = Object.keys(CITY_INFO).find((c) => !(c in zh.cities));
    if (noZh) expect(cityName(noZh, "zh", zh)).toBe(CITY_INFO[noZh].en || noZh);
  });

  it("권역 7개가 세 언어 모두 있다", () => {
    for (const table of [zh, ja, es])
      expect(Object.keys(table.regions).sort()).toEqual(
        REGIONS.map((r) => r.key).sort(),
      );
  });

  it("한국어 · 영어 화면은 이름표를 싣지 않는다", async () => {
    for (const locale of ["ko", "en"]) {
      const table = await loadNameTable(locale);
      expect(Object.keys(table.places)).toHaveLength(0);
      expect(Object.keys(table.cities)).toHaveLength(0);
    }
    // 중국어 화면: 공식 명칭 + 앱이 옮긴 이름 = 모든 플래너 장소
    expect(Object.keys((await loadNameTable("zh")).places).length).toBe(
      Object.keys(zh.places).length + Object.keys(appZh).length,
    );
  });
});

describe("앱이 옮긴 장소 이름 (translations/data/place-names.<언어>.json)", () => {
  const ids = plannerPlaces.map((p) => p.id);
  const tables = [
    [
      "zh",
      appZh as Record<string, string>,
      zh.places as Record<string, string>,
    ],
    [
      "ja",
      appJa as Record<string, string>,
      ja.places as Record<string, string>,
    ],
    [
      "es",
      appEs as Record<string, string>,
      es.places as Record<string, string>,
    ],
  ] as const;

  it.each(tables)("%s: 한글 없음 · 빈 값 없음 · 모르는 id 없음", (_, app) => {
    const known = new Set(ids);
    for (const [id, name] of Object.entries(app)) {
      expect(known.has(id), id).toBe(true);
      expect(name.trim(), id).toBe(name);
      expect(name.length, id).toBeGreaterThan(0);
      expect(/[ㄱ-ㆎ가-힣]/.test(name), `${id} ${name}`).toBe(false);
    }
  });

  it.each(tables)(
    "%s: 공식 명칭이 없는 장소만 채우고, 둘을 합치면 모든 플래너 장소에 이름이 있다",
    (_, app, official) => {
      for (const id of Object.keys(app))
        expect(Object.hasOwn(official, id), id).toBe(false);
      const missing = ids.filter(
        (id) => !Object.hasOwn(app, id) && !Object.hasOwn(official, id),
      );
      expect(missing).toEqual([]);
    },
  );

  it("이름표는 공식 명칭 → 앱이 옮긴 이름 순으로 합친다", async () => {
    const table = await loadNameTable("zh");
    const officialId = Object.keys(zh.places)[0];
    const appId = Object.keys(appZh)[0];
    expect(table.places[officialId]).toBe(
      (zh.places as Record<string, string>)[officialId],
    );
    expect(table.places[appId]).toBe((appZh as Record<string, string>)[appId]);
    expect(await loadAppPlaceNames("en")).toEqual({});
    expect(await loadNameTable("en")).toEqual(await loadNameTable("ko"));
  });
});
