#!/usr/bin/env node
// 도시 이름(5개 언어)을 한 표로 관리한다(scripts/data/city-names.csv, 2026-10-05).
//   열: ko(도시 key, regions.json 도시 이름) · en · zh · ja · es · source(원천(PoC) · 앱 번역)
//   - en → src/features/planner/data/regions.json cities[ko].en
//   - zh · ja · es → src/features/names/data/<언어>.json cities[ko]
//   - 표가 정답이다. 도시 이름을 고치거나 도시를 더하면 표만 고치고 이 스크립트를 돌린다(여러 번 돌려도 같다)
//   - scripts/build-planner.mjs(regions.json)와 scripts/build-names.mjs(이름표)도 쓰기 전에 이 표를 다시 덮는다
//   - 표에 없는 도시, 빈 칸, 한글이 섞인 외국어 이름은 멈춘다(scripts/city-names.test.ts도 같은 것을 본다)
//
// 사용법:
//   node scripts/city-names.mjs [--dry]
//   npm run format
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./apply-badge-lists.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TABLE = resolve(ROOT, "scripts/data/city-names.csv");
const REGIONS = resolve(ROOT, "src/features/planner/data/regions.json");
const NAMES = resolve(ROOT, "src/features/names/data");

export const CITY_NAME_LOCALES = ["en", "zh", "ja", "es"];
const HANGUL = /[ㄱ-ㆎ가-힣]/;

export function loadCityNames(path = TABLE) {
  return parseCsv(readFileSync(path, "utf8"));
}

/** 표의 문제(빈 칸 · 한글 · 겹친 도시 · 표에 없는 도시)를 문장 목록으로 돌려준다 */
export function cityNameProblems(rows, cities) {
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.ko)) out.push(`${r.ko}: 표에 두 번 있다`);
    seen.add(r.ko);
    for (const l of CITY_NAME_LOCALES) {
      const v = r[l]?.trim() ?? "";
      if (!v) out.push(`${r.ko}: ${l} 빈 칸`);
      else if (HANGUL.test(v)) out.push(`${r.ko}: ${l}에 한글 (${v})`);
    }
  }
  for (const c of cities) if (!seen.has(c)) out.push(`${c}: 표에 없다`);
  return out;
}

/**
 * regions.json 값과 이름표(zh · ja · es)에 표를 덮는다(제자리). 바뀐 칸 수.
 * tables: { zh: {cities}, ja: {cities}, es: {cities} } — 없는 언어는 건너뛴다
 */
export function applyCityNames(regions, tables, rows) {
  let changed = 0;
  for (const r of rows) {
    const city = regions.cities[r.ko];
    if (city && city.en !== r.en.trim()) {
      city.en = r.en.trim();
      changed++;
    }
    for (const l of ["zh", "ja", "es"]) {
      const t = tables[l];
      if (!t) continue;
      t.cities ??= {};
      if (t.cities[r.ko] !== r[l].trim()) {
        t.cities[r.ko] = r[l].trim();
        changed++;
      }
    }
  }
  return changed;
}

function main() {
  const dry = process.argv.includes("--dry");
  const rows = loadCityNames();
  const regions = JSON.parse(readFileSync(REGIONS, "utf8"));
  const cities = regions.regions.flatMap((r) => r.cities);
  const problems = cityNameProblems(rows, cities);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  const tables = Object.fromEntries(
    ["zh", "ja", "es"].map((l) => [
      l,
      JSON.parse(readFileSync(resolve(NAMES, `${l}.json`), "utf8")),
    ]),
  );
  const n = applyCityNames(regions, tables, rows);
  console.log(`도시 이름표 ${rows.length}행 · 바뀐 칸 ${n}`);
  if (dry) return console.log("--dry: 파일은 그대로");
  writeFileSync(REGIONS, JSON.stringify(regions, null, 2) + "\n", "utf8");
  for (const [l, t] of Object.entries(tables))
    writeFileSync(
      resolve(NAMES, `${l}.json`),
      JSON.stringify(t, null, 2) + "\n",
      "utf8",
    );
  console.log("썼다. npm run format 을 돌려 포맷을 맞추세요");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
