#!/usr/bin/env node
// 테마 화면(지도 · 영화 탭)에 쓰는 장소 부가 정보와 장면 목록을 만든다.
//   src/features/theme/data/extras.json  { [slug]: { [placeId]: { img, imgCredit, scene, sceneTitle, work, desc: {ko, en}, ytAt, src: {ko, en}, url } } }
//   src/features/theme/data/scenes.json  { [slug]: [{ id, label, title, query }] }  (RESCENE는 [{ id, date, views }])
//   src/features/theme/data/cities.json  { [slug]: [{ ko, en, lat, lng }] }  테마 화면 도시 칩 순서대로(전국 보기는 뺀다)
// places.json(장소 · 체류 · 운영시간)은 건드리지 않는다. 그쪽은 scripts/build-places.mjs가 만든다.
//
// 사용법:
//   node scripts/build-theme-extras.mjs <Tour-Navigator-App 폴더>
//   npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 원천 (Tour-Navigator-App, 원천 파일은 이 리포에 넣지 않는다):
//   - Kings Warden Route.dc.html        → kings-warden
//   - KPop Demon Hunters Route.dc.html  → kpop-demon-hunters
//   - Jeju K-Drama Route.dc.html        → jeju-k-drama
//   - Busan Cinema Route.dc.html        → busan-film-trip
//   - RESCENE Route.dc.html             → rescene-route
//   각 파일의 `const DATA = {…}`(장소)와 `const VMETA = {…}`(장면)를 node:vm으로 평가한다.
//
// 필드 대응 (PoC → extras.json):
//   img → img(원본 파일 주소는 폭 960 주소로, 아래 sizedImage), imgCredit → imgCredit, yt → scene, vt → sceneTitle, chan → work,
//   bKo · bEn → desc.ko · desc.en, ytAt → ytAt(초), srcKo · srcEn → src.ko · src.en(좌표 기준), url → url(카카오 장소 페이지). 빈 값은 넣지 않는다.
// 장면 (VMETA → scenes.json):
//   영화 · 드라마 테마: { views: '장면 01', date: '강을 건너', q: '검색어' } → { id, label: views, title: date, query: q }
//   RESCENE: 키가 유튜브 영상 id라 { id, date, views }를 옮긴다. views는 PoC에 적힌 조회수('조회수 5,951,893회')를 숫자로.
//     PoC가 적어 둔 때의 숫자다(실시간 조회수는 YouTube Data API 키가 필요하다). '조회수 —'처럼 숫자가 없으면 넣지 않는다.
// 도시 (DATA의 도시 → cities.json):
//   화면의 도시 칩 목록(`cities:['nation','geoje','gyeongju'].map(`)의 순서대로 { ko, en, lat, lng: center }.
//   'nation'(전국 보기)은 도시가 아니라 뺀다. 지도 탭 목록의 거리(도시 center에서 장소까지 직선거리)와 도시 칩에 쓴다.
//   PoC I18N에 장면 제목 영어가 없어(zh · ja만 있다) 제목은 한국어만 둔다.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const [pocDir] = process.argv.slice(2);
if (!pocDir) {
  console.error(
    "사용법: node scripts/build-theme-extras.mjs <Tour-Navigator-App 폴더>",
  );
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "src/features/theme/data");
const places = JSON.parse(
  readFileSync(resolve(ROOT, "src/features/course/data/places.json"), "utf8"),
);

const THEME_FILES = [
  ["kings-warden", "Kings Warden Route.dc.html"],
  ["kpop-demon-hunters", "KPop Demon Hunters Route.dc.html"],
  ["jeju-k-drama", "Jeju K-Drama Route.dc.html"],
  ["busan-film-trip", "Busan Cinema Route.dc.html"],
  ["rescene-route", "RESCENE Route.dc.html"],
];

/** `const NAME = {` 로 시작해 줄 머리의 `};` 로 끝나는 블록을 평가한다 */
function evalConst(lines, name, file) {
  const start = lines.findIndex((l) =>
    new RegExp(`^const ${name}\\s*=\\s*{`).test(l),
  );
  if (start < 0) throw new Error(`${file}에 ${name}이 없습니다`);
  const end = lines.findIndex((l, i) => i >= start && /^};/.test(l));
  if (end < 0) throw new Error(`${file}의 ${name} 끝을 찾지 못했습니다`);
  const src = lines.slice(start, end + 1).join("\n");
  return vm.runInNewContext(`${src}\n;${name}`);
}

const present = (v) => v !== undefined && v !== null && v !== "";

