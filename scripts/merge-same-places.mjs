#!/usr/bin/env node
// 같은 장소가 두 번 들어간 쌍(scripts/data/same-places.csv: keep · drop · reason)을 하나로 합친다.
// 전수 점검 2026-10-03: 같은 도시 · 같은 이름(정규화) 5쌍, 전용 화면 묶음 ↔ 전국 목록 14쌍(build-planner.mjs가 pickCity만 뺐던 것),
// 전국 목록 안의 같은 장소(이름이 서로를 품고 좌표 700m 안, 눈으로 확인) 47쌍.
//
// 사용법 (build-planner.mjs · add-popular-places.mjs · add-manual-places.mjs 뒤에 돌린다. 여러 번 돌려도 같다):
//   node scripts/merge-same-places.mjs [--dry]
//   node scripts/build-citytour.mjs <Tour-Navigator-App/data/citytour.json>   # 경유지 id가 바뀌므로 다시 만든다
//   npm run format
//
// 하는 일:
//   - drop 장소를 places.json · added-places.json · place-details.json · signgu.json · 이름 표(names/data, translations/data/place-names.*)에서 뺀다
//   - drop 장소에만 있던 값을 keep 장소로 옮긴다: 인기 순위(popRank, 작은 쪽) · 체류 순번(n) · 운영시간(hrs · open · close) · 지정구역(vz) ·
//     표식(yt · k100 · un · bf는 OR, off는 둘 다 목록 밖일 때만) · 상세(desc 언어별 · img · src · url · zh · ja · ct · rs) · 이름 표의 번역
//   - keep 장소에 pickCity가 없으면 locKo를 준다(전용 화면 묶음 쌍은 build-planner.mjs가 한쪽 pickCity를 뺐다)
//   - drop 장소의 한국어 → 영어 이름을 고유명사 표(translations/data/names.en.json)에 더한다(설명 글 · 시티투어 경로의 번역이 끊기지 않게)
//   - drop → keep 표를 src/features/planner/data/place-aliases.json에 쓴다(저장된 코스 · 북마크 · 시티투어 경유지의 옛 id가 keep 장소로 이어진다)
//   - regions.json placeCounts를 pickCity로 다시 센다
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./add-manual-places.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CSV = resolve(ROOT, "scripts/data/same-places.csv");
const PLANNER = resolve(ROOT, "src/features/planner/data");
const FILES = {
  places: resolve(PLANNER, "places.json"),
  added: resolve(PLANNER, "added-places.json"),
  details: resolve(PLANNER, "place-details.json"),
  signgu: resolve(PLANNER, "signgu.json"),
  regions: resolve(PLANNER, "regions.json"),
  aliases: resolve(PLANNER, "place-aliases.json"),
  namesEn: resolve(ROOT, "src/features/translations/data/names.en.json"),
};
/** 장소 id를 키로 쓰는 이름 표. 언어마다 [공식 명칭 표(names/data, places 아래), 앱이 옮긴 이름 표(translations/data)] */
const NAME_TABLES = {
  zh: [
    "src/features/names/data/zh.json",
    "src/features/translations/data/place-names.zh.json",
  ],
  ja: [
    "src/features/names/data/ja.json",
    "src/features/translations/data/place-names.ja.json",
  ],
  es: [
    "src/features/names/data/es.json",
    "src/features/translations/data/place-names.es.json",
  ],
  en: [null, "src/features/translations/data/place-names.en.json"],
};

const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
const dry = process.argv.includes("--dry");
const write = (f, v) => {
  if (!dry) writeFileSync(f, JSON.stringify(v, null, 2) + "\n");
};

/** CSV 행 → [keep, drop, reason]. 열 이름 keep · drop · reason */
export function readSamePlaces(text) {
  const rows = parseCsv(text);
  if (rows.length && !("keep" in rows[0] && "drop" in rows[0]))
    throw new Error("same-places.csv에 keep · drop 열이 없다");
  return rows.map((r) => [
    r.keep.trim(),
    r.drop.trim(),
    (r.reason ?? "").trim(),
  ]);
}

