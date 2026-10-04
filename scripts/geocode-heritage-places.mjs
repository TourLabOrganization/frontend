#!/usr/bin/env node
// 국가유산 소재지 표(scripts/data/treasure-sites.csv)를 카카오 로컬 API로 좌표에 맞춰 수기 장소 표(add-manual-places.mjs 입력)로 만든다.
//
// 사용법 (키는 환경변수로만 받는다. 파일 · 저장소에 쓰지 않는다):
//   KAKAO_REST_KEY=… node scripts/geocode-heritage-places.mjs [scripts/data/treasure-sites.csv] [--out scripts/data/treasure-places.csv] [--regions]
//   node scripts/add-manual-places.mjs scripts/data/treasure-places.csv
//   npm run format
//
// 입력 열: region(앱 도시) · site(장소 · 소장처) · ko(앱 이름) · kind · cat · count(보물 수) · items(보물 예) · address(국가유산 목록 주소)
// 한 곳마다:
//   ① 장소 검색(keyword) 「ko」 → 「site」: 결과 중 주소가 그 도시이고 이름이 맞는(같은 이름 · 한쪽이 다른 쪽을 품음) 첫 곳
//   ② 그래도 없으면 주소 검색(address): 국가유산 목록 주소에서 괄호 · 「/」 뒤 · 쉼표 뒤를 뗀 주소
//   ③ 좌표의 법정동 코드(coord2regioncode, B)로 시군구 코드 · 이름을 붙이고, 시군구 이름이 그 도시가 아니면 버린다
// 못 찾은 곳은 --out 옆의 *-missed.csv에 적는다(사람이 확인).
// --regions: 결과 도시 중 앱에 도심 좌표가 없고 장소도 없는 도시는 regions.json에 도심(시청 · 군청) 좌표와 관문(버스터미널)을 넣는다.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./add-manual-places.mjs";
import { romanize } from "../src/lib/romanize.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KAKAO = "https://dapi.kakao.com/v2/local";
export const COORD_NOTE = "카카오 로컬 좌표(주소 · 장소 검색, 2026-10-04)";

const norm = (s) => String(s ?? "").replace(/[\s·()（）]/g, "");

