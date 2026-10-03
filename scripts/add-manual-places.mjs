#!/usr/bin/env node
// 수기로 정리한 장소 목록(CSV)을 투어 플래너 추가 장소에 누적한다(관광공사 키 없이).
//   scripts/data/citytour-manual-places.csv  시티투어 경유지 중 앱에 없는 관광지(lib/tour-collect.ts cityTourStops)를 사람이 골라 좌표를 적은 표
//   scripts/data/related-manual-places.csv   기존 연관 관광지 행의 설명에 이름이 나오지만 앱에 없는 관광지(Data-Analytics related_mentioned_missing)를 사람이 골라 적은 표
//   scripts/data/crowd-manual-places.csv     혼잡도(집중률) 관광지와 같은 명단인 데이터랩 인기 관광지(연령대별 순위, Data-Analytics age_upgrade/data/raw) 중 앱에 없는 곳을 사람이 적은 표
//   열: region(앱 도시) · stopName(노선 표기) · tours(노선 수) · ko · en · cat · lat · lng · signgu(법정동 시군구 코드) · muni(시군구 이름) · desc · descEn(영어 설명)
//       · nearOk(1이면 기존 장소 250m 안이어도 다른 곳으로 보고 넣는다. 사람이 확인한 이웃 장소: 벽화골목 옆 해양공원, 박물관 옆 옛 읍사무소 …)
//       · source(출처 앞 문구. 비면 「시티투어 경유지(n개 노선, 노선 표기 「…」)」. 연관 관광지 표(scripts/data/related-manual-places.csv)는 「한국관광공사 연관 관광지(… 언급)」)
//
// 사용법:
//   node scripts/add-manual-places.mjs [scripts/data/citytour-manual-places.csv] [--dry]
//   node scripts/build-citytour.mjs <Tour-Navigator-App/data/citytour.json>   # 노선의 placeIds를 새 장소까지 잇는다
//   npm run format
//
// 규칙(수집기 lib/tour-collect.ts와 같다):
//   - id는 ctm<sha1(region|ko) 앞 8자리>: 같은 도시 · 같은 이름이면 다시 돌려도 같은 id라 두 번 들어가지 않는다(mergeAdded가 기존 id는 건너뛴다)
//   - 기존 장소(places.json + added-places.json)와 250m 안이거나, 1km 안에서 이름 글자쌍이 절반 넘게 겹치면 이미 있는 장소로 보고 넣지 않는다
//   - 추천 체류는 범주의 기존 중앙값, 출처에 「좌표 수기 입력(지도 검증 필요)」을 적는다. 좌표는 관광정보가 아니라 사람이 적은 값이다
//   - 권역은 그 도시 장소의 권역, 장소가 아직 없는 도시(김포 · 부천 · 광명)는 regions.json 권역 도시 목록에서. 그 도시는 regions.json cities에 en · lat · lng가 있어야 한다
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeAdded } from "./add-popular-places.mjs";

// lib/tour-popular.ts의 SAME_SPOT_M · NEAR_SPOT_M · NEAR_SPOT_OVERLAP · meters · spotName · nameOverlap와 같다
// (그 모듈은 플래너 데이터를 끌어와 node가 바로 못 읽는다)
const SAME_SPOT_M = 250;
const NEAR_SPOT_M = 1000;
const NEAR_SPOT_OVERLAP = 0.5;

function meters(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) *
      Math.cos(lat2 * r) *
      Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

function spotName(value) {
  return String(value ?? "")
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .replace(/[\s·]/g, "")
    .replace(/(해수욕장|해안)$/, "해변")
    .replace(/(전통시장|재래시장)$/, "시장");
}

export function nameOverlap(a, b) {
  const pairs = (s) => {
    const n = spotName(s);
    const out = [];
    for (let i = 0; i < n.length - 1; i++) out.push(n.slice(i, i + 2));
    return out;
  };
  const x = pairs(a);
  const y = pairs(b);
  if (x.length === 0 || y.length === 0) return 0;
  const rest = [...y];
  let hit = 0;
  for (const p of x) {
    const i = rest.indexOf(p);
    if (i >= 0) {
      hit++;
      rest.splice(i, 1);
    }
  }
  return (2 * hit) / (x.length + y.length);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "src/features/planner/data");
const DEFAULT_CSV = resolve(ROOT, "scripts/data/citytour-manual-places.csv");
const DATE = "2026-10-03";

/** 쉼표 · 큰따옴표를 다루는 작은 CSV 파서 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((v) => v !== ""));
  return body.map((r) =>
    Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])),
  );
}

/** 수기 장소 id: ctm + sha1(도시|이름) 앞 8자리 */
export function manualId(region, ko) {
  return (
    "ctm" +
    createHash("sha1").update(`${region}|${ko}`).digest("hex").slice(0, 8)
  );
}

/** 범주별 추천 체류 중앙값(분) */
export function stayMedians(places) {
  const by = new Map();
  for (const p of places) {
    if (!Number.isFinite(p.min)) continue;
    if (!by.has(p.cat)) by.set(p.cat, []);
    by.get(p.cat).push(p.min);
  }
  const out = {};
  for (const [cat, v] of by) {
    v.sort((a, b) => a - b);
    const m = v.length >> 1;
    out[cat] = v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
  }
  return out;
}

