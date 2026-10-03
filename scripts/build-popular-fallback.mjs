#!/usr/bin/env node
// 홈 「지금 인기 관광지」의 수기 목록(서버에 공공데이터포털 키가 없거나 집중률 호출이 실패 · 비었을 때 보이는 대체 목록)을 만든다.
//   scripts/data/popular-manual.csv  → src/features/home/data/popular-fallback.json
//   열: city(홈 칩 도시) · rank(1~10) · id(플래너 장소 id) · evidence(근거: 한국관광 데이터랩 인기 관광지 순위 또는 수기)
// 장소 id는 플래너 장소(places.json + added-places.json)에 있어야 하고 그 도시 장소여야 한다. 숙박은 넣지 않는다.
// 사용법: node scripts/build-popular-fallback.mjs && npm run format
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./add-manual-places.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "src/features/planner/data");
const CSV = resolve(ROOT, "scripts/data/popular-manual.csv");
const OUT = resolve(ROOT, "src/features/home/data/popular-fallback.json");
/** 수기 조사 기준일 */
export const POPULAR_MANUAL_DATE = "2026-10-03";
/** 도시마다 적는 수 */
export const POPULAR_MANUAL_COUNT = 10;

/**
 * CSV 행 → 도시별 목록(순수 함수, 테스트용). 잘못된 행은 throw
 * @returns {{ date: string, cities: Record<string, { id: string, ko: string, en: string, evidence: string }[]> }}
 */
export function buildPopularFallback(rows, places, date = POPULAR_MANUAL_DATE) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const cities = {};
  for (const r of rows) {
    const city = r.city.trim();
    const id = r.id.trim();
    const p = byId.get(id);
    if (!p) throw new Error(`${city} ${id}: 플래너 장소에 없다`);
    if (p.locKo !== city)
      throw new Error(`${city} ${id} ${p.ko}: ${p.locKo} 장소다`);
    if (p.cat === "stay")
      throw new Error(`${city} ${id} ${p.ko}: 숙박은 넣지 않는다`);
    const list = (cities[city] ??= []);
    if (list.some((x) => x.id === id)) throw new Error(`${city} ${id}: 중복`);
    list.push({
      rank: Number(r.rank),
      id,
      ko: p.ko,
      en: p.en,
      evidence: r.evidence.trim(),
    });
  }
  for (const [city, list] of Object.entries(cities)) {
    list.sort((a, b) => a.rank - b.rank);
    if (list.length !== POPULAR_MANUAL_COUNT)
      throw new Error(
        `${city}: ${list.length}곳(${POPULAR_MANUAL_COUNT}곳이어야 한다)`,
      );
    if (list.some((x, i) => x.rank !== i + 1))
      throw new Error(`${city}: 순위가 1~${POPULAR_MANUAL_COUNT}이 아니다`);
    cities[city] = list.map(({ id, ko, en, evidence }) => ({
      id,
      ko,
      en,
      evidence,
    }));
  }
  return { date, cities };
}

function main() {
  const read = (f) => JSON.parse(readFileSync(resolve(DATA, f), "utf8"));
  const places = [...read("places.json"), ...read("added-places.json")];
  const rows = parseCsv(readFileSync(CSV, "utf8"));
  const out = buildPopularFallback(rows, places);
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  for (const [city, list] of Object.entries(out.cities))
    console.log(`${city}: ${list.map((x) => x.ko).join(" · ")}`);
  console.log(
    `썼다: ${OUT} (${Object.keys(out.cities).length}개 도시, 기준 ${out.date})`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
)
  main();
