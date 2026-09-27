#!/usr/bin/env node
// 투어 플래너(/planner)의 장소 데이터와 권역 · 도시 데이터를 만든다.
//   src/features/planner/data/places.json         목록 · 지도 · 코스 · 일정에 쓰는 가벼운 필드 (클라이언트 번들에 들어간다)
//   src/features/planner/data/place-details.json  장소 시트에서만 쓰는 무거운 필드 (Route Handler만 읽는다. 시트를 열 때 불러온다)
//   src/features/planner/data/regions.json        권역 7개 · 도시 · 관문 · 출발지 · 도시별 장소 수(placeCounts)
//
// 사용법:
//   node scripts/build-planner.mjs <체류시간_장소별.csv> <Tour Planner.dc.html> <파생 데이터 폴더> [data-server 폴더]
//   (data-server 폴더를 빼면 DATA_SERVER_DIR 환경변수, 그것도 없으면 ../data-server. places.json이 없으면 멈춘다)
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천 (Tour-Navigator-App main f44eb97 · 2026-09-27, 원천 파일은 이 리포에 넣지 않는다):
//   - 체류시간 산정/체류시간_장소별.csv   장소 3,118곳. 체류분 · 운영시간 파싱 · 플래그
//   - Tour Planner.dc.html                 DATA(장소 · 설명 · 사진, 화면 gyeongju · geoje · nation · yeongwol · seoul · jeju · busan)
//                                          · CITY_NAME · REGION_HUB · ORIGINS · cityGroups 안의 REG · MACRO_REGION · MACRO_OF
//   - 파생 데이터/장소.csv                 3,118곳. 중 · 일 장소명 · 지정구역(vz) · 시티투어경유(ct) · 연관관광지(rs) · 카카오장소URL(url)
//   - 파생 데이터/지역거점.csv (110)        관문 수단(수도권 전철 metro를 더한 화면 실행 값)
//   - 파생 데이터/출발지.csv (61)           출발지 수단(위와 같다)
//   - data-server data/derived/places.json  (develop ac9eb34 · 2026-09-28) 분류 · 영어 이름 · 인기 순위 · 지정구역.
//                                          합치는 규칙은 scripts/data-server.mjs. 만든 커밋을 끝에 출력한다(docs/structure.md에 적는다)
//
// 규칙:
//   - 장소 필드 이름은 src/features/course/places.ts의 Place 타입과 같다(일정 모듈이 그대로 먹는다).
//     체류분 · 운영시간 · 플래그 · 배지는 체류시간 CSV 값(id로 조인), 설명(bKo · bEn) · 사진(img · imgCredit) · 좌표근거(srcKo · srcEn)는 DATA,
//     중 · 일 이름 · 지정구역 · 시티투어경유 · 연관관광지 · 카카오장소URL은 장소.csv에서 가져온다
//   - 도시 영어 이름 = CITY_NAME, 없으면 장소.csv 「시군(영문)」(장소의 locEn). 둘 다 없으면 빈 문자열(화면은 한국어 이름)
//   - data-server 값을 id로 덮는다: cat ← catFinal, en ← nameEn(다를 때), vz ← zone, popRank(scripts/data-server.mjs)
//   - 가벼운 필드(places.json): Place 필드 + macro · pickCity · vz(지정구역 문구, 관광특구 · 관광단지 배지) · popRank(데이터랩 인기 순위)
//     무거운 필드(place-details.json, id → 값): desc · img · imgCredit · zh · ja · src · url · ct · rs
//   - 도시(locKo) = DATA 키가 도시(gyeongju · geoje · yeongwol · seoul · jeju · busan)면 그 도시 이름,
//     nation이면 장소의 locKo, 없으면 CSV 「시군」 (목업 regionKeyOf와 같다)
//   - 권역(macro) = MACRO_OF[도시]. 목업 지도의 권역 묶음(경북권 · 경남권 · 전라권 …)이 이 값으로 센다.
//     권역의 도시 목록 = REG 도시 + MACRO_OF에만 있는 도시(목업 _mcExtra 순서). 권역 이름은 목업 지도가 그리는 MACRO_REGION 이름
//   - 도시 고르기 도시(pickCity) = 전용 화면(nation 밖 DATA 키) 장소는 그 화면 도시 이름, nation 장소는 장소의 locKo.
//     PoC cityRows는 전용 화면이 있는 도시(서울 · 부산 · 제주 · 영월 · 경주 · 거제)의 nation 장소를 버려서 그 447곳이
//     전국 보기에만 들어갔는데(예: 경주 분황사 · 경주중앙시장), 앱은 「도시를 고르면 그 도시(locKo)의 장소가 전부 나와야 한다」
//     (대표 결정 2026-09-28, 장소 3,000여 곳을 앱에 다 싣는다)에 따라 그 장소에도 pickCity = locKo를 준다.
//     단 같은 도시 · 같은 이름(공백 · 가운뎃점 · 괄호 무시) · 좌표 200m 이내 장소가 전용 화면 묶음에 이미 있으면
//     그 nation 장소는 pickCity를 주지 않는다(같은 장소가 도시 목록에 두 번 나오지 않게, 예: 서울숲). 뺀 장소를 출력한다.
//     nation 장소에 locKo가 없으면 pickCity가 없다(PoC byLoc이 locKo만 본다)
//   - 값이 없으면 비운다(지어내지 않는다). 원천끼리 다르면 개수를 출력한다
//   - 영어 이름이 없는 장소(en = ko)는 앱이 만든 영어 이름 표(src/features/translations/data/place-names.en.json)로 채운다(scripts/place-names.mjs)
//   - 관문(hubs) · 출발지(origins)의 모양은 REGION_HUB · ORIGINS 그대로(항공 · 배 좌표, 울릉 항로 등). 지역거점.csv · 출발지.csv에
//     없는 필드가 있어서다. 수단(modes)만 CSV 값(화면이 실행 중에 전철권 metro를 더한 값)으로 바꾸고, 이름 · 좌표는 CSV와 대조해 출력한다.
//     course/data/hubs.json의 origins는 테마 코스용이라 따로 둔다(scripts/build-places.mjs)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import {
  loadDataServer,
  mergeDataServer,
  resolveDataServerDir,
} from "./data-server.mjs";
import { fillPlaceNames } from "./place-names.mjs";

