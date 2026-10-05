#!/usr/bin/env node
// 중 · 일 · 스페인어 화면에서 쓰는 데이터 이름표(권역 · 도시 · 장소)를 만든다.
//   src/features/names/data/zh.json · ja.json · es.json   { regions, cities, places }
// 그 언어 화면일 때만 서버에서 불러온다(src/features/names/server.ts). 다른 언어 사용자에게는 싣지 않는다.
//
// 사용법:
//   node scripts/build-names.mjs <Tour Planner.dc.html> <파생 데이터 폴더>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천 (Tour-Navigator-App, 원천 파일은 이 리포에 넣지 않는다):
//   - Tour Planner.dc.html   REG(권역 zh · ja · es) · CITY_NAME(도시 zh · ja · es) · I18N.locs(도시 [zh, ja])
//   - 파생 데이터/장소.csv   장소명(중문) · 장소명(일문). 한자 · 가나가 들어 있을 때만 적힌 공식 명칭(중문 832 · 일문 958곳)
//
// 규칙:
//   - 값이 없으면 넣지 않는다(지어내지 않는다). 화면은 영어 → 한국어 순으로 떨어진다(src/features/names/names.ts)
//   - 스페인어 장소 이름은 원천에 없어 넣지 않는다(화면은 영어 이름을 쓴다)
//   - 도시는 regions.json의 도시(플래너 · 테마 · 시티투어가 쓰는 한국어 도시 이름)만 넣는다
//   - 도시 이름은 마지막에 scripts/data/city-names.csv(사람이 관리하는 도시 이름표)로 덮는다(scripts/city-names.mjs)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { applyCityNames, loadCityNames } from "./city-names.mjs";
import { isOfficialName } from "./official-name-fixes.mjs";

const [plannerPath, derivedDir] = process.argv.slice(2);
if (!plannerPath || !derivedDir) {
  console.error(
    "사용법: node scripts/build-names.mjs <Tour Planner.dc.html> <파생 데이터 폴더>",
  );
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "src/features/names/data");

// ── CSV (scripts/build-planner.mjs와 같다) ─────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
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
  return rows;
}

function readCsv(path) {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const [header, ...body] = parseCsv(text).filter(
    (r) => r.length > 1 || r[0] !== "",
  );
  return body.map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])),
  );
}

// ── Tour Planner.dc.html 상수 ───────────────────────────────────────
const plannerLines = readFileSync(plannerPath, "utf8").split("\n");

function evalConst(name) {
  const start = plannerLines.findIndex((l) =>
    new RegExp(`^const ${name}\\s*=`).test(l),
  );
  if (start < 0) throw new Error(`Tour Planner.dc.html에 ${name}이 없습니다`);
  const end = plannerLines.findIndex((l, i) => i > start && /^};/.test(l));
  if (end < 0)
    throw new Error(`Tour Planner.dc.html의 ${name} 끝을 찾지 못했습니다`);
  return vm.runInNewContext(
    `${plannerLines.slice(start, end + 1).join("\n")}\n;${name}`,
  );
}

function evalReg() {
  const start = plannerLines.findIndex((l) => /^\s+const REG\s*=\s*\[/.test(l));
  if (start < 0) throw new Error("Tour Planner.dc.html에 REG가 없습니다");
  const end = plannerLines.findIndex((l, i) => i > start && /^\s+\];/.test(l));
  return vm.runInNewContext(
    `${plannerLines
      .slice(start, end + 1)
      .join("\n")
      .trim()}\n;REG`,
  );
}

const REG = evalReg();
const CITY_NAME = evalConst("CITY_NAME");
const I18N = evalConst("I18N");

const regionsData = JSON.parse(
  readFileSync(resolve(ROOT, "src/features/planner/data/regions.json"), "utf8"),
);
const cityKeys = Object.keys(regionsData.cities);
const placeRows = readCsv(resolve(derivedDir, "장소.csv"));

const LANGS = ["zh", "ja", "es"];
const present = (v) => typeof v === "string" && v.trim() !== "";

mkdirSync(OUT_DIR, { recursive: true });
for (const lang of LANGS) {
  const regions = {};
  for (const r of REG) if (present(r[lang])) regions[r.key] = r[lang];

  const cities = {};
  const locIndex = { zh: 0, ja: 1 }[lang];
  for (const c of cityKeys) {
    const fromCityName = CITY_NAME[c]?.[lang];
    const fromLocs =
      locIndex === undefined ? undefined : I18N.locs?.[c]?.[locIndex];
    const name = present(fromCityName)
      ? fromCityName
      : present(fromLocs)
        ? fromLocs
        : undefined;
    if (name) cities[c] = name;
  }

  const places = {};
  const column = { zh: "장소명(중문)", ja: "장소명(일문)" }[lang];
  if (column) {
    // 한글이 섞인 값(예: 「カン톤市場夜市」)은 원천의 입력 실수, 다른 항목이 붙은 값(명동대성당 → 피부과)은 WRONG_OFFICIAL_NAMES(official-name-fixes.mjs).
    // 둘 다 공식 명칭으로 쓰지 않는다(앱이 옮긴 이름 → 영어 이름으로 떨어진다)
    for (const row of placeRows)
      if (isOfficialName(lang, row.id, row[column]))
        places[row.id] = row[column].trim();
  }

  // 도시 이름은 사람이 관리하는 표(scripts/data/city-names.csv)가 원천 값을 덮는다(원천에 없는 도시 · 고친 이름)
  applyCityNames({ cities: {} }, { [lang]: { cities } }, loadCityNames());

  writeFileSync(
    resolve(OUT_DIR, `${lang}.json`),
    `${JSON.stringify({ regions, cities, places })}\n`,
  );
  console.log(
    lang,
    `권역 ${Object.keys(regions).length}/${REG.length}`,
    `도시 ${Object.keys(cities).length}/${cityKeys.length}`,
    `장소 ${Object.keys(places).length}/${placeRows.length}`,
  );
}
