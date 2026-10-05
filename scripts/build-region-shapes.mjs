#!/usr/bin/env node
// 투어 플래너 전국 지도의 권역 면(수도권 · 강원권 …)을 만든다.
//   src/features/planner/data/region-shapes.json   { [권역 key]: [고리, …] }, 고리 = [[위도, 경도], …] (바깥 경계만, 구멍 없음)
// 원천: 통계청(KOSTAT) 센서스용 행정구역경계 2018 시도 경계(southkorea/southkorea-maps kostat/2018/json/skorea-provinces-2018-geo.json).
// 시도 17곳을 권역 7곳으로 합치고(union) 단순화한 뒤, 작은 섬(면적 기준)을 뺀다. 원천 파일은 이 리포에 넣지 않는다.
//
// 사용법(Turf.js가 필요하다. 리포 의존성에는 넣지 않았다):
//   npm i --no-save @turf/turf@7
//   node scripts/build-region-shapes.mjs <skorea-provinces-2018-geo.json>
//   npm run format

import { writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [src, turfPath] = process.argv.slice(2);
if (!src) {
  console.error(
    "사용법: node scripts/build-region-shapes.mjs <skorea-provinces-2018-geo.json>",
  );
  process.exit(1);
}
const turf = await import(turfPath ?? "@turf/turf");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/features/planner/data/region-shapes.json");

/** 시도 코드(2018 KOSTAT) → 권역 key(regions.json) */
const MACRO_OF = {
  11: "capital", // 서울
  23: "capital", // 인천
  31: "capital", // 경기
  32: "gangwon", // 강원
  25: "chungcheong", // 대전
  29: "chungcheong", // 세종
  33: "chungcheong", // 충북
  34: "chungcheong", // 충남
  22: "daegyeong", // 대구
  37: "daegyeong", // 경북
  21: "dongnam", // 부산
  26: "dongnam", // 울산
  38: "dongnam", // 경남
  24: "honam", // 광주
  35: "honam", // 전북
  36: "honam", // 전남
  39: "jeju", // 제주
};
/** 단순화 허용 오차(도). 약 0.8km — 전국 · 권역 축척에서 경계가 매끄럽게 보이는 정도 */
const TOLERANCE = 0.008;
/** 남길 섬의 최소 면적(㎢). 울릉도(약 73㎢) · 백령도(약 51㎢) · 거제도 · 강화도는 남고 작은 섬(연평도 약 7㎢ 등)은 빠진다 */
const MIN_AREA_KM2 = 20;

const geo = JSON.parse(readFileSync(src, "utf8"));
const groups = {};
for (const f of geo.features) {
  const key = MACRO_OF[Number(f.properties.code)];
  if (!key) throw new Error(`모르는 시도 코드 ${f.properties.code}`);
  (groups[key] ??= []).push(f);
}

const out = {};
for (const [key, features] of Object.entries(groups)) {
  const merged =
    features.length === 1
      ? features[0]
      : turf.union(turf.featureCollection(features));
  const simple = turf.simplify(merged, {
    tolerance: TOLERANCE,
    highQuality: true,
  });
  const polys =
    simple.geometry.type === "Polygon"
      ? [simple.geometry.coordinates]
      : simple.geometry.coordinates;
  out[key] = polys
    .filter((p) => turf.area(turf.polygon(p)) / 1e6 >= MIN_AREA_KM2)
    .sort((a, b) => turf.area(turf.polygon(b)) - turf.area(turf.polygon(a)))
    // 바깥 고리만([경도, 위도] → [위도, 경도], 소수 3자리 ≈ 100m)
    .map((p) =>
      p[0].map(([lng, lat]) => [
        Math.round(lat * 1000) / 1000,
        Math.round(lng * 1000) / 1000,
      ]),
    );
  console.log(
    key,
    out[key].length,
    "고리",
    out[key].reduce((n, r) => n + r.length, 0),
    "점",
  );
}
writeFileSync(OUT, JSON.stringify(out));
console.log("→", OUT);