const [csvPath, plannerPath, derivedDir, dataServerArg] = process.argv.slice(2);
if (!csvPath || !plannerPath || !derivedDir) {
  console.error(
    "사용법: node scripts/build-planner.mjs <체류시간_장소별.csv> <Tour Planner.dc.html> <파생 데이터 폴더> [data-server 폴더]",
  );
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "src/features/planner/data");
const dataServer = loadDataServer(resolveDataServerDir(ROOT, dataServerArg));
const dsChanged = { cat: 0, en: 0 };

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

/** CSV 파일 → 헤더 이름을 키로 한 행 객체 목록 */
function readCsv(path) {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const [header, ...body] = parseCsv(text).filter(
    (r) => r.length > 1 || r[0] !== "",
  );
  return body.map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])),
  );
}

const records = readCsv(csvPath);
const csvById = new Map(records.map((r) => [r.id, r]));
const derived = readCsv(resolve(derivedDir, "장소.csv"));
const derivedById = new Map(derived.map((r) => [r.id, r]));
const hubRows = readCsv(resolve(derivedDir, "지역거점.csv"));
const originRows = readCsv(resolve(derivedDir, "출발지.csv"));

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

/** `const MACRO_REGION=` 줄부터 `const METRO_NET=` 앞까지(MACRO_REGION · MACRO_OF · _mcExtra)를 평가한다 */
function evalMacro() {
  const start = plannerLines.findIndex((l) =>
    /^const MACRO_REGION\s*=/.test(l),
  );
  const end = plannerLines.findIndex(
    (l, i) => i > start && /^const METRO_NET\s*=/.test(l),
  );
  if (start < 0 || end < 0)
    throw new Error("Tour Planner.dc.html에 MACRO_REGION 블록이 없습니다");
  const ctx = vm.createContext({});
  vm.runInContext(
    `${plannerLines.slice(start, end).join("\n")}\n;globalThis.__out={MACRO_REGION,MACRO_OF,_mcExtra};`,
    ctx,
  );
  return ctx.__out;
}

const DATA = evalConst("DATA");
const CITY_NAME = evalConst("CITY_NAME");
const REGION_HUB = evalConst("REGION_HUB");
const ORIGINS = evalConst("ORIGINS");
const REG = evalReg();
const { MACRO_REGION, MACRO_OF, _mcExtra } = evalMacro();

// REG key → MACRO_REGION key (목업 _mcExtra의 MK를 뒤집은 것)
const MACRO_KEY = {
  capital: "capital",
  gangwon: "gangwon",
  chungcheong: "chungcheong",
  daegyeong: "gyeongbuk",
  dongnam: "gyeongnam",
  honam: "jeolla",
  jeju: "jeju",
};
const regKeyOfMacro = Object.fromEntries(
  Object.entries(MACRO_KEY).map(([reg, macro]) => [macro, reg]),
);

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
// 체류시간 CSV ↔ DATA
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
// 장소.csv ↔ DATA · 체류시간 CSV
const derivedMismatch = {
  csvOnly: 0,
  dataOnly: 0,
  ko: 0,
  en: 0,
  desc: 0,
  img: 0,
  vz: 0,
  url: 0,
  badge: 0,
  off: 0,
};

