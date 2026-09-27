#!/usr/bin/env node
// 테마 5개의 장소 데이터(src/features/course/data/places.json)와
// 광역 이동 관문·출발지(src/features/course/data/hubs.json)를 만든다.
// 경주 2박3일 예시 재현 테스트용 목록(src/features/course/fixtures/gyeongju-nation.json)도 함께 만든다.
//
// 사용법:
//   node scripts/build-places.mjs <체류시간_장소별.csv> <Tour Planner.dc.html> <RESCENE Route.dc.html>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천 (Tour-Navigator-App main f44eb97 · 2026-09-27, 원천 파일은 이 리포에 넣지 않는다):
//   - 체류시간 산정/체류시간_장소별.csv   장소 3,118곳 (UTF-8 BOM, 따옴표 칸 있음. 목록 밖은 「목록외」, 무장애는 「열린관광지」 열)
//   - Tour Planner.dc.html                 REGION_HUB · ORIGINS · METRO_NET 상수
//   - RESCENE Route.dc.html                DATA (RESCENE 장소 id)
//
// 테마 ↔ CSV `화면` 열:
//   kings-warden → yeongwol, kpop-demon-hunters → seoul, jeju-k-drama → jeju,
//   busan-film-trip → busan, rescene-route → nation 중 RESCENE 장소
//   (목록 · 목록 밖 = 5 · 13, 11 · 76, 11 · 75, 12 · 60, 36 · 56. 테마 화면 파일 DATA의 off와 같다)
//
// RESCENE 장소 기준:
//   `RESCENE Route.dc.html`의 `const DATA = {…}` 블록(gyeongju · geoje · nation 목록)에 있는 id 92개.
//   CSV nation 화면에 92개가 모두 있어야 한다(없으면 멈춘다).
// 경주 2박3일 예시 재현(course/schedule.test.ts)은 PoC export_stay_csv.js처럼 nation 전체에서 경주 장소를 고르므로,
// CSV nation 화면에서 시군이 경주인 장소(RESCENE 밖 장소 포함)를 fixtures/gyeongju-nation.json에 따로 둔다.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const [csvPath, plannerPath, rescenePath] = process.argv.slice(2);
if (!csvPath || !plannerPath || !rescenePath) {
  console.error(
    "사용법: node scripts/build-places.mjs <체류시간_장소별.csv> <Tour Planner.dc.html> <RESCENE Route.dc.html>",
  );
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "src/features/course/data");
const FIXTURE_DIR = resolve(ROOT, "src/features/course/fixtures");

// ── CSV ──────────────────────────────────────────────────────────────
/** RFC 4180 CSV. 따옴표 칸 안의 쉼표 · 줄바꿈 · "" 를 처리한다 */
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

const csvText = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
const [header, ...body] = parseCsv(csvText).filter(
  (r) => r.length > 1 || r[0] !== "",
);
const records = body.map((r) =>
  Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])),
);

const yn = (v) => v === "Y";
const hmToMin = (v) => {
  if (!v) return null;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
};

/** CSV 한 행 → 장소. 필드 이름은 stay_schedule.js가 읽는 장소 레코드 이름을 따른다 */
function toPlace(r) {
  const open = hmToMin(r["개장(파싱)"]);
  let close = hmToMin(r["폐장(파싱)"]);
  // CSV 폐장은 close % 1440 으로 적혀 있다. openHours처럼 폐장 ≤ 개장이면 자정을 넘긴 것으로 본다
  if (open !== null && close !== null && close <= open) close += 24 * 60;
  const n = Number(r["순번"]);
  return {
    id: r.id,
    // 화면 순번. 확장 장소는 CSV에 "·"로 적혀 있어 null
    n: Number.isFinite(n) && r["순번"] !== "" ? n : null,
    ko: r["장소명"],
    en: r["장소명(영문)"],
    // CSV 시군 = p.locKo || 화면 도시명
    locKo: r["시군"],
    cat: r["분류코드"],
    lat: Number(r["위도"]),
    lng: Number(r["경도"]),
    min: Number(r["권장체류(분)"]),
    hrs: r["운영시간(원문)"],
    open: r["운영시간적용"] === "Y" ? open : null,
    close: r["운영시간적용"] === "Y" ? close : null,
    yt: yn(r["영상장소"]),
    off: yn(r["목록외"]),
    k100: yn(r["한국관광100선"]),
    un: yn(r["유네스코"]),
    bf: yn(r["열린관광지"]),
    auto: yn(r["자동코스후보"]),
  };
}

