#!/usr/bin/env node
// 이미 있는 장소의 설명 끝에 명단 문장을 붙인다(scripts/data/place-notes.csv, 2026-10-04).
//   열: id · ko(붙일 한국어 문장) · en(붙일 영어 문장) · list(어느 명단인지: 식객 · 한식당100선 …)
//   예: 허영만 만화 『식객』에 나온 식당, 「한국인이 사랑하는 오래된 한식당 100선」 선정 식당이 이미 장소로 들어 있을 때
//   - 설명에 같은 문장이 이미 있으면 건너뛴다(여러 번 돌려도 같다)
//   - 설명이 없으면 문장만 적는다
//   - 표에 적힌 id가 플래너 장소에 없으면 멈춘다(합쳐서 사라진 id는 place-aliases.json으로 남긴 장소에 붙인다)
// build-planner.mjs · add-manual-places.mjs · merge-same-places.mjs로 장소를 다시 만든 뒤에도 이 스크립트를 돌린다.
//
// 사용법:
//   node scripts/apply-place-notes.mjs [--dry]
//   npm run format
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./apply-badge-lists.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "src/features/planner/data");

/** 설명 문자열 끝에 문장을 붙인다(이미 있으면 그대로) */
export function appendSentence(desc, sentence) {
  const s = sentence?.trim();
  if (!s) return desc;
  if (!desc?.trim()) return s;
  if (desc.includes(s)) return desc;
  return `${desc.trimEnd()} ${s}`;
}

/** place-details에 문장을 붙인다. aliases: 옛 id → 남긴 id. 바뀐 장소 수 */
export function applyNotes(details, notes, aliases = {}) {
  let changed = 0;
  for (const n of notes) {
    const id = aliases[n.id] ?? n.id;
    const d = (details[id] ??= {});
    const before = JSON.stringify(d.desc ?? null);
    const desc = { ...(d.desc ?? {}) };
    desc.ko = appendSentence(desc.ko, n.ko);
    if (n.en?.trim()) desc.en = appendSentence(desc.en, n.en);
    d.desc = desc;
    if (JSON.stringify(d.desc) !== before) changed++;
  }
  return changed;
}

function main() {
  const dry = process.argv.includes("--dry");
  const read = (f) => JSON.parse(readFileSync(resolve(DATA, f), "utf8"));
  const notes = parseCsv(
    readFileSync(resolve(ROOT, "scripts/data/place-notes.csv"), "utf8"),
  );
  const aliases = read("place-aliases.json");
  const known = new Set(
    [...read("places.json"), ...read("added-places.json")].map((p) => p.id),
  );
  const missing = notes
    .map((n) => aliases[n.id] ?? n.id)
    .filter((id) => !known.has(id));
  if (missing.length > 0) {
    console.error(`플래너 장소에 없는 id: ${missing.join(", ")}`);
    process.exit(1);
  }
  const details = read("place-details.json");
  const n = applyNotes(details, notes, aliases);
  console.log(`명단 문장 ${notes.length}행 · 설명 바뀐 장소 ${n}곳`);
  if (dry) return console.log("--dry: 파일은 그대로");
  writeFileSync(
    resolve(DATA, "place-details.json"),
    JSON.stringify(details, null, 2) + "\n",
    "utf8",
  );
  console.log("썼다. npm run format 을 돌려 포맷을 맞추세요");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