// 전용 화면 도시 이름(대조 출력용)
const screenCities = new Set(
  Object.entries(DATA)
    .filter(([key]) => key !== "nation")
    .map(([, group]) => group.ko),
);

// 같은 장소 판정: 이름에서 공백 · 가운뎃점 · 괄호(와 그 안)를 빼고 비교, 좌표는 200m 이내
const sameNameKey = (name) =>
  (name ?? "")
    .replace(/\([^)]*\)|（[^）]*）/g, "")
    .replace(/[\s·ㆍ・•()（）]/g, "");
const DUP_METERS = 200;
function meters(aLat, aLng, bLat, bLng) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
// 전용 화면 묶음 장소를 「도시|이름」으로 모은다. nation 장소가 이 중 200m 이내 것과 겹치면 pickCity를 주지 않는다
const screenPlaces = new Map();
for (const [key, group] of Object.entries(DATA)) {
  if (key === "nation") continue;
  for (const p of group.places) {
    const r = csvById.get(p.id);
    const ko = r ? r["장소명"] : p.ko;
    const lat = r ? Number(r["위도"]) : p.lat;
    const lng = r ? Number(r["경도"]) : p.lng;
    const k = `${group.ko}|${sameNameKey(ko)}`;
    if (!screenPlaces.has(k)) screenPlaces.set(k, []);
    screenPlaces.get(k).push({ id: p.id, ko, lat, lng });
  }
}
/** nation 장소와 같은 장소가 전용 화면 묶음에 있으면 그 장소 */
function screenDuplicate(city, ko, lat, lng) {
  return (screenPlaces.get(`${city}|${sameNameKey(ko)}`) ?? []).find(
    (s) => meters(lat, lng, s.lat, s.lng) <= DUP_METERS,
  );
}
const cityDuplicates = [];

const places = [];
const details = {};
const seen = new Set();
for (const [key, group] of Object.entries(DATA)) {
  for (const p of group.places) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const r = csvById.get(p.id);
    const d = derivedById.get(p.id);
    if (!d) derivedMismatch.dataOnly++;
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
    if (r["운영시간(원문)"] !== (p.hrs ?? "")) mismatch.hrs++;

    const city = key === "nation" ? p.locKo || r["시군"] : group.ko;
    if (city !== r["시군"]) mismatch.city++;
    if (!city) mismatch.noCity++;
    const macro = regKeyOfMacro[MACRO_OF[city]];
    if (!macro) mismatch.noMacro++;
    let pickCity = key !== "nation" ? group.ko : p.locKo || undefined;
    if (key === "nation" && pickCity && screenCities.has(pickCity)) {
      const dup = screenDuplicate(
        pickCity,
        r["장소명"],
        Number(r["위도"]),
        Number(r["경도"]),
      );
      if (dup) {
        cityDuplicates.push(`${r.id} ${r["장소명"]} = ${dup.id} ${dup.ko}`);
        pickCity = undefined;
      }
    }

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
      off: yn(r["목록외"]),
      k100: yn(r["한국관광100선"]),
      un: yn(r["유네스코"]),
      bf: yn(r["열린관광지"]),
      auto: yn(r["자동코스후보"]),
      macro: macro ?? "",
    };
    if (pickCity) place.pickCity = pickCity;
    if (d && present(d["지정구역"])) place.vz = d["지정구역"];
    const merged = mergeDataServer(place, dataServer.byId.get(place.id));
    if (merged.changed.cat) dsChanged.cat++;
    if (merged.changed.en) dsChanged.en++;
    places.push(merged.place);

    // 시트 전용(무거운) 필드
    const detail = {};
    const desc = {};
    if (present(p.bKo)) desc.ko = p.bKo;
    if (present(p.bEn)) desc.en = p.bEn;
    if (Object.keys(desc).length > 0) detail.desc = desc;
    if (present(p.img)) detail.img = sizedImage(p.img);
    if (present(p.imgCredit)) detail.imgCredit = p.imgCredit;
    const src = {};
    if (present(p.srcKo)) src.ko = p.srcKo;
    if (present(p.srcEn)) src.en = p.srcEn;
    if (Object.keys(src).length > 0) detail.src = src;
    if (d) {
      if (present(d["장소명(중문)"])) detail.zh = d["장소명(중문)"];
      if (present(d["장소명(일문)"])) detail.ja = d["장소명(일문)"];
      if (present(d["카카오장소URL"])) detail.url = d["카카오장소URL"];
      if (yn(d["시티투어경유"])) detail.ct = true;
      if (yn(d["연관관광지"])) detail.rs = true;

      if (d["장소명"] !== p.ko) derivedMismatch.ko++;
      if (d["장소명(영문)"] !== (p.en ?? "")) derivedMismatch.en++;
      if (d["설명"] !== (p.bKo ?? "") || d["설명(영문)"] !== (p.bEn ?? ""))
        derivedMismatch.desc++;
      if (d["사진URL"] !== (p.img ?? "")) derivedMismatch.img++;
      if (d["지정구역"] !== (p.vz ?? "")) derivedMismatch.vz++;
      if (d["카카오장소URL"] !== (p.url ?? "")) derivedMismatch.url++;
      if (
        d["한국관광100선"] !== r["한국관광100선"] ||
        d["유네스코"] !== r["유네스코"] ||
        d["열린관광지"] !== r["열린관광지"]
      )
        derivedMismatch.badge++;
      if (d["목록외"] !== r["목록외"]) derivedMismatch.off++;
    }
    if (Object.keys(detail).length > 0) details[place.id] = detail;
  }
}
for (const id of csvById.keys()) if (!seen.has(id)) mismatch.csvOnly++;
for (const id of derivedById.keys())
  if (!seen.has(id)) derivedMismatch.csvOnly++;

