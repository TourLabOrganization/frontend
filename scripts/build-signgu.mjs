#!/usr/bin/env node
// 플래너 장소(3,118곳)의 시군구 코드(법정동 코드 앞 5자리)를 만든다. 한국관광공사 연관 관광지 · 집중률 API의 입력(areaCd = 앞 2자리, signguCd)이다.
//   src/features/planner/data/signgu.json   { 장소 id: "47130" }   못 구한 곳은 ""
// Route Handler(app/api/tour/*)만 읽는다(src/lib/tour-api.ts). 클라이언트 번들에 넣지 않는다.
//
// 사용법:
//   1) dev 서버를 띄운다: npm run dev   (http://localhost:5173 — 카카오 앱의 JavaScript SDK 도메인에 등록된 주소)
//   2) PLAYWRIGHT_CORE=<playwright-core 폴더> node scripts/build-signgu.mjs
//      playwright-core는 이 리포 의존성에 없다(scripts/check-hangul.mjs와 같은 방법으로 경로를 알려 준다). 브라우저는 설치된 Chrome(channel "chrome")
//      카카오 지도 JavaScript 키는 환경변수 NEXT_PUBLIC_KAKAO_MAP_KEY, 없으면 .env.local에서 읽는다. 키 값은 출력하지 않는다
//   3) npm run format   # JSON을 리포 포맷으로 맞춘다
//
// 규칙 (PoC shared.js getSignguCd와 같다):
//   - PoC는 카카오 REST coord2regioncode(REST 키)를 부른다. 우리는 REST 키가 없어 카카오 지도 JS SDK services 라이브러리의
//     Geocoder.coord2RegionCode를 브라우저에서 부른다(같은 카카오 로컬 API). 좌표마다 간격을 두고 차례로 부른다
//   - 결과 중 법정동(region_type "B") 코드, 없으면 첫 결과의 앞 5자리. 옛 강원(42) · 전북(45) 코드는 특별자치도 코드(51 · 52)로 바꾼다
//   - 못 구하면 PoC SIGNGU_FALLBACK(지역명 부분일치, 긴 이름부터). 지역명은 장소의 도시(locKo)와 좌표 기준 원문(place-details.json src.ko)
//   - 그래도 없으면 빈 값. PoC의 마지막 대체(가장 가까운 시도의 대표 코드)는 옮기지 않았다(다른 시군구 결과를 보이지 않게)
// 브라우저는 이 스크립트가 띄운 것만 닫는다

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const OUT = resolve(ROOT, "src/features/planner/data/signgu.json");
/** 좌표 사이 간격(ms) */
const GAP_MS = 60;
/** 한 번에 브라우저로 넘기는 좌표 수(진행 상황을 이 단위로 찍는다) */
const BATCH = 100;

// PoC shared.js SIGNGU_FALLBACK 그대로(값을 고치지 않는다)
const SIGNGU_FALLBACK = {
  서울: "11110",
  종로: "11110",
  부산: "26350",
  해운대: "26350",
  "부산 중구": "26110",
  영도: "26200",
  기장: "26710",
  인천: "28125",
  강화: "28710",
  대구: "27110",
  광주: "12210",
  대전: "30110",
  울산: "31110",
  세종: "36110",
  수원: "41115",
  가평: "41820",
  양평: "41830",
  남양주: "41360",
  강릉: "51150",
  속초: "51210",
  춘천: "51110",
  평창: "51760",
  정선: "51770",
  영월: "51750",
  양양: "51830",
  전주: "52111",
  군산: "52130",
  여수: "12130",
  순천: "12150",
  목포: "12110",
  경주: "47130",
  안동: "47170",
  포항: "47111",
  울릉: "47940",
  통영: "48220",
  거제: "48310",
  남해: "48840",
  제주: "50110",
  서귀포: "50130",
  공주: "44150",
  부여: "44760",
  단양: "43800",
};

function loadPlaywright() {
  for (const spec of [
    process.env.PLAYWRIGHT_CORE,
    "playwright-core",
    "playwright",
  ]) {
    if (!spec) continue;
    try {
      return require(spec);
    } catch {
      // 다음 후보
    }
  }
  console.error(
    "playwright-core를 찾지 못했습니다. PLAYWRIGHT_CORE=<폴더>로 알려 주세요(파일 머리 주석 참고).",
  );
  process.exit(2);
}

