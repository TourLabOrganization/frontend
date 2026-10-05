#!/usr/bin/env node
// 장소의 도시 · 좌표 · 이름을 수정 표(scripts/data/place-fixes.csv)대로 고친다(2026-10-04 점검).
//   열: id · city(새 도시, 비면 그대로) · lat · lng(새 좌표, 비면 그대로) · reason(고친 까닭)
//       ko · en(새 이름, 비면 그대로) · zh · ja · es(앱이 옮긴 이름 표 translations/data/place-names.*, 비면 그대로)
//   - 도시를 바꾸면 pickCity · 권역(macro)도 그 도시 것으로 바꾸고, regions.json 도시별 장소 수(placeCounts)를 다시 센다
//   - 테마 코스 장소(course/data/places.json)에 같은 id가 있으면 그 좌표도 고친다
//   - 표에 적힌 id가 플래너 장소에 없으면 멈춘다
// build-planner.mjs · add-manual-places.mjs로 장소를 다시 만든 뒤에도 이 스크립트를 돌린다(여러 번 돌려도 같다).
//
// 사용법:
//   node scripts/apply-place-fixes.mjs [--dry]
//   node scripts/build-citytour.mjs <Tour-Navigator-App/data/citytour.json>
//   npm run format
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./apply-badge-lists.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "src/features/planner/data");

/** 장소 목록에 수정을 적용한다. regions: regions.json(권역 → 도시 목록). 바뀐 장소 수 */
export function applyFixes(places, fixes, regions) {
  const macroOf = new Map();
  for (const r of regions.regions)
    for (const c of r.cities) macroOf.set(c, r.key);
  const byId = new Map(places.map((p) => [p.id, p]));
  let changed = 0;
  for (const f of fixes) {
    const p = byId.get(f.id);
    if (!p) continue;
    const before = JSON.stringify(p);
    const city = f.city?.trim();
    if (city) {
      if (!macroOf.has(city))
        throw new Error(`권역에 없는 도시: ${city} (${f.id})`);
      p.locKo = city;
      p.pickCity = city;
      p.macro = macroOf.get(city);
    }
    if (f.lat?.trim() && f.lng?.trim()) {
      p.lat = Number(f.lat);
      p.lng = Number(f.lng);
    }
    if (f.ko?.trim()) p.ko = f.ko.trim();
    if (f.en?.trim()) p.en = f.en.trim();
    if (JSON.stringify(p) !== before) changed++;
  }
  return changed;
}

/** 테마 코스 장소(course/data/places.json, 테마 키 → 장소 목록)의 좌표를 같은 id의 수정 표대로 고친다. 바뀐 장소 수 */
export function applyCourseCoords(course, fixes) {
  const byId = new Map(
    fixes.filter((f) => f.lat?.trim() && f.lng?.trim()).map((f) => [f.id, f]),
  );
  let changed = 0;
  for (const list of Object.values(course))
    for (const p of list) {
      const f = byId.get(p.id);
      if (!f) continue;
      const [lat, lng] = [Number(f.lat), Number(f.lng)];
      if (p.lat === lat && p.lng === lng) continue;
      p.lat = lat;
      p.lng = lng;
      changed++;
    }
  return changed;
}

/** 이름 표(id → 이름)를 수정 표의 lang 열대로 고친다. 바뀐 항목 수 */
export function applyNameFixes(table, fixes, lang) {
  let changed = 0;
  for (const f of fixes) {
    const name = f[lang]?.trim();
    if (!name || !(f.id in table) || table[f.id] === name) continue;
    table[f.id] = name;
    changed++;
  }
  return changed;
}

/** 도시별 장소 수(pickCity 기준, places.json · added-places.json 순서) */
export function placeCounts(places) {
  const out = {};
  for (const p of places)
    if (p.pickCity) out[p.pickCity] = (out[p.pickCity] ?? 0) + 1;
  return out;
}

function main() {
  const dry = process.argv.includes("--dry");
  const read = (f) => JSON.parse(readFileSync(resolve(DATA, f), "utf8"));
  const fixes = parseCsv(
    readFileSync(resolve(ROOT, "scripts/data/place-fixes.csv"), "utf8"),
  );
  const base = read("places.json");
  const added = read("added-places.json");
  const regions = read("regions.json");
  const known = new Set([...base, ...added].map((p) => p.id));
  const missing = fixes.map((f) => f.id).filter((id) => !known.has(id));
  if (missing.length > 0) {
    console.error(`플래너 장소에 없는 id: ${missing.join(", ")}`);
    process.exit(1);
  }
  const n =
    applyFixes(base, fixes, regions) + applyFixes(added, fixes, regions);
  const COURSE = resolve(ROOT, "src/features/course/data/places.json");
  const course = JSON.parse(readFileSync(COURSE, "utf8"));
  const nc = applyCourseCoords(course, fixes);
  const counts = placeCounts([...base, ...added]);
  // 기존 키 순서를 지키고 새 도시는 끝에, 장소가 없어진 도시는 뺀다
  const next = {};
  for (const k of Object.keys(regions.placeCounts))
    if (counts[k]) next[k] = counts[k];
  for (const [k, v] of Object.entries(counts)) if (!(k in next)) next[k] = v;
  regions.placeCounts = next;
  const nameFiles = Object.fromEntries(
    ["en", "zh", "ja", "es"].map((l) => [
      l,
      resolve(ROOT, `src/features/translations/data/place-names.${l}.json`),
    ]),
  );
  const names = Object.fromEntries(
    Object.entries(nameFiles).map(([l, f]) => [
      l,
      JSON.parse(readFileSync(f, "utf8")),
    ]),
  );
  const m = Object.entries(names).reduce(
    (s, [l, t]) => s + applyNameFixes(t, fixes, l),
    0,
  );
  console.log(
    `수정 표 ${fixes.length}행 · 바뀐 장소 ${n}곳 · 테마 코스 ${nc}곳 · 이름 표 ${m}건`,
  );
  if (dry) return console.log("--dry: 파일은 그대로");
  for (const [l, f] of Object.entries(nameFiles))
    writeFileSync(f, JSON.stringify(names[l], null, 2) + "\n", "utf8");
  const write = (f, d) =>
    writeFileSync(resolve(DATA, f), JSON.stringify(d, null, 2) + "\n", "utf8");
  write("places.json", base);
  write("added-places.json", added);
  write("regions.json", regions);
  writeFileSync(COURSE, JSON.stringify(course, null, 2) + "\n", "utf8");
  console.log("썼다. npm run format 을 돌려 포맷을 맞추세요");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