// ── 권역 · 도시 ─────────────────────────────────────────────────────
const round4 = (v) => Math.round(v * 1e4) / 1e4;
const regions = REG.map((r) => ({
  key: r.key,
  ko: MACRO_REGION.ko[MACRO_KEY[r.key]],
  en: MACRO_REGION.en[MACRO_KEY[r.key]],
  cities: _mcExtra(r.key, r.cities),
}));
// 도시 영어 이름: CITY_NAME에 없으면 장소.csv 「시군(영문)」(장소의 locEn)
const cityEnFromCsv = new Map();
for (const d of derived)
  if (present(d["시군(영문)"]) && !cityEnFromCsv.has(d["시군"]))
    cityEnFromCsv.set(d["시군"], d["시군(영문)"]);
const cities = {};
for (const r of regions) {
  for (const c of r.cities) {
    const ps = places.filter((p) => p.locKo === c);
    const entry = { en: CITY_NAME[c]?.en ?? cityEnFromCsv.get(c) ?? "" };
    if (ps.length > 0) {
      entry.lat = round4(ps.reduce((s, p) => s + p.lat, 0) / ps.length);
      entry.lng = round4(ps.reduce((s, p) => s + p.lng, 0) / ps.length);
    }
    cities[c] = entry;
  }
}

// ── 관문 · 출발지 ───────────────────────────────────────────────────
const modesOf = (v) => (v ? v.split("|") : []);
const hubCheck = { csvOnly: 0, htmlOnly: 0, name: 0, latLng: 0, modes: 0 };
const hubCsv = new Map(hubRows.map((r) => [r["시군"], r]));
const usedCities = new Set(places.map((p) => p.locKo));
const hubs = {};
for (const [c, h] of Object.entries(REGION_HUB)) {
  const row = hubCsv.get(c);
  if (!row) {
    hubCheck.htmlOnly++;
    continue;
  }
  if (row["관문"] !== h.ko || row["관문(영문)"] !== h.en) hubCheck.name++;
  if (Number(row["위도"]) !== h.lat || Number(row["경도"]) !== h.lng)
    hubCheck.latLng++;
  const modes = modesOf(row["수단"]);
  if (modes.join("|") !== (h.modes ?? []).join("|")) hubCheck.modes++;
  // 여행 정보 탭 · 일정의 관문: 장소가 있는 도시만
  if (usedCities.has(c)) hubs[c] = { ...h, modes };
}
for (const c of hubCsv.keys()) if (!(c in REGION_HUB)) hubCheck.csvOnly++;

