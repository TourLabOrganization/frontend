#!/usr/bin/env node
// PoC(Tour Planner.dc.html)에 없는 도시 · 관문 · 출발지를 regions.json에 덧붙인다.
//   입력: scripts/data/manual-regions.json (사람이 적은 표, 출처는 docs/structure.md 「섬 여행」)
//     - regionCities: 권역 key → 그 권역 도시 목록 끝에 더할 도시
//     - cities · hubs · origins: regions.json 같은 칸에 그대로 넣을 값(같은 key가 있으면 그 자리에서 바꾼다)
//   출력: src/features/planner/data/regions.json
//
// 사용법:
//   node scripts/manual-regions.mjs   # 지금 regions.json에 덧붙인다(여러 번 돌려도 같다)
//   npm run format
// scripts/build-planner.mjs도 regions.json을 쓰기 전에 applyManualRegions를 불러, 다시 빌드해도 이 값이 남는다.
// 도시별 장소 수(placeCounts)는 넣지 않는다(장소를 더하는 스크립트 · merge-same-places.mjs가 센다).
//
// 지금 든 것: 백령도 · 연평도(인천 옹진군, 수도권). 인천항 연안여객터미널에서만 여객선이 떠나는 항구 섬(features/planner/island.ts)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANUAL = resolve(ROOT, "scripts/data/manual-regions.json");
const TARGET = resolve(ROOT, "src/features/planner/data/regions.json");

/** regions.json 값(regions · cities · hubs · origins)에 수기 표를 덧붙인다. 넘긴 값을 고치고 돌려준다 */
export function applyManualRegions(data, manual = loadManualRegions()) {
  for (const [key, list] of Object.entries(manual.regionCities ?? {})) {
    const region = data.regions.find((r) => r.key === key);
    if (!region) throw new Error(`manual-regions.json: 권역 ${key}가 없습니다`);
    for (const c of list) if (!region.cities.includes(c)) region.cities.push(c);
  }
  for (const field of ["cities", "hubs", "origins"])
    for (const [k, v] of Object.entries(manual[field] ?? {}))
      data[field][k] = v;
  return data;
}

export function loadManualRegions() {
  return JSON.parse(readFileSync(MANUAL, "utf8"));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const data = JSON.parse(readFileSync(TARGET, "utf8"));
  applyManualRegions(data);
  writeFileSync(TARGET, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote", TARGET);
}
