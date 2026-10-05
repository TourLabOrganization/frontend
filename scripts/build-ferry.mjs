#!/usr/bin/env node
// 투어 플래너 코스 탭 「배편 시간표」 카드의 항로 · 운항 실적을 만든다.
//   src/features/planner/data/ferry.json
//
// 사용법:
//   node scripts/build-ferry.mjs <Tour Planner.dc.html>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천: Tour Planner.dc.html
//   - `const FERRY_ROUTES={ jeju:[…], ulleung:[…] };` 섬별 출발 항구(선사 · 소요 · 운항 횟수 · 첫 · 막 출항 · 도착 항구, 한국어 · 영어)
//   - `const FERRY_STATS={…};` 항로별 운항 실적. PoC 주석: 한국해양교통안전공단 항로별 여객선 운항상황
//     (odcloud 15146814, 2022-12 ~ 2026-05 실적 중 제주 · 울릉 항로 집계). ctrl = 통제(결항)율 %, mon = 월별 통제율 %,
//     times = 2025-06 이후 자주 쓰인 출항 시각, ships = 선박, from · to = 기간, n = 항차 수
//
// 수기 항로: scripts/data/ferry-manual.json
//   - PoC에 없는 항구 섬 항로(백령도 · 연평도, 인천항 연안여객터미널). PoC 항로 뒤에 섬 key로 덧붙인다.
//     칸은 PoC 항로와 같고, 영어 도착 항구(arrEn)를 더 적는다(PoC 영어 표기 규칙이 울릉 항구 이름만 바꿔서다). 운항 실적은 없다
//
// 규칙:
//   - PoC 값은 PoC 그대로 옮긴다(지어내지 않는다). 영어 표기 바꾸기(「무렵」 빼기 · 「/day」 등)는 화면 쪽(features/planner/ferry.ts)이 PoC ferryVals 식으로 한다
//   - 중 · 일 · 스페인어 값은 PoC에 없어 화면이 영어 값을 쓴다

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const [, , plannerPath] = process.argv;
if (!plannerPath) {
  console.error("사용법: node scripts/build-ferry.mjs <Tour Planner.dc.html>");
  process.exit(1);
}

const lines = readFileSync(plannerPath, "utf8").split("\n");

/** `const NAME=` 줄부터 끝(`};`)까지 떼어 값으로 읽는다. oneLine이면 그 줄 하나 */
function readConst(name, oneLine) {
  const re = new RegExp(`^const ${name}\\s*=`);
  const start = lines.findIndex((l) => re.test(l));
  if (start < 0) throw new Error(`Tour Planner.dc.html에 ${name}가 없습니다`);
  const end = oneLine
    ? start
    : lines.findIndex((l, i) => i > start && /^};/.test(l));
  if (end < 0)
    throw new Error(`Tour Planner.dc.html의 ${name} 끝을 찾지 못했습니다`);
  return vm.runInNewContext(
    `${lines.slice(start, end + 1).join("\n")}\n;${name}`,
  );
}

const FERRY_STATS = readConst("FERRY_STATS", true);
const FERRY_ROUTES = readConst("FERRY_ROUTES", false);

const ROUTE_FIELDS = [
  "k",
  "ko",
  "en",
  "op",
  "opEn",
  "dur",
  "durEn",
  "day",
  "first",
  "last",
  "arr",
];
const STAT_FIELDS = [
  "route",
  "ctrl",
  "mon",
  "times",
  "ships",
  "from",
  "to",
  "n",
];

const manual = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "data/ferry-manual.json"),
    "utf8",
  ),
);

const routes = {};
for (const island of ["jeju", "ulleung"]) {
  const list = FERRY_ROUTES[island];
  if (!Array.isArray(list) || list.length === 0)
    throw new Error(`FERRY_ROUTES.${island}가 비어 있습니다`);
  routes[island] = list.map((r) => {
    const row = {};
    for (const f of ROUTE_FIELDS) {
      if (typeof r[f] !== "string" || r[f] === "")
        throw new Error(`FERRY_ROUTES.${island} ${r.k}의 ${f}가 없습니다`);
      row[f] = r[f];
    }
    return row;
  });
}

// 수기 항로(PoC에 없는 섬). 같은 섬이 PoC에 생기면 PoC 값을 쓰도록 멈춘다
for (const [island, list] of Object.entries(manual.routes)) {
  if (routes[island] || FERRY_ROUTES[island])
    throw new Error(`ferry-manual.json의 ${island}가 PoC에도 있습니다`);
  routes[island] = list.map((r) => {
    const row = {};
    for (const f of [...ROUTE_FIELDS, "arrEn"]) {
      if (typeof r[f] !== "string" || r[f] === "")
        throw new Error(`ferry-manual.json ${island} ${r.k}의 ${f}가 없습니다`);
      row[f] = r[f];
    }
    if (FERRY_STATS[r.k])
      throw new Error(`ferry-manual.json ${r.k}가 운항 실적 key와 겹칩니다`);
    return row;
  });
}

const stats = {};
for (const [k, s] of Object.entries(FERRY_STATS)) {
  const row = {};
  for (const f of STAT_FIELDS) {
    if (s[f] === undefined)
      throw new Error(`FERRY_STATS.${k}의 ${f}가 없습니다`);
    row[f] = s[f];
  }
  stats[k] = row;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "src/features/planner/data/ferry.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify({ routes, stats })}\n`);
console.log(
  `ferry.json: ${Object.entries(routes)
    .map(([k, v]) => `${k} ${v.length}항`)
    .join(" · ")} · 운항 실적 ${Object.keys(stats).length}개 항로`,
);
