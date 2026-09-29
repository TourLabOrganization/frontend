#!/usr/bin/env node
// 홈 「지역 시티투어 · 내 유형 추천」의 코스 점수 자료를 만든다.
//   src/features/home/data/citytour-scores.json   data/citytour.json과 같은 순서의 280칸. 분석 적격 코스는 점수 자료, 아니면 null
//
// 사용법 (build-citytour.mjs를 먼저 돌려 data/citytour.json이 최신이어야 한다):
//   node scripts/build-citytour-scores.mjs <Data-Analytics/reference_calc/eligible_courses.csv>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천 (TourLabOrganization/Data-Analytics, 원천 파일은 이 리포에 넣지 않는다):
//   - reference_calc/eligible_courses.csv   경로 해석 · 경유지 연결 · 범주 분류를 거쳐 분석 적격인 코스(추천 6.4 기준 234개)
//     analysis_course_id · analysis_region · analysis_name · 코스(경유지) · analysis_share_{herit,heal,activity,food,sea}
//     · analysis_category_coverage · analysis_visit_candidate_count · analysis_night_flag
//
// 규칙:
//   - 노선은 지역 · 노선명 · 경유지 원문이 모두 같은 data/citytour.json 행에 붙인다. 못 찾거나 두 번 찾으면 멈춘다
//   - 범주 비중(shares)은 역사 · 자연 · 체험 · 음식 · 바다 순서이고 합이 분류 커버리지(coverage)다
//   - 값은 원천 그대로 두고 지어내지 않는다

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [sourcePath] = process.argv.slice(2);
if (!sourcePath) {
  console.error(
    "사용법: node scripts/build-citytour-scores.mjs <Data-Analytics/reference_calc/eligible_courses.csv>",
  );
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOURS = resolve(ROOT, "src/features/home/data/citytour.json");
const OUT = resolve(ROOT, "src/features/home/data/citytour-scores.json");

/** RFC 4180 CSV(따옴표 안의 쉼표 · 줄바꿈 · "" 허용) → 머리글 객체 배열 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v !== ""));
  return body.map((r) => Object.fromEntries(header.map((h, j) => [h, r[j]])));
}

const CATEGORIES = ["herit", "heal", "activity", "food", "sea"];
const key = (region, name, route) => `${region}\u0000${name}\u0000${route}`;

const tours = JSON.parse(readFileSync(TOURS, "utf8"));
const indexByKey = new Map();
tours.forEach((t, i) => {
  const k = key(t.region, t.name, t.route);
  if (indexByKey.has(k))
    throw new Error(`citytour.json에 같은 노선이 두 번: ${t.region} ${t.name}`);
  indexByKey.set(k, i);
});

const courses = parseCsv(readFileSync(sourcePath, "utf8").replace(/^﻿/, ""));
const out = tours.map(() => null);
for (const c of courses) {
  const i = indexByKey.get(
    key(c.analysis_region, c.analysis_name, c["코스(경유지)"]),
  );
  if (i === undefined)
    throw new Error(
      `citytour.json에 없는 코스: ${c.analysis_region} ${c.analysis_name}`,
    );
  if (out[i] !== null)
    throw new Error(
      `한 노선에 코스가 두 개: ${c.analysis_region} ${c.analysis_name}`,
    );
  const shares = CATEGORIES.map((k) => Number(c[`analysis_share_${k}`]));
  const coverage = Number(c.analysis_category_coverage);
  const visits = Number(c.analysis_visit_candidate_count);
  const night = Number(c.analysis_night_flag);
  if (!shares.every((v) => Number.isFinite(v) && v >= 0))
    throw new Error(`범주 비중 오류: ${c.analysis_course_id}`);
  if (
    !(coverage > 0 && coverage <= 1) ||
    Math.abs(shares.reduce((a, b) => a + b, 0) - coverage) > 1e-8
  )
    throw new Error(`커버리지 오류: ${c.analysis_course_id}`);
  if (!Number.isInteger(visits) || visits < 2 || (night !== 0 && night !== 1))
    throw new Error(`방문 후보 수 · 야경 오류: ${c.analysis_course_id}`);
  out[i] = {
    id: c.analysis_course_id,
    shares,
    coverage,
    visits,
    night: night === 1,
  };
}

writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(
  `${OUT}: 노선 ${tours.length}개 중 점수 자료 ${out.filter(Boolean).length}개`,
);