/** 가벼운 필드를 keep으로 옮긴다(keep에 없는 값만). 바뀐 필드 이름을 돌려준다 */
export function mergePlace(keep, drop) {
  const changed = [];
  const set = (k, v) => {
    if (keep[k] !== v) {
      keep[k] = v;
      changed.push(k);
    }
  };
  if (drop.popRank && (!keep.popRank || drop.popRank < keep.popRank))
    set("popRank", drop.popRank);
  if (keep.n == null && drop.n != null) set("n", drop.n);
  if (!keep.hrs && drop.hrs) set("hrs", drop.hrs);
  if (keep.open == null && drop.open != null) {
    set("open", drop.open);
    set("close", drop.close);
  }
  if (!keep.vz && drop.vz) set("vz", drop.vz);
  for (const k of ["yt", "k100", "un", "bf"])
    if (drop[k] && !keep[k]) set(k, true);
  if (keep.off && !drop.off) set("off", false);
  if (!keep.pickCity && keep.locKo) set("pickCity", keep.locKo);
  return changed;
}

/** 상세(place-details)를 keep으로 옮긴다(keep에 없는 값만) */
export function mergeDetail(keep = {}, drop = {}) {
  const out = { ...keep };
  for (const [k, v] of Object.entries(drop)) {
    if (k === "desc" && typeof v === "object" && v) {
      out.desc = { ...v, ...(out.desc ?? {}) };
      for (const [lang, text] of Object.entries(v))
        if (!out.desc[lang]) out.desc[lang] = text;
    } else if (k === "ct" || k === "rs") {
      if (v) out[k] = true;
    } else if (out[k] === undefined || out[k] === "" || out[k] === null)
      out[k] = v;
  }
  return out;
}

/**
 * 이름 표를 keep으로 옮긴다. 공식 명칭이 앱이 옮긴 이름보다 앞이므로(loadNameTable), drop의 공식 명칭을 keep이 받으면 keep의 앱 이름은 지운다
 * (두 표의 id가 겹치지 않아야 한다, names.test). 공식 명칭이 둘 다 없으면 앱 이름은 keep 것, 없으면 drop 것.
 * 영어 표(place-names.en.json, 공식 표 없음)는 places.json의 en과 같아야 하므로 drop만 지운다
 */
export function mergeNames(official, app, keepId, dropId) {
  const off = official?.[keepId] ?? official?.[dropId];
  if (official) {
    delete official[dropId];
    if (off !== undefined) official[keepId] = off;
  }
  if (app) {
    const a = app[keepId] ?? (official ? app[dropId] : undefined);
    delete app[dropId];
    if (off !== undefined) delete app[keepId];
    else if (a !== undefined) app[keepId] = a;
  }
}

/**
 * 고유명사 영어 표(names.en.json, 한국어 → 영어)에 뺀 장소의 이름을 더한다. 설명 글 · 시티투어 경로에 그 이름이 남아 있어
 * 번역(text.ts nameEn: 플래너 장소 이름 → 이 표)이 끊기지 않게. 표에 이미 있거나 영어 이름에 한글이 섞였으면 넣지 않는다(표 순서는 그대로, 새 이름은 뒤에)
 */
export function withDroppedNames(names, dropped) {
  const out = { ...names };
  for (const p of dropped) {
    const ko = (p.ko ?? "").trim();
    const en = (p.en ?? "").trim();
    if (!ko || !en || ko === en || /[가-힣]/.test(en) || out[ko]) continue;
    out[ko] = en;
  }
  return out;
}