// ── RESCENE id ──────────────────────────────────────────────────────
const resceneLines = readFileSync(rescenePath, "utf8").split("\n");
const dataStart = resceneLines.findIndex((l) => /^const DATA\s*=/.test(l));
const dataEnd = resceneLines.findIndex(
  (l, i) => i > dataStart && /^};/.test(l),
);
if (dataStart < 0 || dataEnd < 0)
  throw new Error("RESCENE Route.dc.html에서 DATA 블록을 찾지 못했습니다");
const resceneIds = new Set(
  [
    ...resceneLines
      .slice(dataStart, dataEnd + 1)
      .join("\n")
      .matchAll(/\bid:'([a-z0-9]+)'/g),
  ].map((m) => m[1]),
);

// ── 테마별 장소 ─────────────────────────────────────────────────────
const THEME_SCREENS = [
  ["kings-warden", "yeongwol"],
  ["kpop-demon-hunters", "seoul"],
  ["jeju-k-drama", "jeju"],
  ["busan-film-trip", "busan"],
  ["rescene-route", "nation"],
];

const themes = {};
for (const [slug, screen] of THEME_SCREENS) {
  const rows = records.filter(
    (r) =>
      r["화면"] === screen &&
      (slug !== "rescene-route" || resceneIds.has(r.id)),
  );
  themes[slug] = rows.map(toPlace);
}
const resceneCount = themes["rescene-route"].length;
if (resceneCount !== resceneIds.size)
  throw new Error(
    `RESCENE id ${resceneIds.size}개 중 CSV nation에 ${resceneCount}개만 있습니다`,
  );

// ── 관문 · 출발지 ───────────────────────────────────────────────────
const plannerLines = readFileSync(plannerPath, "utf8").split("\n");
function evalConst(name) {
  const start = plannerLines.findIndex((l) =>
    new RegExp(`^const ${name}\\s*=`).test(l),
  );
  if (start < 0) throw new Error(`Tour Planner.dc.html에 ${name}이 없습니다`);
  let src;
  if (
    /;\s*(\/\/.*)?$/.test(plannerLines[start]) &&
    !/=\s*{\s*$/.test(plannerLines[start])
  ) {
    src = plannerLines[start];
  } else {
    const end = plannerLines.findIndex((l, i) => i > start && /^};/.test(l));
    src = plannerLines.slice(start, end + 1).join("\n");
  }
  return vm.runInNewContext(`${src}\n;${name}`);
}
const REGION_HUB = evalConst("REGION_HUB");
const ORIGINS = evalConst("ORIGINS");
const METRO_NET = evalConst("METRO_NET");

const usedRegions = new Set(
  Object.values(themes).flatMap((list) => list.map((p) => p.locKo)),
);
const regionHubs = Object.fromEntries(
  Object.entries(REGION_HUB).filter(([k]) => usedRegions.has(k)),
);

// ── 쓰기 ────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(FIXTURE_DIR, { recursive: true });
const write = (file, data) => {
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote", file);
};

write(resolve(OUT_DIR, "places.json"), themes);
write(resolve(OUT_DIR, "hubs.json"), {
  regionHubs,
  origins: ORIGINS,
  metroCities: METRO_NET,
});
// 경주 2박3일 예시(export_stay_csv.js)가 쓴 후보 목록: nation 화면에서 시군이 경주인 장소, 화면 순서 그대로
write(
  resolve(FIXTURE_DIR, "gyeongju-nation.json"),
  records
    .filter((r) => r["화면"] === "nation" && r["시군"] === "경주")
    .map(toPlace),
);

for (const [slug, list] of Object.entries(themes))
  console.log(slug, list.length);
console.log("regionHubs", Object.keys(regionHubs).join(" "));
