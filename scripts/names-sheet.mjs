#!/usr/bin/env node
// 다국어 지명 검토 시트: 도시 · 장소 이름(한국어 · 영어 · 중 · 일 · 스페인어)을 한 표로 내보내고, 고친 표를 다시 받는다(2026-10-05).
//
//   내보내기: node scripts/names-sheet.mjs export <out.csv>
//     열: kind(city · place) · id(도시는 한국어 이름) · city · cat · ko · en · zh · ja · es · zh_src · ja_src (공식 · 앱)
//     엑셀에서 바로 열리게 UTF-8 BOM을 붙인다. 장소의 중 · 일 「공식」은 원천 공식 명칭(names/data), 「앱」은 앱이 옮긴 이름이다
//
//   받기: node scripts/names-sheet.mjs import <edited.csv> [--dry]
//     지금 데이터와 다른 칸만 옮긴다
//       - 도시: scripts/data/city-names.csv 의 그 칸을 고친다 → node scripts/city-names.mjs
//       - 장소: scripts/data/place-fixes.csv 에 이름 열(ko · en · zh · ja · es)만 채운 행을 더한다 → node scripts/apply-place-fixes.mjs
//         (공식 명칭이 있는 장소의 중 · 일 이름은 원천 값이 이겨 바뀌지 않는다. 그런 칸은 따로 알린다)
//     그 뒤 npm run format · npm run check
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./apply-badge-lists.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));
const NAME_LANGS = ["ko", "en", "zh", "ja", "es"];
export const SHEET_COLUMNS = [
  "kind",
  "id",
  "city",
  "cat",
  ...NAME_LANGS,
  "zh_src",
  "ja_src",
];

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows, cols = SHEET_COLUMNS) =>
  [cols, ...rows.map((r) => cols.map((c) => r[c]))]
    .map((r) => r.map(csvCell).join(","))
    .join("\n") + "\n";

/** 지금 앱 데이터의 이름 시트 행(도시 → 장소 순) */
export function currentSheet() {
  const regions = read("src/features/planner/data/regions.json");
  const cityRows = parseCsv(
    readFileSync(resolve(ROOT, "scripts/data/city-names.csv"), "utf8"),
  );
  const official = {};
  const app = {};
  for (const l of ["zh", "ja", "es"]) {
    official[l] = read(`src/features/names/data/${l}.json`).places ?? {};
    app[l] = read(`src/features/translations/data/place-names.${l}.json`);
  }
  const rows = cityRows.map((c) => ({
    kind: "city",
    id: c.ko,
    city: c.ko,
    cat: "",
    ko: c.ko,
    en: c.en,
    zh: c.zh,
    ja: c.ja,
    es: c.es,
    zh_src: c.source,
    ja_src: c.source,
  }));
  const places = [
    ...read("src/features/planner/data/places.json"),
    ...read("src/features/planner/data/added-places.json"),
  ];
  const known = new Set(regions.regions.flatMap((r) => r.cities));
  for (const p of places) {
    const name = (l) => official[l][p.id] ?? app[l][p.id] ?? "";
    const src = (l) =>
      official[l][p.id] ? "공식" : app[l][p.id] ? "앱" : "없음";
    const city = p.pickCity ?? p.locKo;
    rows.push({
      kind: "place",
      id: p.id,
      city: known.has(city) ? city : (p.locKo ?? ""),
      cat: p.cat,
      ko: p.ko,
      en: p.en,
      zh: name("zh"),
      ja: name("ja"),
      es: name("es"),
      zh_src: src("zh"),
      ja_src: src("ja"),
    });
  }
  return rows;
}

/**
 * 고친 시트와 지금 시트를 비교한다. 바뀐 칸만 돌려준다.
 * { cities: [{ko, field, from, to}], places: [{id, field, from, to, official}] }
 */
export function diffSheet(current, edited) {
  const key = (r) => `${r.kind}|${r.id}`;
  const now = new Map(current.map((r) => [key(r), r]));
  const cities = [];
  const places = [];
  for (const e of edited) {
    const c = now.get(key(e));
    if (!c) continue;
    for (const f of NAME_LANGS) {
      const to = (e[f] ?? "").trim();
      if (!to || to === c[f]) continue;
      if (e.kind === "city") {
        if (f !== "ko") cities.push({ ko: c.id, field: f, from: c[f], to });
      } else
        places.push({
          id: c.id,
          field: f,
          from: c[f],
          to,
          official: (f === "zh" || f === "ja") && c[`${f}_src`] === "공식",
        });
    }
  }
  return { cities, places };
}

function main() {
  const [cmd, file] = process.argv.slice(2);
  const dry = process.argv.includes("--dry");
  if (cmd === "export" && file) {
    const rows = currentSheet();
    writeFileSync(file, "﻿" + toCsv(rows), "utf8");
    console.log(`이름 시트 ${rows.length}행 → ${file}`);
    return;
  }
  if (cmd === "import" && file) {
    const edited = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
    const d = diffSheet(currentSheet(), edited);
    console.log(`바뀐 칸: 도시 ${d.cities.length} · 장소 ${d.places.length}`);
    for (const x of [...d.cities, ...d.places])
      console.log(
        `  ${x.ko ?? x.id} ${x.field}: ${x.from} → ${x.to}${x.official ? " (공식 명칭이 있어 반영되지 않음)" : ""}`,
      );
    if (dry) return console.log("--dry: 파일은 그대로");
    if (d.cities.length) {
      const path = resolve(ROOT, "scripts/data/city-names.csv");
      const rows = parseCsv(readFileSync(path, "utf8"));
      for (const x of d.cities) {
        const r = rows.find((y) => y.ko === x.ko);
        r[x.field] = x.to;
        r.source = "앱 번역(검토 시트)";
      }
      writeFileSync(
        path,
        toCsv(rows, ["ko", "en", "zh", "ja", "es", "source"]),
        "utf8",
      );
    }
    const byId = new Map();
    for (const x of d.places.filter((p) => !p.official))
      byId.set(x.id, { ...(byId.get(x.id) ?? {}), [x.field]: x.to });
    if (byId.size) {
      const cols = [
        "id",
        "city",
        "lat",
        "lng",
        "reason",
        "ko",
        "en",
        "zh",
        "ja",
        "es",
      ];
      const lines = [...byId].map(([id, f]) =>
        cols
          .map((c) =>
            csvCell(
              c === "id"
                ? id
                : c === "reason"
                  ? "이름 고침 — 다국어 지명 검토 시트"
                  : (f[c] ?? ""),
            ),
          )
          .join(","),
      );
      appendFileSync(
        resolve(ROOT, "scripts/data/place-fixes.csv"),
        lines.join("\n") + "\n",
        "utf8",
      );
    }
    console.log(
      "옮겼다. node scripts/city-names.mjs · node scripts/apply-place-fixes.mjs → npm run format",
    );
    return;
  }
  console.error(
    "사용법: node scripts/names-sheet.mjs export <out.csv> | import <edited.csv> [--dry]",
  );
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
