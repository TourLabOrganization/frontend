#!/usr/bin/env node
// 투어 플래너(/planner)의 장소 데이터(src/features/planner/data/places.json)와
// 권역 · 도시 데이터(src/features/planner/data/regions.json)를 만든다.
//
// 사용법:
//   node scripts/build-planner.mjs <체류시간_장소별.csv> <Tour Planner.dc.html>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천 (Tour-Navigator-App, 원천 파일은 이 리포에 넣지 않는다):
//   - 체류시간 산정/체류시간_장소별.csv   장소 1,171곳 (화면별 seoul 87 · busan 72 · jeju 86 · yeongwol 18 · nation 908)
//   - Tour Planner.dc.html                 DATA(장소 · 설명 · 사진) · CITY_NAME · REGION_HUB · cityGroups 안의 REG(권역 7개)
//
// 규칙:
//   - 장소 필드 이름은 src/features/course/places.ts의 Place 타입과 같다(일정 모듈이 그대로 먹는다).
//     체류분 · 운영시간 · 플래그는 CSV 값을 쓰고(id로 조인), 설명(bKo · bEn) · 사진(img · imgCredit)은 DATA에서 가져온다
//   - 도시(locKo) = DATA 키가 도시(gyeongju · geoje · yeongwol · seoul · jeju · busan)면 그 도시 이름,
//     nation이면 장소의 locKo, 없으면 CSV 「시군」
//   - 권역(macro) = 도시가 들어 있는 REG 권역 key
//   - 값이 없으면 비운다(지어내지 않는다). 두 원천이 다르면 개수를 출력한다
//   - 출발지는 여기서 만들지 않는다. src/features/course/data/hubs.json의 origins를 쓴다(scripts/build-places.mjs)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const [csvPath, plannerPath] = process.argv.slice(2);
if (!csvPath || !plannerPath) {
  console.error(
    "사용법: node scripts/build-planner.mjs <체류시간_장소별.csv> <Tour Planner.dc.html>",
  );
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "src/features/planner/data");

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
const csvById = new Map(records.map((r) => [r.id, r]));

const yn = (v) => v === "Y";
const hmToMin = (v) => {
  if (!v) return null;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
};
const present = (v) => v !== undefined && v !== null && v !== "";

// ── Tour Planner.dc.html 상수 ───────────────────────────────────────
const plannerLines = readFileSync(plannerPath, "utf8").split("\n");

/** 맨 앞 줄의 `const NAME={` … `};` 블록을 평가한다 */
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

/** cityGroups 안에 들여 쓴 `const REG=[` … `];` 블록(권역 7개). 첫 번째 것을 쓴다 */
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

const DATA = evalConst("DATA");
const CITY_NAME = evalConst("CITY_NAME");
const REGION_HUB = evalConst("REGION_HUB");
const REG = evalReg();

const macroOf = new Map();
for (const r of REG) for (const c of r.cities) macroOf.set(c, r.key);

