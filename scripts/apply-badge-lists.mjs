#!/usr/bin/env node
// 한국관광 100선(k100) · 열린관광지(bf) · 유네스코 세계유산(un) 배지를 공식 명단 표로 다시 매긴다(PoC 체류시간 CSV 플래그를 덮는다).
//   scripts/data/k100-list.csv          2025~2026 한국관광 100선 100건. 열: no · edition(선정 판, 2025~2026) · sido · sigungu · name · status · placeIds · note · source
//   scripts/data/open-tourism-list.csv  열린관광지 2015~2026 선정지. 열: year · sido · sigungu · name · placeIds · note · source
//   scripts/data/unesco-list.csv        한국의 유네스코 세계유산 17건(2025 반구천의 암각화까지). 열: site · year · placeIds · names(확인용 장소 이름)
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
//   - 100선 장소는 place-details.json에 k100 { edition(선정 판), entry(명단 이름), places(그 건이 묶은 장소 수) }를 적는다.
//     장소 시트 설명 끝에 「2025~2026 한국관광 100선 선정지」 문장을 붙이는 데 쓴다(app/api/planner/places/[id]/route.ts k100Sentence)
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

/** 장소 id → 100선 선정 정보(판 · 명단 이름 · 그 건의 장소 수). 한 장소가 두 건에 들면 앞 건 */
export function k100Info(rows) {
  const out = new Map();
  for (const r of rows) {
    const ids = r.placeIds.split(/\s+/).filter(Boolean);
    for (const id of ids)
      if (!out.has(id))
        out.set(id, { edition: r.edition, entry: r.name, places: ids.length });
  }
  return out;
}

/** place-details의 k100 필드를 정보대로 맞춘다(없는 장소는 지운다). 바뀐 장소 수 */
export function applyK100Details(details, info) {
  let changed = 0;
  for (const [id, d] of Object.entries(details)) {
    const next = info.get(id);
    const before = JSON.stringify(d.k100 ?? null);
    if (next) d.k100 = next;
    else delete d.k100;
    if (JSON.stringify(d.k100 ?? null) !== before) changed++;
  }
  return changed;
}

/** 장소 목록의 k100 · bf를 두 집합대로 맞춘다. 바뀐 장소 수를 돌려준다 */
export function applyBadges(places, k100, bf, un) {
  let changed = 0;
  for (const p of places) {
    const k = k100.has(p.id);
    const b = bf.has(p.id);
    const u = un ? un.has(p.id) : p.un;
    if (p.k100 !== k || p.bf !== b || p.un !== u) changed++;
    p.k100 = k;
    p.bf = b;
    p.un = u;
  }
  return changed;
}

function main() {
  const dry = process.argv.includes("--dry");
  const read = (f) => JSON.parse(readFileSync(f, "utf8"));
  const k100Rows = parseCsv(
    readFileSync(resolve(ROOT, "scripts/data/k100-list.csv"), "utf8"),
  );
  const k100 = listIds(k100Rows);
  const un = listIds(
    parseCsv(
      readFileSync(resolve(ROOT, "scripts/data/unesco-list.csv"), "utf8"),
    ),
  );
  const bf = listIds(
    parseCsv(
      readFileSync(resolve(ROOT, "scripts/data/open-tourism-list.csv"), "utf8"),
    ),
  );
  const base = read(resolve(PLANNER, "places.json"));
  const added = read(resolve(PLANNER, "added-places.json"));
  const course = read(COURSE);
  const details = read(resolve(PLANNER, "place-details.json"));
  const known = new Set([...base, ...added].map((p) => p.id));
  const missing = [...k100, ...bf, ...un].filter((id) => !known.has(id));
  if (missing.length > 0) {
    console.error(`플래너 장소에 없는 id: ${missing.join(", ")}`);
    process.exit(1);
  }
  const n = applyBadges(base, k100, bf, un) + applyBadges(added, k100, bf, un);
  // 테마 코스 데이터는 테마 → 장소 목록
  const c = Object.values(course).reduce(
    (sum, list) => sum + applyBadges(list, k100, bf, un),
    0,
  );
  const d = applyK100Details(details, k100Info(k100Rows));
  console.log(
    `100선 ${k100.size}곳 · 열린관광지 ${bf.size}곳 · 유네스코 ${un.size}곳 → 플래너 ${n}곳 · 테마 코스 ${c}곳 · 100선 설명 ${d}곳 바뀜`,
  );
  if (dry) return console.log("--dry: 파일은 그대로");
  const write = (f, data) =>
    writeFileSync(f, JSON.stringify(data, null, 2) + "\n", "utf8");
  write(resolve(PLANNER, "places.json"), base);
  write(resolve(PLANNER, "added-places.json"), added);
  write(COURSE, course);
  write(resolve(PLANNER, "place-details.json"), details);
  console.log("썼다. npm run format 을 돌려 포맷을 맞추세요");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
