#!/usr/bin/env node
// 장소 시트 「좌표 기준」 줄(place-details.json src)에서 작업 기록을 지운다(2026-10-04 사용자 요청).
//   지우는 것: 작업 날짜, 「사용자 요청」, 「지도 검증 필요」 · 「확인 필요」, 노선 표기 · 언급 횟수 같은 대조 메모, 「정정」
//   남기는 것: 출처 종류(국가유산 보물 소재지(보물 n건) · 열린관광지(연도 선정) · 시티투어 경유지(n개 노선) …), 좌표 근거(주소 기준 좌표), 대략 위치
// 장소를 넣는 스크립트(add-manual-places.mjs)도 같은 cleanSource로 적는다. 원본 표(scripts/data/*.csv)의 출처 메모는 그대로 둔다.
//
// 사용법:
//   node scripts/clean-place-sources.mjs [--dry]
//   npm run format
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DETAILS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/features/planner/data/place-details.json",
);

/** [찾기, 바꾸기] 순서대로 적용한다 */
const RULES = [
  [/좌표 수기 입력\([^)]*\)/g, "주소 기준 좌표"],
  [/사용자 요청\(의령 관광지,[^)]*\)/g, "의령군 문화관광 자료"],
  [/사용자 요청\([^)]*\)/g, ""],
  [
    /국가유산 보물 소재지\(보물 (\d+)건,[^)]*\)/g,
    "국가유산 보물 소재지(보물 $1건)",
  ],
  [/국보 목록 재점검\([^)]*\)/g, "국가유산 국보 소재지"],
  [/국보 소재지\([^)]*점검\)/g, "국가유산 국보 소재지"],
  [/국보 소장처\([^)]*\)/g, "국가유산 국보 소장처"],
  [/열린관광지\((\d{4})년 선정,[^)]*\)/g, "열린관광지($1년 선정)"],
  [
    /한국관광공사 연관 관광지\(기존 장소 설명에 \d+회 언급\)/g,
    "한국관광공사 연관 관광지",
  ],
  [
    /시티투어 경유지\((\d+)개 노선, 노선 표기 「[^」]*」\)/g,
    "시티투어 경유지($1개 노선)",
  ],
  [/\s*\((?:지도 )?(?:확인|검증) 필요\)/g, ""],
  [/주소 기준으로 좌표 정정/g, "주소 기준 좌표"],
  [/좌표로 정정/g, "좌표"],
  [/\d{4}-\d{2}-\d{2}\s*/g, ""],
];

/** 좌표 기준 문구에서 작업 기록을 지운다(빈 칸 · 겹친 구분자 정리) */
export function cleanSource(text) {
  let s = String(text ?? "");
  for (const [re, to] of RULES) s = s.replace(re, to);
  const parts = s
    .split(" · ")
    .map((x) => x.replace(/\(\s*\)/g, "").trim())
    .filter(Boolean);
  return [...new Set(parts)].join(" · ");
}

function main() {
  const dry = process.argv.includes("--dry");
  const details = JSON.parse(readFileSync(DETAILS, "utf8"));
  let changed = 0;
  for (const d of Object.values(details)) {
    for (const lang of ["ko", "en"]) {
      const raw = d.src?.[lang];
      if (!raw) continue;
      const next = cleanSource(raw);
      if (next === raw) continue;
      changed++;
      if (next) d.src[lang] = next;
      else delete d.src[lang];
    }
  }
  console.log(`좌표 기준 문구 ${changed}건 정리`);
  if (dry) return console.log("--dry: 파일은 그대로");
  writeFileSync(DETAILS, JSON.stringify(details, null, 2) + "\n", "utf8");
  console.log("썼다. npm run format 을 돌려 포맷을 맞추세요");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