// ── 사진 주소 ───────────────────────────────────────────────────────
// scripts/build-theme-extras.mjs의 sizedImage와 같다. 원본 파일(upload.wikimedia.org/…/파일)은 수 MB라
// Special:FilePath?width=960 꼴로 바꾸고, 목록 섬네일은 화면에서 width만 줄여 쓴다(features/theme/place-meta.ts placePhoto)
const THUMB_WIDTH = 960;
function sizedImage(url) {
  const u = new URL(url);
  if (
    u.hostname === "upload.wikimedia.org" &&
    !u.pathname.includes("/thumb/")
  ) {
    const m = u.pathname.match(
      /^\/wikipedia\/commons\/[0-9a-f]\/[0-9a-f]{2}\/(.+)$/,
    );
    if (m)
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${m[1]}?width=${THUMB_WIDTH}`;
  }
  return url;
}

// ── 장소 ────────────────────────────────────────────────────────────
const mismatch = {
  csvOnly: 0,
  dataOnly: 0,
  ko: 0,
  en: 0,
  cat: 0,
  latLng: 0,
  min: 0,
  hrs: 0,
  city: 0,
  noCity: 0,
  noMacro: 0,
};

const places = [];
const seen = new Set();
for (const [key, group] of Object.entries(DATA)) {
  for (const p of group.places) {
    seen.add(p.id);
    const r = csvById.get(p.id);
    if (!r) {
      mismatch.dataOnly++;
      continue;
    }
    if (r["장소명"] !== p.ko) mismatch.ko++;
    if (r["장소명(영문)"] !== p.en) mismatch.en++;
    if (r["분류코드"] !== p.cat) mismatch.cat++;
    if (Number(r["위도"]) !== p.lat || Number(r["경도"]) !== p.lng)
      mismatch.latLng++;
    if (Number(r["권장체류(분)"]) !== p.min) mismatch.min++;
    if (r["운영시간(원문)"] !== p.hrs) mismatch.hrs++;

    const city = key === "nation" ? p.locKo || r["시군"] : group.ko;
    if (city !== r["시군"]) mismatch.city++;
    if (!city) mismatch.noCity++;
    const macro = macroOf.get(city);
    if (!macro) mismatch.noMacro++;

    const open = hmToMin(r["개장(파싱)"]);
    let close = hmToMin(r["폐장(파싱)"]);
    // CSV 폐장은 close % 1440 으로 적혀 있다. 폐장 ≤ 개장이면 자정을 넘긴 것으로 본다(build-places.mjs와 같다)
    if (open !== null && close !== null && close <= open) close += 24 * 60;
    const n = Number(r["순번"]);
    const applied = r["운영시간적용"] === "Y";

    const place = {
      id: r.id,
      n: Number.isFinite(n) && r["순번"] !== "" ? n : null,
      ko: r["장소명"],
      en: r["장소명(영문)"],
      locKo: city,
      cat: r["분류코드"],
      lat: Number(r["위도"]),
      lng: Number(r["경도"]),
      min: Number(r["권장체류(분)"]),
      hrs: r["운영시간(원문)"],
      open: applied ? open : null,
      close: applied ? close : null,
      yt: yn(r["영상장소"]),
      off: yn(r["확장장소"]),
      k100: yn(r["한국관광100선"]),
      un: yn(r["유네스코"]),
      bf: yn(r["무장애"]),
      auto: yn(r["자동코스후보"]),
      macro: macro ?? "",
    };
    const desc = {};
    if (present(p.bKo)) desc.ko = p.bKo;
    if (present(p.bEn)) desc.en = p.bEn;
    if (Object.keys(desc).length > 0) place.desc = desc;
    if (present(p.img)) place.img = sizedImage(p.img);
    if (present(p.imgCredit)) place.imgCredit = p.imgCredit;
    places.push(place);
  }
}
for (const id of csvById.keys()) if (!seen.has(id)) mismatch.csvOnly++;

// ── 권역 · 도시 ─────────────────────────────────────────────────────
const round4 = (v) => Math.round(v * 1e4) / 1e4;
const cities = {};
for (const r of REG) {
  for (const c of r.cities) {
    const ps = places.filter((p) => p.locKo === c);
    const entry = { en: CITY_NAME[c]?.en ?? "" };
    if (ps.length > 0) {
      entry.lat = round4(ps.reduce((s, p) => s + p.lat, 0) / ps.length);
      entry.lng = round4(ps.reduce((s, p) => s + p.lng, 0) / ps.length);
    }
    cities[c] = entry;
  }
}
// 여행 정보 탭의 관문: 장소가 있는 도시의 REGION_HUB (course/data/hubs.json과 같은 모양)
const usedCities = new Set(places.map((p) => p.locKo));
const hubs = Object.fromEntries(
  Object.entries(REGION_HUB).filter(([c]) => usedCities.has(c)),
);

const regions = {
  regions: REG.map((r) => ({
    key: r.key,
    ko: r.ko,
    en: r.en,
    cities: r.cities,
  })),
  cities,
  hubs,
};

// ── 쓰기 ────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const write = (file, data) => {
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote", file);
};
write(resolve(OUT_DIR, "places.json"), places);
write(resolve(OUT_DIR, "regions.json"), regions);

// ── 대조 ────────────────────────────────────────────────────────────
const byScreen = {};
for (const r of records) byScreen[r["화면"]] = (byScreen[r["화면"]] ?? 0) + 1;
console.log("CSV 화면별", byScreen, "합계", records.length);
console.log(
  "DATA 키별",
  Object.fromEntries(
    Object.entries(DATA).map(([k, g]) => [k, g.places.length]),
  ),
);
console.log("places.json", places.length);
console.log("CSV · DATA 불일치", mismatch);
const byMacro = {};
for (const p of places) byMacro[p.macro] = (byMacro[p.macro] ?? 0) + 1;
console.log("권역별 장소", byMacro);
console.log(
  "장소 없는 REG 도시",
  Object.keys(cities).filter((c) => !usedCities.has(c)),
);
console.log(
  "영어 이름 없는 REG 도시(CITY_NAME에 없음)",
  Object.entries(cities)
    .filter(([, v]) => !v.en)
    .map(([c]) => c),
);
console.log("관문 있는 도시", Object.keys(hubs).length, "/", usedCities.size);
