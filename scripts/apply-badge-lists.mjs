#!/usr/bin/env node
// 한국관광 100선(k100) · 열린관광지(bf) 배지를 공식 명단 표로 다시 매긴다(PoC 체류시간 CSV 플래그를 덮는다).
//   scripts/data/k100-list.csv          2025~2026 한국관광 100선 100건. 열: no · sido · sigungu · name · status · placeIds · note · source
//   scripts/data/open-tourism-list.csv  열린관광지 2015~2026 선정지. 열: year · sido · sigungu · name · placeIds · note · source
//   placeIds: 그 명단 항목에 해당하는 앱 장소 id(공백으로 여럿). 명단 한 건이 여러 장소를 묶으면(5대 고궁, 에버랜드&한국민속촌 …) 모두 적는다.
//   비어 있으면 대응 장소가 없는 항목(제주올레길처럼 길 전체, 주민 시설)이다.
//
// 사용법:
//   node scripts/apply-badge-lists.mjs [--dry]
//   npm run format
//
// 규칙:
//   - 표의 placeIds에 든 장소만 배지를 켜고, 나머지 장소는 끈다(플래너 places.json · added-places.json, 테마 코스 course/data/places.json).
//   - 표에 적힌 id가 플래너 장소에 없으면 멈춘다(오타 · 통합으로 사라진 id).
//   - build-planner.mjs · build-places.mjs · add-manual-places.mjs로 장소를 다시 만든 뒤에도 이 스크립트를 돌린다.
//   명단은 보도자료 · 지자체 발표 검색으로 모았다(2026-10-04, 한국관광공사 원문 목록 페이지는 작업 환경에서 막혀 있었다). 출처는 표의 source 열
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLANNER = resolve(ROOT, "src/features/planner/data");
const COURSE = resolve(ROOT, "src/features/course/data/places.json"); // 테마 키 → 장소 목록

/** 따옴표 칸을 읽는 작은 CSV 파서 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some((v) => v !== "")) rows.push(row);
  }
  const [head, ...body] = rows;
  return body.map((r) =>
    Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, ""), r[i] ?? ""])),
  );
}

/** 표의 placeIds를 모은 집합 */
export function listIds(rows) {
  return new Set(rows.flatMap((r) => r.placeIds.split(/\s+/).filter(Boolean)));
}

/** 장소 목록의 k100 · bf를 두 집합대로 맞춘다. 바뀐 장소 수를 돌려준다 */
export function applyBadges(places, k100, bf) {
  let changed = 0;
  for (const p of places) {
    const k = k100.has(p.id);
    const b = bf.has(p.id);
    if (p.k100 !== k || p.bf !== b) changed++;
    p.k100 = k;
    p.bf = b;
  }
  return changed;
}

function main() {
  const dry = process.argv.includes("--dry");
  const read = (f) => JSON.parse(readFileSync(f, "utf8"));
  const k100 = listIds(
    parseCsv(readFileSync(resolve(ROOT, "scripts/data/k100-list.csv"), "utf8")),
  );
  const bf = listIds(
    parseCsv(
      readFileSync(resolve(ROOT, "scripts/data/open-tourism-list.csv"), "utf8"),
    ),
  );
  const base = read(resolve(PLANNER, "places.json"));
  const added = read(resolve(PLANNER, "added-places.json"));
  const course = read(COURSE);
  const known = new Set([...base, ...added].map((p) => p.id));
  const missing = [...k100, ...bf].filter((id) => !known.has(id));
  if (missing.length > 0) {
    console.error(`플래너 장소에 없는 id: ${missing.join(", ")}`);
    process.exit(1);
  }
  const n = applyBadges(base, k100, bf) + applyBadges(added, k100, bf);
  // 테마 코스 데이터는 테마 → 장소 목록
  const c = Object.values(course).reduce(
    (sum, list) => sum + applyBadges(list, k100, bf),
    0,
  );
  console.log(
    `100선 ${k100.size}곳 · 열린관광지 ${bf.size}곳 → 플래너 ${n}곳 · 테마 코스 ${c}곳 바뀜`,
  );
  if (dry) return console.log("--dry: 파일은 그대로");
  const write = (f, data) =>
    writeFileSync(f, JSON.stringify(data, null, 2) + "\n", "utf8");
  write(resolve(PLANNER, "places.json"), base);
  write(resolve(PLANNER, "added-places.json"), added);
  write(COURSE, course);
  console.log("썼다. npm run format 을 돌려 포맷을 맞추세요");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
