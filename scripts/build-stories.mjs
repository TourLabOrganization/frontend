#!/usr/bin/env node
// 장소 시트 오디오 가이드 칸의 한국어 스토리텔링 대체 글(31곳)을 PoC에서 옮긴다.
//   src/features/planner/data/stories.json   { 한국어 장소 이름: { t: 제목, s: 본문 } }
// Route Handler(app/api/tour/audio)만 읽는다(src/lib/tour-audio.ts). 클라이언트 번들에 넣지 않는다.
//
// 사용법:
//   node scripts/build-stories.mjs <Tour Planner.dc.html>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천 (Tour-Navigator-App, 원천 파일은 이 리포에 넣지 않는다):
//   - Tour Planner.dc.html   STORY_DB — 한국관광공사 관광 스토리텔링(PoC 장소 상세 d_story* 칸, 출처 「관광 스토리텔링 · 한국관광공사」)
// 규칙: 값을 고치지 않고 그대로 옮긴다. 키는 PoC와 같이 장소의 한국어 이름(places.json ko)이다

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [plannerPath] = process.argv.slice(2);
if (!plannerPath) {
  console.error(
    "사용법: node scripts/build-stories.mjs <Tour Planner.dc.html>",
  );
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/features/planner/data/stories.json");

const PREFIX = "const STORY_DB=";
const line = readFileSync(plannerPath, "utf8")
  .split("\n")
  .find((l) => l.startsWith(PREFIX));
if (!line) {
  console.error("STORY_DB를 찾지 못했습니다");
  process.exit(1);
}
const db = JSON.parse(line.slice(PREFIX.length).replace(/;\s*$/, ""));

const stories = {};
for (const [name, v] of Object.entries(db)) {
  if (typeof v?.t !== "string" || typeof v?.s !== "string") continue;
  stories[name] = { t: v.t, s: v.s };
}

const places = JSON.parse(
  readFileSync(resolve(ROOT, "src/features/planner/data/places.json"), "utf8"),
);
const names = new Set(places.map((p) => p.ko));
const missing = Object.keys(stories).filter((n) => !names.has(n));

writeFileSync(OUT, JSON.stringify(stories) + "\n");
console.log(
  `스토리텔링 ${Object.keys(stories).length}곳 (플래너 장소와 이름이 맞지 않는 곳 ${missing.length}${missing.length ? `: ${missing.join(", ")}` : ""})`,
);