/** 별명 표(drop → keep). 사슬(a → b, b → c)은 끝까지 따라간다 */
export function withAliases(aliases, pairs) {
  const out = { ...aliases };
  for (const [keep, drop] of pairs) out[drop] = keep;
  const follow = (id, seen = new Set()) => {
    let cur = id;
    while (out[cur] && !seen.has(cur)) {
      seen.add(cur);
      cur = out[cur];
    }
    return cur;
  };
  for (const drop of Object.keys(out)) out[drop] = follow(drop);
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/** regions.json placeCounts: pickCity 수. 기존 키 순서를 지키고 새 도시는 뒤에 */
export function placeCounts(places, prev = {}) {
  const m = new Map(Object.keys(prev).map((k) => [k, 0]));
  for (const p of places)
    if (p.pickCity) m.set(p.pickCity, (m.get(p.pickCity) ?? 0) + 1);
  return Object.fromEntries([...m].filter(([, n]) => n > 0));
}

function main() {
  const pairs = readSamePlaces(readFileSync(CSV, "utf8"));
  const places = readJson(FILES.places);
  const added = readJson(FILES.added);
  const details = readJson(FILES.details);
  const signgu = readJson(FILES.signgu);
  const regions = readJson(FILES.regions);
  const aliases = existsSync(FILES.aliases) ? readJson(FILES.aliases) : {};
  const tables = Object.values(NAME_TABLES).map(([off, app]) => ({
    off: off && resolve(ROOT, off),
    app: resolve(ROOT, app),
    offData: off ? readJson(resolve(ROOT, off)) : null,
    appData: readJson(resolve(ROOT, app)),
  }));
  const byId = new Map([...places, ...added].map((p) => [p.id, p]));

  const dropped = new Set();
  const droppedPlaces = [];
  const log = [];
  for (const [keepId, dropId, reason] of pairs) {
    const keep = byId.get(keepId);
    if (!keep) throw new Error(`keep ${keepId}가 장소에 없다 (${reason})`);
    const drop = byId.get(dropId);
    if (!drop) {
      if (aliases[dropId]) continue; // 이미 합쳤다
      throw new Error(`drop ${dropId}가 장소에 없다 (${reason})`);
    }
    if (drop.locKo !== keep.locKo)
      console.warn(
        `주의: ${keepId}(${keep.locKo}) ← ${dropId}(${drop.locKo}) 도시가 다르다`,
      );
    const changed = mergePlace(keep, drop);
    details[keepId] = mergeDetail(details[keepId], details[dropId]);
    delete details[dropId];
    delete signgu[dropId];
    for (const t of tables)
      mergeNames(t.offData?.places, t.appData, keepId, dropId);
    dropped.add(dropId);
    droppedPlaces.push(drop);
    byId.delete(dropId);
    log.push(
      `${keepId} ${keep.ko} ← ${dropId} ${drop.ko}${changed.length ? ` (옮긴 값: ${changed.join(" · ")})` : ""}`,
    );
  }
  for (const p of byId.values())
    if (!p.pickCity && p.locKo) p.pickCity = p.locKo;

  const keptPlaces = places.filter((p) => !dropped.has(p.id));
  const keptAdded = added.filter((p) => !dropped.has(p.id));
  regions.placeCounts = placeCounts(
    [...keptPlaces, ...keptAdded],
    regions.placeCounts,
  );
  write(FILES.places, keptPlaces);
  write(FILES.added, keptAdded);
  write(FILES.details, details);
  write(FILES.signgu, signgu);
  write(FILES.regions, regions);
  write(FILES.aliases, withAliases(aliases, pairs));
  write(
    FILES.namesEn,
    withDroppedNames(readJson(FILES.namesEn), droppedPlaces),
  );
  for (const t of tables) {
    if (t.off) write(t.off, t.offData);
    write(t.app, t.appData);
  }

  for (const l of log) console.log(l);
  console.log(
    `${dry ? "[dry] " : ""}합친 쌍 ${log.length} · 뺀 장소 ${dropped.size} (places.json ${places.length} → ${keptPlaces.length}, added-places.json ${added.length} → ${keptAdded.length}) · 별명 ${Object.keys(withAliases(aliases, pairs)).length}`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
)
  main();