/** 도시의 권역(그 도시 장소에 가장 많은 값. 장소가 없는 도시는 regions.json 권역 도시 목록에서) */
export function regionMacro(places, region, regions = []) {
  const counts = new Map();
  for (const p of places)
    if ((p.pickCity ?? p.locKo) === region)
      counts.set(p.macro, (counts.get(p.macro) ?? 0) + 1);
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    regions.find((r) => r.cities?.includes(region))?.key ??
    null
  );
}

/** 기존 장소와 같은 곳인지(250m 안, 또는 1km 안에서 이름 절반 겹침) */
export function nearExisting(spot, pool) {
  let best = null;
  let bestD = Infinity;
  for (const p of pool) {
    const d = meters(spot.lat, spot.lng, p.lat, p.lng);
    if (d > NEAR_SPOT_M || d >= bestD) continue;
    if (d > SAME_SPOT_M && nameOverlap(spot.ko, p.ko) < NEAR_SPOT_OVERLAP)
      continue;
    best = p;
    bestD = d;
  }
  return best;
}

/**
 * CSV 행을 추가 장소(mergeAdded 입력)로 바꾼다. 기존 장소와 겹치는 행은 skipped에 적는다(순수 함수, 테스트용)
 * @returns {{ places: Record<string, unknown>[], skipped: { row: Record<string,string>, reason: string, id?: string }[] }}
 */
export function manualPlaces(rows, pool, date = DATE, regions = []) {
  const stays = stayMedians(pool);
  const places = [];
  const skipped = [];
  const seen = new Set();
  const live = [...pool];
  for (const row of rows) {
    const lat = row.lat?.trim() ? Number(row.lat) : NaN;
    const lng = row.lng?.trim() ? Number(row.lng) : NaN;
    const ko = row.ko.trim();
    const region = row.region.trim();
    if (!ko || !region || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped.push({ row, reason: "빈 이름 · 도시 · 좌표" });
      continue;
    }
    const macro = regionMacro(pool, region, regions);
    if (!macro) {
      skipped.push({ row, reason: `앱에 없는 도시 ${region}` });
      continue;
    }
    const id = manualId(region, ko);
    if (seen.has(id)) {
      skipped.push({ row, reason: "표 안 중복", id });
      continue;
    }
    const near =
      row.nearOk?.trim() === "1" ? null : nearExisting({ ko, lat, lng }, live);
    if (near) {
      skipped.push({ row, reason: `기존 장소 ${near.ko}`, id: near.id });
      continue;
    }
    seen.add(id);
    const cat = row.cat.trim() || "heal";
    const tours = Number(row.tours) || 1;
    const place = {
      id,
      n: null,
      ko,
      en: row.en.trim() || ko,
      locKo: region,
      cat,
      lat,
      lng,
      min: stays[cat] ?? 60,
      hrs: "",
      open: null,
      close: null,
      yt: false,
      off: true,
      k100: false,
      un: false,
      bf: false,
      auto: false,
      macro,
      pickCity: region,
      signgu: /^\d{5}$/.test(row.signgu.trim()) ? row.signgu.trim() : "",
      contentid: "",
      addr: "",
      photo: "",
      zh: "",
      ja: "",
      source: `${row.source?.trim() || `시티투어 경유지(${tours}개 노선, 노선 표기 「${row.stopName.trim() || ko}」)`} · 좌표 수기 입력(지도 검증 필요, ${date})`,
      desc: row.desc.trim() || `${region} 시티투어 경유지(${tours}개 노선)`,
      descEn: row.descEn?.trim() ?? "",
    };
    places.push(place);
    live.push(place);
  }
  return { places, skipped };
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const csvPath = resolve(args.find((a) => !a.startsWith("--")) ?? DEFAULT_CSV);
  const read = (f) => JSON.parse(readFileSync(resolve(DATA, f), "utf8"));
  const files = {
    added: read("added-places.json"),
    signgu: read("signgu.json"),
    regions: read("regions.json"),
    details: read("place-details.json"),
  };
  const base = read("places.json");
  const pool = [...base, ...files.added];
  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const { places, skipped } = manualPlaces(
    rows,
    pool,
    DATE,
    files.regions.regions ?? [],
  );
  for (const s of skipped)
    console.log(
      `  - ${s.row.region} ${s.row.ko}: ${s.reason}${s.id ? ` (${s.id})` : ""}`,
    );
  const merged = mergeAdded(places, files);
  for (const id of merged.newIds) {
    const p = merged.added.find((x) => x.id === id);
    console.log(`  + ${id} ${p.ko} (${p.locKo} · ${p.cat})`);
  }
  console.log(
    `표 ${rows.length}행 · 건너뜀 ${skipped.length} · 추가 장소 ${files.added.length} → ${merged.added.length}곳 (이번 ${merged.newIds.length}곳)`,
  );
  if (dry || merged.newIds.length === 0) {
    console.log(dry ? "--dry: 파일은 그대로" : "새 장소가 없어 파일은 그대로");
    return;
  }
  const write = (f, v) =>
    writeFileSync(resolve(DATA, f), JSON.stringify(v, null, 2) + "\n");
  write("added-places.json", merged.added);
  write("signgu.json", merged.signgu);
  write("regions.json", merged.regions);
  write("place-details.json", merged.details);
  console.log("썼다. npm run format 을 돌려 포맷을 맞추세요");
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
)
  main();
