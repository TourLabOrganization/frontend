#!/usr/bin/env node
// 홈 「지역 시티투어」 데이터를 만든다.
//   src/features/home/data/citytour.json   노선 280개 + 노선마다 투어 플래너에 담을 장소 id
//
// 사용법 (build-planner.mjs를 먼저 돌려 플래너 장소 데이터가 최신이어야 한다):
//   node scripts/build-citytour.mjs <Tour-Navigator-App/data/citytour.json>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천 (Tour-Navigator-App main f44eb97 · 2026-09-27, 원천 파일은 이 리포에 넣지 않는다):
//   - data/citytour.json   한 노선이 헤더 없는 배열 13칸
//                          도시 · 노선명 · 유형(순환형 · 고정형) · 탑승지 · 경유지 · 첫차 · 막차 · 배차간격 · 요금 · 전화 · 홈페이지 · 비고 · 기준일
//                          (칼럼 이름은 파생 데이터/시티투어.csv · 파생 데이터/README.md)
//   - 이 리포의 src/features/planner/data/places.json · place-details.json(ct = 장소.csv 시티투어경유)
//
// 규칙:
//   - 유형은 순환형 → loop, 고정형 → fixed(화면 표기 「코스형」, 시티투어.csv와 같다)
//   - 첫차 · 막차는 HH:MM으로 맞춘다(0930 → 09:30). 못 읽으면 빈 문자열
//   - 홈페이지는 http(s) 주소만 남긴다. 배차간격 · 비고는 화면에 쓰지 않아 뺀다
//   - 담을 장소(placeIds)는 src/features/home/citytour-match.ts의 stopPool · matchStops(목업 addCityTour 규칙)로 고른다.
//     노선 지역 이름과 같은 경유지(출발 · 도착 도시)는 대조하지 않는다(목업과 다른 점, citytour-match.ts 주석).
//     코스 도시(city)는 첫 장소의 도시(locKo). 담을 장소가 없으면 placeIds는 빈 배열, city는 null
//   - 값은 원천 그대로 두고 지어내지 않는다

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { matchStops, stopPool } from "../src/features/home/citytour-match.ts";

const [sourcePath] = process.argv.slice(2);
if (!sourcePath) {
  console.error(
    "사용법: node scripts/build-citytour.mjs <Tour-Navigator-App/data/citytour.json>",
  );
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLANNER_DIR = resolve(ROOT, "src/features/planner/data");
const OUT = resolve(ROOT, "src/features/home/data/citytour.json");

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const rows = readJson(sourcePath);
const places = readJson(resolve(PLANNER_DIR, "places.json"));
const details = readJson(resolve(PLANNER_DIR, "place-details.json"));

const matchPlaces = places.map((p) => ({
  id: p.id,
  ko: p.ko,
  cat: p.cat,
  locKo: p.locKo,
  pickCity: p.pickCity,
  ct: details[p.id]?.ct === true,
}));
const locOf = new Map(places.map((p) => [p.id, p.locKo]));

const KIND = { 순환형: "loop", 고정형: "fixed" };

/** 0930 · 09:30 · 9:30 → 09:30. 못 읽으면 "" */
function clock(value) {
  const m = String(value ?? "").match(/^(\d{1,2}):?(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

let unknownKind = 0;
let noMatch = 0;
const tours = rows.map((x) => {
  const [region, name, kind, board, route, first, last] = x;
  if (!KIND[kind]) unknownKind++;
  const { ids } = matchStops(route, stopPool(region, matchPlaces), region);
  if (ids.length === 0) noMatch++;
  return {
    region,
    name,
    kind: KIND[kind] ?? "fixed",
    board,
    route,
    first: clock(first),
    last: clock(last),
    fare: x[8] ?? "",
    tel: x[9] ?? "",
    url: /^https?:\/\//.test(x[10] ?? "") ? x[10] : "",
    date: x[12] ?? "",
    city: ids.length > 0 ? locOf.get(ids[0]) : null,
    placeIds: ids,
  };
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(tours, null, 2) + "\n", "utf8");

const regions = new Set(tours.map((t) => t.region)).size;
console.log(
  `시티투어 ${tours.length}개 노선 · ${regions}개 지역 → ${OUT}`,
  `\n  담을 장소가 없는 노선 ${noMatch}개`,
  unknownKind ? `\n  모르는 유형 ${unknownKind}개(fixed로 둠)` : "",
);
