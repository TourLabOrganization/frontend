#!/usr/bin/env node
// 투어 플래너 장소의 영어 이름 채우기. 원천(PoC · data-server)에 영어 이름이 없어 한국어가 그대로 들어간 장소(en = ko 또는 한글이 섞인 en)에
// 앱이 만든 영어 이름(src/features/translations/data/place-names.en.json, 장소 id → 영어)을 넣는다.
// 원천에 영어 이름이 있는 장소는 건드리지 않는다. scripts/build-planner.mjs가 places.json을 쓰기 전에 부르고,
// 번역 표만 고쳤을 때는 이 파일을 바로 실행해 지금 places.json에 다시 채운다(여러 번 실행해도 결과가 같다).
//
// 사용법:
//   node scripts/place-names.mjs   # src/features/planner/data/places.json의 en을 채운다
//   npm run format

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TABLE = resolve(
  ROOT,
  "src/features/translations/data/place-names.en.json",
);
const HANGUL = /[ㄱ-ㆎ가-힣]/;

/** 영어 이름이 없는 장소인지(원천이 en에 한국어 이름을 넣었거나 한글이 섞였다) */
export function needsEnglishName(place) {
  return !place.en || place.en === place.ko || HANGUL.test(place.en);
}

/** places의 en을 번역 표로 채운다(제자리). 채운 수와 표에 없는 장소 id를 돌려준다 */
export function fillPlaceNames(places) {
  const table = JSON.parse(readFileSync(TABLE, "utf8"));
  let filled = 0;
  const missing = [];
  for (const p of places) {
    if (!needsEnglishName(p)) continue;
    const en = table[p.id];
    if (en && !HANGUL.test(en)) {
      p.en = en;
      filled++;
    } else missing.push(p.id);
  }
  return { filled, missing };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = resolve(ROOT, "src/features/planner/data/places.json");
  const places = JSON.parse(readFileSync(file, "utf8"));
  const { filled, missing } = fillPlaceNames(places);
  writeFileSync(file, JSON.stringify(places, null, 2) + "\n", "utf8");
  console.log(`영어 이름 채움 ${filled}곳, 표에 없음 ${missing.length}곳`);
  if (missing.length) console.log(missing.join(" "));
}
