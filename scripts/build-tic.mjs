#!/usr/bin/env node
// 투어 플래너 여행 정보 탭 「관광안내소」 데이터를 만든다.
//   src/features/planner/data/tic.json   전국 관광안내소 725곳
//
// 사용법:
//   node scripts/build-tic.mjs <Tour-Navigator-App/data/tic.json>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천 (Tour-Navigator-App main f44eb97, 원천 파일은 이 리포에 넣지 않는다):
//   - data/tic.json   한 곳이 헤더 없는 배열 9칸
//                     안내소명 · 시군 · 위도 · 경도 · 전화 · 운영시간 · 휴무 · 외국어 · 주소
//                     (칼럼 이름은 파생 데이터/관광안내소.csv · 파생 데이터/README.md)
//   - 출처: 한국관광공사 전국관광안내소 정보, 좌표 카카오(PoC ticSrc)
//
// 규칙:
//   - 칸 이름만 붙이고 값은 원천 그대로 둔다(지어내지 않는다). 외국어는 원문(「영/일/중」)으로 두고,
//     언어 판정은 화면 코드(src/features/planner/tic.ts langsOf, PoC langOf)가 한다
//   - 원천 순서를 그대로 둔다. 정렬은 화면 코드가 한다(PoC 규칙)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [sourcePath] = process.argv.slice(2);
if (!sourcePath) {
  console.error(
    "사용법: node scripts/build-tic.mjs <Tour-Navigator-App/data/tic.json>",
  );
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/features/planner/data/tic.json");

const rows = JSON.parse(readFileSync(sourcePath, "utf8"));
const str = (v) => (v === null || v === undefined ? "" : String(v).trim());

const out = rows.map((x, i) => {
  if (!Array.isArray(x) || x.length !== 9)
    throw new Error(`${i}번째 줄이 9칸이 아닙니다`);
  const [name, city, lat, lng, tel, hours, closed, lang, addr] = x;
  if (typeof lat !== "number" || typeof lng !== "number")
    throw new Error(`${i}번째 줄 좌표가 숫자가 아닙니다: ${name}`);
  return {
    name: str(name),
    city: str(city),
    lat,
    lng,
    tel: str(tel),
    hours: str(hours),
    closed: str(closed),
    lang: str(lang),
    addr: str(addr),
  };
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out)}\n`);
console.log(
  `관광안내소 ${out.length}곳 · 시군 ${new Set(out.map((r) => r.city)).size}곳 → ${OUT}`,
);
