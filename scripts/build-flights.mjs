#!/usr/bin/env node
// 투어 플래너 코스 탭 「제주 노선 운항 현황」 · 「김해공항 노선 운항 현황」 카드의 편성 요약을 만든다.
//   src/features/planner/data/flights.json
//
// 사용법:
//   node scripts/build-flights.mjs <Tour Planner.dc.html>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천: Tour Planner.dc.html (PoC 주석: 「정기 편성 요약(하드코딩 참고값 · 시즌·요일에 따라 변동)」)
//   - JEJU_SCHED        제주 노선 출발 공항별 요약(운항 항공사 · 일 운항 · 첫 · 막 출발 · 비행 시간 분)
//   - JEJU_AIR_ROUTES   제주 노선 출발 공항 10곳(IATA · 한국어 · 영어)
//   - BUSAN_ROUTES · BUSAN_SCHED  김해공항 국내선 도착지와 요약
//   - ROUTE_AIRLINES    노선별 항공사 단위 운항 개요(편도 · 추정, 「18~22편」 · 운항 시간대)
//   - AIRLINE_SCHED     항공사별 공식 시간표 주소
//
// 규칙:
//   - 값은 PoC 그대로 옮긴다(지어내지 않는다). 언어별 표기는 화면 쪽(features/planner/flights.ts)이 만든다
//   - 실시간 운항 현황(PoC loadFlights, KAC_ENDPOINT)은 PoC에서도 주소가 비어 꺼져 있어 옮기지 않는다

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const [, , plannerPath] = process.argv;
if (!plannerPath) {
  console.error(
    "사용법: node scripts/build-flights.mjs <Tour Planner.dc.html>",
  );
  process.exit(1);
}

const lines = readFileSync(plannerPath, "utf8").split("\n");

/** `const NAME=` 줄부터 값이 끝나는 줄(`};` · `];`, 한 줄이면 그 줄)까지 떼어 값으로 읽는다 */
function readConst(name) {
  const re = new RegExp(`^const ${name}\\s*=`);
  const start = lines.findIndex((l) => re.test(l));
  if (start < 0) throw new Error(`Tour Planner.dc.html에 ${name}가 없습니다`);
  const oneLine = /[}\]];\s*$/.test(lines[start]);
  const end = oneLine
    ? start
    : lines.findIndex((l, i) => i > start && /^[}\]];/.test(l));
  if (end < 0)
    throw new Error(`Tour Planner.dc.html의 ${name} 끝을 찾지 못했습니다`);
  return vm.runInNewContext(
    `${lines.slice(start, end + 1).join("\n")}\n;${name}`,
  );
}

const SCHED_FIELDS = ["air", "day", "first", "last", "dur"];
function sched(name, table) {
  const out = {};
  for (const [code, r] of Object.entries(table)) {
    const row = {};
    for (const f of SCHED_FIELDS) {
      if (r[f] === undefined || r[f] === "")
        throw new Error(`${name}.${code}의 ${f}가 없습니다`);
      row[f] = r[f];
    }
    if (typeof row.dur !== "number")
      throw new Error(`${name}.${code}의 dur가 숫자가 아닙니다`);
    out[code] = row;
  }
  return out;
}
function airports(name, list) {
  return list.map((r) => {
    if (!/^[A-Z]{3}$/.test(r.code) || !r.ko || !r.en)
      throw new Error(`${name}의 공항 항목이 이상합니다: ${JSON.stringify(r)}`);
    return { code: r.code, ko: r.ko, en: r.en };
  });
}

const jejuSched = sched("JEJU_SCHED", readConst("JEJU_SCHED"));
const jejuAirports = airports("JEJU_AIR_ROUTES", readConst("JEJU_AIR_ROUTES"));
const busanSched = sched("BUSAN_SCHED", readConst("BUSAN_SCHED"));
const busanAirports = airports("BUSAN_ROUTES", readConst("BUSAN_ROUTES"));
for (const a of jejuAirports)
  if (!jejuSched[a.code]) throw new Error(`JEJU_SCHED에 ${a.code}가 없습니다`);
for (const a of busanAirports)
  if (!busanSched[a.code])
    throw new Error(`BUSAN_SCHED에 ${a.code}가 없습니다`);

const routeAirlines = {};
for (const [route, list] of Object.entries(readConst("ROUTE_AIRLINES"))) {
  if (!/^[A-Z]{3}-[A-Z]{3}$/.test(route))
    throw new Error(`ROUTE_AIRLINES 노선 이름이 이상합니다: ${route}`);
  routeAirlines[route] = list.map((a) => {
    if (!a.ko || !a.en || !/\d/.test(a.day) || !/\d{1,2}:\d{2}/.test(a.win))
      throw new Error(
        `ROUTE_AIRLINES.${route} 항목이 이상합니다: ${JSON.stringify(a)}`,
      );
    return { ko: a.ko, en: a.en, day: a.day, win: a.win };
  });
}

const airlineLinks = readConst("AIRLINE_SCHED").map((a) => {
  if (!a.ko || !a.en || !/^https:\/\//.test(a.url))
    throw new Error(`AIRLINE_SCHED 항목이 이상합니다: ${JSON.stringify(a)}`);
  return { ko: a.ko, en: a.en, url: a.url };
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "src/features/planner/data/flights.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(
  target,
  `${JSON.stringify({ jejuAirports, jejuSched, busanAirports, busanSched, routeAirlines, airlineLinks })}\n`,
);
console.log(
  `flights.json: 제주 노선 ${jejuAirports.length}개 공항 · 김해 ${busanAirports.length}개 노선 · 항공사표 ${Object.keys(routeAirlines).length}개 노선 · 시간표 링크 ${airlineLinks.length}개`,
);