const originCheck = { csvOnly: 0, htmlOnly: 0, name: 0, latLng: 0, modes: 0 };
const originCsv = new Map(originRows.map((r) => [r["키"], r]));
const origins = {};
for (const [k, o] of Object.entries(ORIGINS)) {
  const row = originCsv.get(k);
  if (!row) {
    originCheck.htmlOnly++;
    origins[k] = o;
    continue;
  }
  if (row["출발지"] !== o.ko || row["출발지(영문)"] !== o.en)
    originCheck.name++;
  if (Number(row["위도"]) !== o.lat || Number(row["경도"]) !== o.lng)
    originCheck.latLng++;
  const modes = modesOf(row["수단"]);
  if (modes.join("|") !== (o.modes ?? []).join("|")) originCheck.modes++;
  origins[k] = { ...o, modes };
}
for (const k of originCsv.keys()) if (!(k in ORIGINS)) originCheck.csvOnly++;

// ── 쓰기 ────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const write = (file, data) => {
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote", file);
};
// 원천에 영어 이름이 없는 장소는 앱이 만든 영어 이름으로 채운다(scripts/place-names.mjs, docs/i18n.md)
const nameFill = fillPlaceNames(places);
console.log(
  `영어 이름 채움 ${nameFill.filled}곳, 번역 표에 없음 ${nameFill.missing.length}곳`,
);
write(resolve(OUT_DIR, "places.json"), places);
write(resolve(OUT_DIR, "place-details.json"), details);
// 도시 고르기의 도시별 장소 수(pickCity 기준). 도시 고르기 · 여행 정보 탭 도시 선택이 places.json 없이 쓴다
// (두 컴포넌트가 장소 수 때문에 장소 전체를 브라우저로 받지 않게). 장소 수 많은 순이 아니라 places.json 순서
const placeCounts = {};
for (const p of places)
  if (p.pickCity) placeCounts[p.pickCity] = (placeCounts[p.pickCity] ?? 0) + 1;
write(resolve(OUT_DIR, "regions.json"), {
  regions,
  cities,
  hubs,
  origins,
  placeCounts,
});

// ── 대조 ────────────────────────────────────────────────────────────
const byScreen = {};
for (const r of records) byScreen[r["화면"]] = (byScreen[r["화면"]] ?? 0) + 1;
console.log("체류시간 CSV 화면별", byScreen, "합계", records.length);
console.log("장소.csv", derived.length);
console.log(
  "DATA 키별",
  Object.fromEntries(
    Object.entries(DATA).map(([k, g]) => [k, g.places.length]),
  ),
);
console.log(
  "places.json",
  places.length,
  "place-details.json",
  Object.keys(details).length,
);
console.log("체류시간 CSV · DATA 불일치", mismatch);
console.log("장소.csv · DATA 불일치", derivedMismatch);
const byMacro = {};
for (const p of places) {
  const name = regions.find((r) => r.key === p.macro)?.ko ?? "(없음)";
  byMacro[name] = (byMacro[name] ?? 0) + 1;
}
console.log("권역별 장소", byMacro);
console.log(
  "장소 없는 권역 도시",
  Object.keys(cities).filter((c) => !usedCities.has(c)).length,
);
console.log(
  "영어 이름 없는 권역 도시(CITY_NAME · 장소.csv 시군(영문)에 없음)",
  Object.entries(cities)
    .filter(([, v]) => !v.en)
    .map(([c]) => c),
);
console.log(
  "장소 도시 중 관문 없는 도시",
  [...usedCities].filter((c) => !hubs[c]),
);
console.log(
  "관문",
  Object.keys(hubs).length,
  "/ 지역거점.csv",
  hubRows.length,
  hubCheck,
);
console.log(
  "출발지",
  Object.keys(origins).length,
  "/ 출발지.csv",
  originRows.length,
  originCheck,
);
const byPick = {};
for (const p of places)
  if (p.pickCity) byPick[p.pickCity] = (byPick[p.pickCity] ?? 0) + 1;
console.log(
  "도시 고르기 도시",
  Object.keys(byPick).length,
  "장소",
  Object.values(byPick).reduce((a, b) => a + b, 0),
  "전용 화면",
  Object.fromEntries([...screenCities].map((c) => [c, byPick[c]])),
  "전국에만 속한 장소",
  places.filter((p) => !p.pickCity).length,
);
console.log(
  "전용 화면 묶음과 같은 장소라 도시에 넣지 않은 nation 장소",
  cityDuplicates.length,
  cityDuplicates,
);
console.log("배지", {
  un: places.filter((p) => p.un).length,
  k100: places.filter((p) => p.k100).length,
  bf: places.filter((p) => p.bf).length,
  vz: places.filter((p) => p.vz).length,
  관광특구: places.filter((p) => p.vz?.includes("관광특구")).length,
  popRank: places.filter((p) => p.popRank).length,
});
console.log(
  "data-server",
  dataServer.commit,
  "장소",
  dataServer.count,
  "바뀐 값",
  dsChanged,
);