/** 국가유산 목록 주소 → 검색할 주소(괄호 · 「/」 뒤 · 쉼표 뒤 · 「번지」 정리) */
export function cleanAddress(addr) {
  return String(addr ?? "")
    .split("/")[0]
    .replace(/\(.*?\)/g, " ")
    .split(",")[0]
    .replace(/번지/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 이름이 맞는가: 같은 이름이거나 한쪽이 다른 쪽을 품는다(짧은 쪽 2글자 이상) */
export function nameMatches(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  const short = x.length <= y.length ? x : y;
  return short.length >= 2 && (x.includes(y) || y.includes(x));
}

/** 시군구 이름이 앱 도시인가(「청도군」 · 「청주시 상당구」 · 서울 · 광역시는 시도 이름) */
export function inCity(region1, region2, city) {
  const r1 = String(region1 ?? "");
  const r2 = String(region2 ?? "");
  if (
    /^(서울|부산|대구|인천|광주|대전|울산)/.test(r1) &&
    !r1.startsWith("전남")
  )
    return r1.startsWith(city) || (city === "대구" && r2.startsWith("군위"));
  if (r1.startsWith("제주")) return city === "제주";
  if (r1.startsWith("세종")) return city === "세종";
  if (r1.startsWith("전남") && /구$/.test(r2.split(" ")[0]))
    return city === "광주";
  return r2.startsWith(city);
}

async function kakao(path, params, key, fetchImpl) {
  const url = `${KAKAO}/${path}?${new URLSearchParams(params)}`;
  const res = await fetchImpl(url, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) throw new Error(`kakao ${path} ${res.status}`);
  return (await res.json()).documents ?? [];
}

/** 한 곳의 좌표 · 시군구. 못 찾으면 null */
export async function geocodeSite(site, key, fetchImpl = fetch) {
  const city = site.region;
  // 같은 이름 → 이름을 품는 곳 순. 주차장 · 매표소 · 정류장 · 식당 같은 부속 시설은 뺀다
  const FACILITY =
    /(주차장|매표소|정류장|정류소|입구|식당|카페|화장실|민박|펜션|휴게소|편의점|버스|택시)/;
  const pick = (docs) => {
    const ok = docs.filter((d) => {
      const [r1, r2] = String(d.address_name ?? "").split(" ");
      return (
        inCity(r1, `${r2} `, city) &&
        !FACILITY.test(String(d.place_name ?? "")) &&
        nameMatches(d.place_name, site.site)
      );
    });
    return (
      ok.find((d) => norm(d.place_name).endsWith(norm(site.site))) ?? ok[0]
    );
  };
  let hit = null;
  let how = "";
  for (const q of [site.ko, site.site]) {
    const docs = await kakao(
      "search/keyword.json",
      { query: q, size: "15" },
      key,
      fetchImpl,
    );
    hit = pick(docs);
    if (hit) {
      how = "장소";
      break;
    }
  }
  if (!hit) {
    const query = cleanAddress(site.address);
    if (query) {
      const docs = await kakao(
        "search/address.json",
        { query, size: "1" },
        key,
        fetchImpl,
      );
      if (docs[0]) {
        hit = docs[0];
        how = "주소";
      }
    }
  }
  if (!hit) return null;
  const lat = Number(hit.y);
  const lng = Number(hit.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const regions = await kakao(
    "geo/coord2regioncode.json",
    { x: String(lng), y: String(lat) },
    key,
    fetchImpl,
  );
  const b = regions.find((r) => r.region_type === "B") ?? regions[0];
  if (!b || !inCity(b.region_1depth_name, `${b.region_2depth_name} `, city))
    return null;
  return {
    lat: Math.round(lat * 1e5) / 1e5,
    lng: Math.round(lng * 1e5) / 1e5,
    signgu: String(b.code ?? "").slice(0, 5),
    muni: String(b.region_2depth_name || b.region_1depth_name),
    how,
    place: hit.place_name ?? hit.address_name ?? "",
  };
}

/** 소재지 행 → 수기 장소 표 행 */
export function manualRow(site, geo) {
  const n = Number(site.count) || 1;
  return {
    region: site.region,
    stopName: site.site,
    tours: "1",
    ko: site.ko,
    en: romanize(site.ko),
    cat: site.cat || "herit",
    lat: String(geo.lat),
    lng: String(geo.lng),
    signgu: geo.signgu,
    muni: geo.muni,
    desc: `보물 ${n}건이 있는 곳: ${site.items}.`,
    descEn: `Holds ${n} Treasure${n > 1 ? "s" : ""} of Korea (National Heritage registry).`,
    nearOk: "",
    source: `국가유산 보물 소재지(국가유산 기본정보, 보물 ${n}건)`,
    coord: `${COORD_NOTE}, ${geo.how} 「${geo.place}」`,
  };
}

const COLS = [
  "region",
  "stopName",
  "tours",
  "ko",
  "en",
  "cat",
  "lat",
  "lng",
  "signgu",
  "muni",
  "desc",
  "descEn",
  "nearOk",
  "source",
  "coord",
];
const csvCell = (v) =>
  /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
export const toCsv = (rows, cols = COLS) =>
  [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => csvCell(r[c] ?? "")).join(",")),
  ].join("\n") + "\n";

async function regionEntries(cities, key, fetchImpl) {
  const regionsPath = resolve(ROOT, "src/features/planner/data/regions.json");
  const regions = JSON.parse(readFileSync(regionsPath, "utf8"));
  const places = [
    ...JSON.parse(
      readFileSync(
        resolve(ROOT, "src/features/planner/data/places.json"),
        "utf8",
      ),
    ),
    ...JSON.parse(
      readFileSync(
        resolve(ROOT, "src/features/planner/data/added-places.json"),
        "utf8",
      ),
    ),
  ];
  const hasPlaces = new Set(places.map((p) => p.locKo));
  const done = [];
  for (const city of cities) {
    if (hasPlaces.has(city) && regions.cities[city]?.lat) continue;
    if (regions.cities[city]?.lat && regions.hubs[city]) continue;
    const hall =
      (
        await kakao(
          "search/keyword.json",
          { query: `${city}시청`, size: "3" },
          key,
          fetchImpl,
        )
      )[0] ??
      (
        await kakao(
          "search/keyword.json",
          { query: `${city}군청`, size: "3" },
          key,
          fetchImpl,
        )
      )[0];
    const bus = (
      await kakao(
        "search/keyword.json",
        { query: `${city} 버스터미널`, size: "5" },
        key,
        fetchImpl,
      )
    ).find((d) => /터미널/.test(d.place_name));
    if (!hall || !bus) continue;
    const r = (v) => Math.round(Number(v) * 1e4) / 1e4;
    regions.cities[city] = {
      ...regions.cities[city],
      en: regions.cities[city]?.en || romanize(city),
      lat: r(hall.y),
      lng: r(hall.x),
    };
    if (!hasPlaces.has(city) && !regions.hubs[city])
      regions.hubs[city] = {
        lat: r(bus.y),
        lng: r(bus.x),
        busLat: r(bus.y),
        busLng: r(bus.x),
        ko: bus.place_name,
        en: romanize(bus.place_name),
        busKo: bus.place_name,
        busEn: romanize(bus.place_name),
        modes: ["bus"],
      };
    done.push(city);
  }
  writeFileSync(regionsPath, JSON.stringify(regions, null, 2) + "\n");
  return done;
}

async function main() {
  const args = process.argv.slice(2);
  const key = process.env.KAKAO_REST_KEY;
  if (!key) {
    console.error("KAKAO_REST_KEY 환경변수가 없습니다");
    process.exit(1);
  }
  const input = resolve(
    ROOT,
    args.find(
      (a) =>
        !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--out"),
    ) ?? "scripts/data/treasure-sites.csv",
  );
  const outArg = args.indexOf("--out");
  const out = resolve(
    ROOT,
    outArg >= 0 ? args[outArg + 1] : "scripts/data/treasure-places.csv",
  );
  const sites = parseCsv(readFileSync(input, "utf8"));
  const rows = [];
  const missed = [];
  for (const [i, site] of sites.entries()) {
    let geo = null;
    try {
      geo = await geocodeSite(site, key);
    } catch (e) {
      console.error(`${site.ko}: ${e.message}`);
    }
    if (geo) rows.push(manualRow(site, geo));
    else missed.push(site);
    if ((i + 1) % 50 === 0) console.log(`${i + 1}/${sites.length}`);
  }
  writeFileSync(out, toCsv(rows));
  const missedPath = out.replace(/\.csv$/, "-missed.csv");
  writeFileSync(
    missedPath,
    toCsv(missed, [
      "region",
      "site",
      "ko",
      "kind",
      "cat",
      "count",
      "items",
      "address",
    ]),
  );
  console.log(`좌표 ${rows.length} · 못 찾음 ${missed.length} → ${out}`);
  if (args.includes("--regions")) {
    const done = await regionEntries(
      [...new Set(rows.map((r) => r.region))],
      key,
      fetch,
    );
    console.log(`regions.json 도심 · 관문: ${done.join(", ") || "없음"}`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
)
  main();
