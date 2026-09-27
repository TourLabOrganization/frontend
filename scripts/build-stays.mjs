#!/usr/bin/env node
// 투어 플래너 코스 탭 「숙박」 카드의 숙소 표본(예시 숙소 지역)을 만든다.
//   src/features/planner/data/stays.json
//
// 사용법:
//   node scripts/build-stays.mjs <Tour Planner.dc.html>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천: Tour Planner.dc.html의 `const STAYS={ … };`(지역 key → 숙소 목록).
//   PoC 주석: 「숙소 샘플 데이터셋 (임의 구성 — 실제 예약 정보 아님)」
//
// 규칙:
//   - 지역 key를 풀어 한 배열로 둔다(PoC dayPlan의 beds와 같은 순서). 지역 key는 region으로 남긴다
//   - 옮기는 필드: id · lat · lng · ko · en · qKo · qEn(지도 · 예약 검색어, PoC stayQuery) · areaKo · areaEn · typeKo · typeEn
//   - 가격대(band)는 옮기지 않는다. PoC가 임의로 만든 숫자라 화면에 가격을 보이지 않는다. vz(지정구역 문구)도 쓰지 않아 뺀다
//   - 값이 없으면 필드를 비운다(지어내지 않는다)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const [, , plannerPath] = process.argv;
if (!plannerPath) {
  console.error("사용법: node scripts/build-stays.mjs <Tour Planner.dc.html>");
  process.exit(1);
}

const lines = readFileSync(plannerPath, "utf8").split("\n");
const start = lines.findIndex((l) => /^const STAYS\s*=/.test(l));
if (start < 0) throw new Error("Tour Planner.dc.html에 STAYS가 없습니다");
const end = lines.findIndex((l, i) => i > start && /^};/.test(l));
if (end < 0)
  throw new Error("Tour Planner.dc.html의 STAYS 끝을 찾지 못했습니다");
const STAYS = vm.runInNewContext(
  `${lines.slice(start, end + 1).join("\n")}\n;STAYS`,
);

const FIELDS = [
  "id",
  "lat",
  "lng",
  "ko",
  "en",
  "qKo",
  "qEn",
  "areaKo",
  "areaEn",
  "typeKo",
  "typeEn",
];

const out = [];
const seen = new Set();
for (const [region, list] of Object.entries(STAYS)) {
  for (const s of list ?? []) {
    if (seen.has(s.id)) throw new Error(`숙소 id가 겹칩니다: ${s.id}`);
    seen.add(s.id);
    const row = { region };
    for (const f of FIELDS)
      if (s[f] !== undefined && s[f] !== null && s[f] !== "") row[f] = s[f];
    out.push(row);
  }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "src/features/planner/data/stays.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(out)}\n`);
console.log(
  `stays.json: ${Object.keys(STAYS).length}개 지역 · ${out.length}곳 (band 제외)`,
);