/** 카카오 지도 JS 키. 환경변수 → .env.local 순서. 값은 어디에도 찍지 않는다 */
function kakaoKey() {
  const fromEnv = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  if (fromEnv) return fromEnv.trim();
  try {
    const text = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    const m = /^NEXT_PUBLIC_KAKAO_MAP_KEY=(.*)$/m.exec(text);
    return (m?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

/** 카카오 법정동 코드 → 시군구 5자리(옛 강원 42 · 전북 45 → 51 · 52) */
function toSignguCd(code) {
  let c = String(code ?? "").slice(0, 5);
  if (c.length !== 5) return "";
  if (/^42/.test(c)) c = "51" + c.slice(2);
  if (/^45/.test(c)) c = "52" + c.slice(2);
  return c;
}

/** PoC SIGNGU_FALLBACK: 지역명 부분일치(긴 이름부터) */
function fallbackSignguCd(loc) {
  if (!loc) return "";
  const k = Object.keys(SIGNGU_FALLBACK)
    .sort((a, b) => b.length - a.length)
    .find((n) => loc.includes(n));
  return k ? SIGNGU_FALLBACK[k] : "";
}

/** 페이지에 카카오 지도 SDK(services)가 없으면 붙인다. SDK 주소에 키가 들어가므로 페이지 안에서 붙이고, 실패해도 주소가 없는 문구만 돌려받는다 */
async function ensureSdk(page, key) {
  const ready = await page
    .evaluate(() => Boolean(window.kakao?.maps?.services))
    .catch(() => false);
  if (ready) return;
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const loaded = await page.evaluate(
    (k) =>
      new Promise((done) => {
        const s = document.createElement("script");
        s.src =
          "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" +
          encodeURIComponent(k) +
          "&autoload=false&libraries=services";
        s.onload = () => window.kakao.maps.load(() => done(true));
        s.onerror = () => done(false);
        document.head.appendChild(s);
      }),
    key,
  );
  if (!loaded) throw new Error("카카오 지도 SDK를 불러오지 못했습니다");
}

/** 좌표 묶음 → [id, 법정동 코드, 상태]. 좌표마다 간격을 두고 차례로 부른다 */
function geocode(page, coords) {
  return page.evaluate(
    async ({ coords, gap }) => {
      const { services } = window.kakao.maps;
      const geocoder = new services.Geocoder();
      const ask = (lat, lng) =>
        new Promise((done) => {
          const timer = setTimeout(() => done({ status: "TIMEOUT" }), 10000);
          geocoder.coord2RegionCode(lng, lat, (result, status) => {
            clearTimeout(timer);
            if (status !== services.Status.OK) return done({ status });
            const b = result.find((d) => d.region_type === "B") ?? result[0];
            done({ status, code: b?.code ?? "" });
          });
        });
      const out = [];
      for (const [id, lat, lng] of coords) {
        let r = await ask(lat, lng);
        // 일시 오류면 한 번 더(결과 없음 ZERO_RESULT는 다시 묻지 않는다)
        if (r.status === services.Status.ERROR || r.status === "TIMEOUT") {
          await new Promise((w) => setTimeout(w, 1000));
          r = await ask(lat, lng);
        }
        out.push([id, r.code ?? "", String(r.status)]);
        await new Promise((w) => setTimeout(w, gap));
      }
      return out;
    },
    { coords, gap: GAP_MS },
  );
}

async function main() {
  const key = kakaoKey();
  if (!key) {
    console.error(
      "카카오 지도 JavaScript 키가 없습니다(NEXT_PUBLIC_KAKAO_MAP_KEY 또는 .env.local).",
    );
    process.exit(1);
  }
  const places = JSON.parse(
    readFileSync(
      resolve(ROOT, "src/features/planner/data/places.json"),
      "utf8",
    ),
  );
  const details = JSON.parse(
    readFileSync(
      resolve(ROOT, "src/features/planner/data/place-details.json"),
      "utf8",
    ),
  );

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const found = new Map();
  try {
    const ctx = await browser.newContext();
    // 첫 방문 로고 화면을 건너뛴다(features/home/splash-cookie.ts)
    await ctx.addCookies([{ name: "tn_splash", value: "1", url: BASE }]);
    const page = await ctx.newPage();
    for (let i = 0; i < places.length; i += BATCH) {
      const coords = places
        .slice(i, i + BATCH)
        .map((p) => [p.id, p.lat, p.lng]);
      // 개발 서버가 페이지를 다시 불러오면(HMR) 문맥이 사라진다. SDK를 다시 붙이고 그 묶음을 다시 부른다
      let rows = null;
      for (let attempt = 0; attempt < 5 && !rows; attempt++) {
        try {
          await ensureSdk(page, key);
          rows = await geocode(page, coords);
        } catch (e) {
          if (attempt === 4) throw e;
        }
      }
      for (const [id, code] of rows) found.set(id, code);
      console.log(
        `${Math.min(i + BATCH, places.length)} / ${places.length} 좌표`,
      );
    }
  } catch (e) {
    // 오류 문구에 키가 섞이지 않게 한 번 더 지운다
    console.error(
      String(e?.message ?? e)
        .split(key)
        .join("***"),
    );
    await browser.close();
    process.exit(1);
  }
  await browser.close();

  const out = {};
  const counts = { kakao: 0, fallback: 0, empty: 0 };
  const emptyIds = [];
  for (const p of places) {
    let code = toSignguCd(found.get(p.id));
    if (code) counts.kakao++;
    else {
      const loc = [p.locKo, details[p.id]?.src?.ko].filter(Boolean).join(" ");
      code = fallbackSignguCd(loc);
      if (code) counts.fallback++;
      else {
        counts.empty++;
        emptyIds.push(p.id);
      }
    }
    out[p.id] = code;
  }
  writeFileSync(OUT, JSON.stringify(out) + "\n");
  console.log(
    `시군구 코드: 카카오 ${counts.kakao} · 지역명 대체 ${counts.fallback} · 빈 값 ${counts.empty} (전체 ${places.length})`,
  );
  if (emptyIds.length > 0) console.log(`빈 값: ${emptyIds.join(", ")}`);
}

await main();