// ── 사진 주소 ───────────────────────────────────────────────────────
// PoC img는 세 가지 꼴이다: Special:FilePath 리다이렉트(commons.wikimedia.org …?width=960),
// 원본 파일(upload.wikimedia.org/wikipedia/commons/a/ab/파일), 이미 줄인 섬네일(…/thumb/…/960px-파일).
// 원본 파일은 수 MB라 목록 · 시트에 그대로 쓰기 무겁다. 그래서 원본 파일 주소만 Special:FilePath?width=960 꼴로 바꾼다.
// FilePath는 원본보다 큰 폭을 요청해도 원본 크기로 맞춰 주고, 목록 섬네일은 화면에서 width만 줄여 쓴다(place-meta.ts).
const THUMB_WIDTH = 960;

function sizedImage(url) {
  const u = new URL(url);
  if (
    u.hostname === "upload.wikimedia.org" &&
    !u.pathname.includes("/thumb/")
  ) {
    const m = u.pathname.match(
      /^\/wikipedia\/commons\/[0-9a-f]\/[0-9a-f]{2}\/(.+)$/,
    );
    if (m)
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${m[1]}?width=${THUMB_WIDTH}`;
  }
  return url;
}

const extras = {};
const scenes = {};
const cities = {};

/** '조회수 5,951,893회' → 5951893. 숫자가 없으면 undefined */
function parseViews(text) {
  const digits = String(text ?? "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : undefined;
}

/** 화면의 도시 칩 순서 (`cities:['a','b'].map(`) */
function cityOrder(lines, file) {
  const line = lines.find((l) => /\bcities:\[[^\]]*\]\.map\(/.test(l));
  if (!line)
    throw new Error(`${file}에 도시 칩 목록(cities:[…].map)이 없습니다`);
  const list = line.match(/\bcities:\[([^\]]*)\]/)[1];
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

for (const [slug, file] of THEME_FILES) {
  const lines = readFileSync(resolve(pocDir, file), "utf8").split("\n");
  const DATA = evalConst(lines, "DATA", file);
  const VMETA = evalConst(lines, "VMETA", file);
  const known = new Set(places[slug].map((p) => p.id));

  const byId = {};
  for (const region of Object.values(DATA)) {
    for (const p of region.places ?? []) {
      if (!known.has(p.id)) {
        console.warn(`경고: ${slug} ${p.id}(${p.ko})가 places.json에 없습니다`);
        continue;
      }
      const e = {};
      if (present(p.img)) e.img = sizedImage(p.img);
      if (present(p.imgCredit)) e.imgCredit = p.imgCredit;
      if (present(p.yt)) e.scene = p.yt;
      if (present(p.vt)) e.sceneTitle = p.vt;
      if (present(p.chan)) e.work = p.chan;
      if (present(p.bKo) || present(p.bEn)) {
        e.desc = {};
        if (present(p.bKo)) e.desc.ko = p.bKo;
        if (present(p.bEn)) e.desc.en = p.bEn;
      }
      if (present(p.ytAt)) e.ytAt = Number(p.ytAt);
      if (present(p.srcKo) || present(p.srcEn)) {
        e.src = {};
        if (present(p.srcKo)) e.src.ko = p.srcKo;
        if (present(p.srcEn)) e.src.en = p.srcEn;
      }
      if (present(p.url)) e.url = p.url;
      if (Object.keys(e).length > 0) byId[p.id] = e;
    }
  }
  extras[slug] = byId;

  cities[slug] = cityOrder(lines, file)
    .filter((key) => key !== "nation")
    .map((key) => {
      const c = DATA[key];
      if (!c?.center)
        throw new Error(`${file}의 DATA.${key}에 center가 없습니다`);
      return { ko: c.ko, en: c.en, lat: c.center[0], lng: c.center[1] };
    });

  scenes[slug] =
    slug === "rescene-route"
      ? Object.entries(VMETA).map(([id, m]) => {
          const views = parseViews(m.views);
          return views === undefined
            ? { id, date: m.date }
            : { id, date: m.date, views };
        })
      : Object.entries(VMETA).map(([id, m]) => ({
          id,
          label: m.views,
          title: m.date,
          query: m.q,
        }));

  console.log(
    slug,
    "places",
    Object.keys(byId).length,
    "scenes",
    scenes[slug].length,
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const write = (name, data) => {
  const file = resolve(OUT_DIR, name);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote", file);
};
write("extras.json", extras);
write("scenes.json", scenes);
write("cities.json", cities);
