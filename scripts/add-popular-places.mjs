#!/usr/bin/env node
// 인기 관광지(한국관광공사 집중률)에서 앱 장소 목록에 없는 곳을 투어 플래너 장소 데이터에 누적한다.
//   src/features/planner/data/added-places.json   추가 장소(가벼운 필드, places.json 뒤에 이어 붙는다. data.ts)
//   src/features/planner/data/signgu.json         추가 장소의 시군구 코드
//   src/features/planner/data/regions.json        도시별 장소 수(placeCounts)
//   src/features/planner/data/place-details.json  추가 장소의 설명 · 사진 · 중 · 일 이름 · 좌표 근거(장소 시트)
//
// 사용법:
//   1) dev 서버를 띄운다: npm run dev   (.env.local의 DATA_GO_KR_KEY를 서버가 읽는다. 키는 이 스크립트가 다루지 않는다)
//   2) node scripts/add-popular-places.mjs [--source popular|odii] [--scope all|home] [--regions 서울,부산] [--top 10] [--base http://localhost:5173] [--dry]
//      --source odii: 인기 관광지 대신 관광지 오디오 가이드(오디) 해설이 있는 관광지를 모은다(lib/tour-collect.ts collectOdii)
//      --source citytour: 시티투어 경유지 중 앱에 없는 관광지를 모은다(collectCityTour). 뒤에 node scripts/build-citytour.mjs 를 다시 돌리면 노선의 placeIds가 새 장소까지 잇는다
//   3) npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 규칙(lib/tour-collect.ts, Data-Analytics tools/add_popular_places.py와 같다):
//   - scope all(기본): 장소가 있는 시군구 전부 · home: 홈 칩 8개 도시. 지역마다 집중률 상위 top곳이 후보
//   - 같은 지역 장소와 이름(점수 2 이상) · 위치(관광정보 좌표 250m 안)로 맞춰 보고 남는 곳만 추가 장소 pop<contentid>로 만든다
//   - 이미 있는 id는 다시 넣지 않는다(값도 바꾸지 않는다). --dry 는 파일을 바꾸지 않고 요약만 찍는다
// 브라우저가 기억하는 신규 관광지(kto:, extra-places.ts)와 달리 여기 들어간 곳은 앱 장소라 모든 사용자에게 같이 보인다

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATA = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/features/planner/data",
);

/** 가벼운 필드(places.json 항목과 같은 순서) */
const LIGHT_KEYS = [
  "id",
  "n",
  "ko",
  "en",
  "locKo",
  "cat",
  "lat",
  "lng",
  "min",
  "hrs",
  "open",
  "close",
  "yt",
  "off",
  "k100",
  "un",
  "bf",
  "auto",
  "macro",
  "pickCity",
];

/**
 * 모은 추가 장소를 데이터 파일 내용에 합친다(순수 함수, 테스트용). 이미 있는 id는 건너뛴다.
 * @param {Record<string, unknown>[]} collected
 * @param {{ added: Record<string, unknown>[], signgu: Record<string, string>, regions: { placeCounts: Record<string, number> } & Record<string, unknown>, details: Record<string, Record<string, unknown>> }} files
 * @returns {{ added: Record<string, unknown>[], signgu: Record<string, string>, regions: { placeCounts: Record<string, number> } & Record<string, unknown>, details: Record<string, Record<string, unknown>>, newIds: string[] }}
 */
export function mergeAdded(collected, { added, signgu, regions, details }) {
  const known = new Set([...added.map((p) => p.id), ...Object.keys(signgu)]);
  const outAdded = [...added];
  const outSigngu = { ...signgu };
  const outRegions = {
    ...regions,
    placeCounts: { ...regions.placeCounts },
  };
  const outDetails = { ...details };
  const newIds = [];
  for (const p of collected) {
    if (!p || typeof p.id !== "string" || known.has(p.id)) continue;
    known.add(p.id);
    const light = {};
    for (const k of LIGHT_KEYS) light[k] = p[k];
    outAdded.push(light);
    outSigngu[p.id] = /^\d{5}$/.test(p.signgu ?? "") ? p.signgu : "";
    if (p.pickCity)
      outRegions.placeCounts[p.pickCity] =
        (outRegions.placeCounts[p.pickCity] ?? 0) + 1;
    const detail = { desc: { ko: p.desc ?? "" }, src: { ko: p.source ?? "" } };
    if (p.descEn) detail.desc.en = p.descEn;
    if (p.photo) {
      detail.img = p.photo;
      detail.imgCredit = "한국관광공사";
    }
    if (p.zh) detail.zh = p.zh;
    if (p.ja) detail.ja = p.ja;
    outDetails[p.id] = detail;
    newIds.push(p.id);
  }
  return {
    added: outAdded,
    signgu: outSigngu,
    regions: outRegions,
    details: outDetails,
    newIds,
  };
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const base = arg("base", process.env.BASE_URL ?? "http://localhost:5173");
  const source = arg("source", "popular");
  const scope = arg("scope", "all");
  const regions = arg("regions", "");
  const top = arg("top", "10");
  const dry = process.argv.includes("--dry");
  const url = new URL("/api/tour/popular/collect", base);
  url.searchParams.set("source", source);
  url.searchParams.set("scope", scope);
  url.searchParams.set("top", top);
  if (regions) url.searchParams.set("regions", regions);
  console.log(`부른다: ${url.pathname}${url.search}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(30 * 60 * 1000) });
  if (!res.ok)
    throw new Error(
      `collect ${res.status}: dev 서버가 떠 있고(.env.local DATA_GO_KR_KEY) 배포가 아닌지 확인하세요`,
    );
  const body = await res.json();
  const read = (f) => JSON.parse(readFileSync(resolve(DATA, f), "utf8"));
  const files = {
    added: read("added-places.json"),
    signgu: read("signgu.json"),
    regions: read("regions.json"),
    details: read("place-details.json"),
  };
  const verdicts = {};
  for (const c of body.candidates ?? [])
    verdicts[c.verdict] = (verdicts[c.verdict] ?? 0) + 1;
  console.log(
    `지역 ${body.targets?.length ?? 0}곳 · 후보 ${body.candidates?.length ?? 0}곳 ${JSON.stringify(verdicts)}`,
  );
  const merged = mergeAdded(body.places ?? [], files);
  for (const id of merged.newIds) {
    const p = merged.added.find((x) => x.id === id);
    console.log(`  + ${id} ${p.ko} (${p.locKo} · ${p.cat})`);
  }
  console.log(
    `추가 장소 ${files.added.length} → ${merged.added.length}곳 (이번 ${merged.newIds.length}곳)`,
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
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
