#!/usr/bin/env node
// 투어 플래너 광역 체인(코스 탭 출발지 · 귀가지 · 지하철 호선 → 역 · 환승 관문)의 데이터를 만든다.
//   src/features/planner/data/wide.json
//     metroStations   수도권 전철역 (PoC METRO_STATIONS, 262역) { ko, en, lines, lat, lng }
//     busanStations   부산 도시철도역 (PoC BUSAN_STATIONS, 46역) { ko, en, lines, lat, lng }
//     metroLineOrder  호선 고르기 순서 (PoC metroLineOptions 안의 order)
//     metroLineColor  수도권 호선 색 (PoC METRO_LINE_COLOR)
//     metroLineName   이름 있는 노선의 외국어 표기 (PoC METRO_LINE_NAME)
//     busanLineColor  부산 호선 색 (PoC BUSAN_LINE_COLOR)
//     busanLineLabel  부산 호선 이름 ko · en (PoC BUSAN_LINE_LABEL)
//     originAlt       같은 권역의 수단별 대체 관문 (PoC ORIGIN_ALT)
//
// 사용법:
//   node scripts/build-wide.mjs <Tour Planner.dc.html>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천: Tour-Navigator-App main f44eb97 (2026-09-27) Tour Planner.dc.html. 원천 파일은 이 리포에 넣지 않는다.
// 규칙: 값은 PoC 상수를 그대로 평가해 옮긴다(고치지 않는다). 사용자가 역 이름 검색으로 더한 역(localStorage tp_metro_user_v1)은
// 카카오 REST 키가 필요한 기능이라 옮기지 않는다.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const [plannerPath] = process.argv.slice(2);
if (!plannerPath) {
  console.error("사용법: node scripts/build-wide.mjs <Tour Planner.dc.html>");
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/features/planner/data/wide.json");
const lines = readFileSync(plannerPath, "utf8").split("\n");

/** 맨 앞 줄의 `const NAME=` 블록을 평가한다. 한 줄 상수면 그 줄, 여러 줄이면 `};` · `];`까지 */
function evalConst(name) {
  const start = lines.findIndex((l) =>
    new RegExp(`^const ${name}\\s*=`).test(l),
  );
  if (start < 0) throw new Error(`Tour Planner.dc.html에 ${name}이 없습니다`);
  const first = lines[start];
  let end = start;
  if (!/[}\]];\s*$/.test(first)) {
    end = lines.findIndex((l, i) => i > start && /^[}\]];/.test(l));
    if (end < 0)
      throw new Error(`Tour Planner.dc.html의 ${name} 끝을 찾지 못했습니다`);
  }
  return vm.runInNewContext(
    `${lines.slice(start, end + 1).join("\n")}\n;${name}`,
  );
}

/** metroLineOptions 안의 `const order=[…]` */
function evalLineOrder() {
  const at = lines.findIndex((l) => /^\s+metroLineOptions:/.test(l));
  if (at < 0)
    throw new Error("Tour Planner.dc.html에 metroLineOptions가 없습니다");
  for (let i = at; i < at + 10; i++) {
    const m = lines[i].match(/const order=(\[[^\]]*\]);/);
    if (m) return vm.runInNewContext(m[1]);
  }
  throw new Error("metroLineOptions의 order를 찾지 못했습니다");
}

const station = (s) => ({
  ko: s.ko,
  en: s.en,
  lines: s.lines,
  lat: s.lat,
  lng: s.lng,
});

const out = {
  metroStations: evalConst("METRO_STATIONS").map(station),
  busanStations: evalConst("BUSAN_STATIONS").map(station),
  metroLineOrder: evalLineOrder(),
  metroLineColor: evalConst("METRO_LINE_COLOR"),
  metroLineName: evalConst("METRO_LINE_NAME"),
  busanLineColor: evalConst("BUSAN_LINE_COLOR"),
  busanLineLabel: evalConst("BUSAN_LINE_LABEL"),
  originAlt: evalConst("ORIGIN_ALT"),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `wide.json: 수도권 ${out.metroStations.length}역 · 부산 ${out.busanStations.length}역 · 대체 관문 ${Object.keys(out.originAlt).length}곳`,
);
