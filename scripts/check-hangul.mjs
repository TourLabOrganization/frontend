#!/usr/bin/env node
// 외국어 화면(en · zh · ja · es)에 보이는 글자에 한글이 남았는지 브라우저로 훑는 점검 스크립트. CI에는 넣지 않는다(손으로 돌린다).
//
// 사용법:
//   1) dev 서버를 띄운다: npm run dev   (http://localhost:5173)
//   2) playwright-core(또는 playwright)가 필요하다. 이 리포 의존성에는 없어서 경로를 알려 준다:
//        PLAYWRIGHT_CORE=<playwright-core 폴더> node scripts/check-hangul.mjs [언어 …]
//      예) PLAYWRIGHT_CORE="$(dirname "$(npx -y -p playwright-core node -p 'require.resolve("playwright-core/package.json")')")" \
//            node scripts/check-hangul.mjs en zh ja es
//      언어를 빼면 en zh ja es 모두. 브라우저는 설치된 Chrome(channel "chrome")을 쓴다. BASE_URL로 주소를 바꿀 수 있다
//   3) 결과: 언어별로 페이지마다 한글이 든 글자 · 속성(aria-label · title · placeholder · alt · 문서 제목)과 건수,
//      가로 넘침(문서 폭 > 화면 폭)과 콘솔 오류를 출력한다. 한글이 한 건이라도 있으면 종료 코드 1
//
// 훑는 페이지: 홈 · 설문(첫 문항 · B 문항 · F1 · 결과 단일형 · 결과 복합형) · ME · 테마 5개 전 탭 · 플래너 지도(전국 · 서울 · 경주 · 제주) ·
//             코스(담은 장소 있음) · 여행 정보(서울 · 경주) · 장소 시트(플래너 · 테마, 숙박 · 시티투어 경유지 · 연관 관광지 장소 포함). 폭 390px
// 예외(한글이어도 세지 않는다): 언어 메뉴의 「한국어」(자기 언어로 쓴 언어 이름, i18n/locales.ts LOCALE_NAMES)
// 브라우저는 이 스크립트가 띄운 것만 닫는다

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const LOCALES = process.argv.slice(2);
if (LOCALES.length === 0) LOCALES.push("en", "zh", "ja", "es");

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

const EXCEPTIONS = new Set(["한국어"]);
const THEMES = [
  "kings-warden",
  "kpop-demon-hunters",
  "jeju-k-drama",
  "busan-film-trip",
  "rescene-route",
];
const THEME_TABS = ["map", "course", "film", "stamp", "info"];
const PLANNER_PLACES = [
  "gj1", // 숙박(체크인 · 체크아웃)
  "gj3",
  "ctu1", // 시티투어 경유지
  "ctu5",
  "rs1", // 연관 관광지(숙박)
  "rs117",
  "rs383",
  "ro1", // 연관 관광지
  "ro116",
  "ro465",
  "ro570",
  "nax101", // Google geocoding
  "nax120",
  "bcx14",
];
const THEME_PLACES = [
  ["kings-warden", "yw1"],
  ["kings-warden", "yw3"],
  ["kpop-demon-hunters", "kd1"],
  ["jeju-k-drama", "jd1"],
  ["busan-film-trip", "bc1"],
  ["rescene-route", "gjx1"],
  ["rescene-route", "gj2"],
];
const enc = encodeURIComponent;

// 설문 6.1(features/recommend/survey.ts)은 보기 번호 목록으로 답한다. 0부터, 음수는 뒤에서부터(-1 = 마지막 보기)
/** S1~S6 첫 보기 → B1(드라마·K팝 촬영지의 분기) */
const FIRST_OPTIONS = [0, 0, 0, 0, 0, 0];
/** 명세서 예제: 30대 · 혼자 · 천천히 · 역사·유적 · 한적한 곳 · 아침 일찍부터 · B2 첫 보기 → F1(C4 · C5) */
const SPEC_EXAMPLE = [2, 0, 2, 2, 2, 0, 0];

/** 훑을 페이지. 값은 주소 또는 { path, setup(page) } */
function pages() {
  const list = [
    { name: "home", path: "/" },
    { name: "recommend-s1", path: "/recommend" },
    {
      name: "recommend-b1",
      path: "/recommend",
      setup: (page) => answer(page, FIRST_OPTIONS),
    },
    {
      name: "recommend-f1",
      path: "/recommend",
      setup: (page) => answer(page, SPEC_EXAMPLE),
    },
    {
      // 첫 보기만 골라 끝까지(F1 없음) → 단일형
      name: "recommend-result-single",
      path: "/recommend",
      setup: (page) => toResult(page, [...FIRST_OPTIONS, 0]),
    },
    {
      // 명세서 예제 + 「위 경험들이 비슷하게 중요해요」(F1 마지막 보기) → 복합형
      name: "recommend-result-mixed",
      path: "/recommend",
      setup: (page) => toResult(page, [...SPEC_EXAMPLE, -1]),
    },
    { name: "me", path: "/me" },
  ];
  for (const slug of THEMES)
    for (const tab of THEME_TABS)
      list.push({ name: `${slug}-${tab}`, path: `/themes/${slug}?tab=${tab}` });
  for (const city of [null, "서울", "경주", "제주"])
    list.push({
      name: `planner-map-${city ?? "nation"}`,
      path: city ? `/planner?city=${enc(city)}` : "/planner",
    });
  list.push({
    name: "planner-course",
    path: "/planner?tab=course",
    course: { city: "경주", placeIds: ["gj2", "gj3", "gj4", "gj1"] },
  });
  for (const city of ["서울", "경주"])
    list.push({
      name: `planner-info-${city}`,
      path: `/planner?city=${enc(city)}&tab=info`,
    });
  for (const id of PLANNER_PLACES)
    list.push({
      name: `planner-sheet-${id}`,
      path: `/planner?place=${id}`,
      sheet: true,
    });
  for (const [slug, id] of THEME_PLACES)
    list.push({
      name: `theme-sheet-${slug}-${id}`,
      path: `/themes/${slug}?tab=map&place=${id}`,
      sheet: true,
    });
  return list;
}

/** 보기 번호 목록으로 차례로 답하고 다음 문항으로 넘긴다 */
async function answer(page, picks) {
  for (const pick of picks) {
    const options = page.locator('[role="radiogroup"] [role="radio"]');
    const count = await options.count();
    await options.nth(pick < 0 ? count + pick : pick).click();
    const next = page
      .locator('[role="radiogroup"]')
      .last()
      .locator("xpath=following::button[not(@disabled)][1]");
    await next.click();
    await page.waitForTimeout(250);
  }
}
async function toResult(page, picks) {
  await answer(page, picks);
  await page.waitForURL(/\/recommend\/result/, { timeout: 30000 });
  await page.waitForLoadState("networkidle");
}

/** 보이는 글자와 속성 중 한글이 든 것 */
function collect() {
  const H = /[ㄱ-ㆎ가-힣]/;
  const out = [];
  if (H.test(document.title)) out.push(`@title(document): ${document.title}`);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const s = n.textContent.trim();
    if (!s || !H.test(s)) continue;
    const el = n.parentElement;
    if (!el || el.closest("script,style,noscript,template")) continue;
    out.push(s.slice(0, 90));
  }
  for (const el of document.querySelectorAll(
    "[aria-label],[title],[placeholder],[alt],[aria-description]",
  ))
    for (const a of [
      "aria-label",
      "title",
      "placeholder",
      "alt",
      "aria-description",
    ]) {
      const v = el.getAttribute(a);
      if (v && H.test(v)) out.push(`@${a}: ${v.slice(0, 90)}`);
    }
  return {
    found: out,
    overflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  };
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  let total = 0;
  try {
    for (const locale of LOCALES) {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      await ctx.addCookies([
        { name: "locale", value: locale, url: BASE },
        // 첫 방문 로고 화면을 건너뛴다(features/home/splash-cookie.ts)
        { name: "tn_splash", value: "1", url: BASE },
      ]);
      let count = 0;
      const perPage = [];
      for (const p of pages()) {
        const page = await ctx.newPage();
        const errors = [];
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text().slice(0, 120));
        });
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
        try {
          if (p.course) {
            await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
            await page.evaluate(
              (v) =>
                localStorage.setItem("tn.planner.course", JSON.stringify(v)),
              p.course,
            );
          }
          await page.goto(BASE + p.path, {
            waitUntil: "networkidle",
            timeout: 60000,
          });
          if (p.setup) await p.setup(page);
          if (p.sheet) {
            await page.waitForSelector("dialog[open]", { timeout: 15000 });
            // 장소 시트의 무거운 필드(설명 · 운영시간 · 좌표 기준)를 받을 때까지
            await page.waitForLoadState("networkidle");
          }
          await page.waitForTimeout(1200);
          const { found, overflow } = await page.evaluate(collect);
          const hits = [...new Set(found)].filter((s) => !EXCEPTIONS.has(s));
          count += hits.length;
          perPage.push({ name: p.name, hits, overflow, errors });
        } catch (e) {
          perPage.push({
            name: p.name,
            hits: [],
            overflow: 0,
            errors: [`스크립트 오류: ${String(e).slice(0, 120)}`],
          });
        }
        await page.close();
      }
      await ctx.close();
      total += count;
      console.log(`\n[${locale}] 한글 ${count}건 · 페이지 ${perPage.length}개`);
      for (const r of perPage) {
        if (r.hits.length === 0 && r.overflow <= 0 && r.errors.length === 0)
          continue;
        console.log(
          `  ${r.name}: 한글 ${r.hits.length}${r.overflow > 0 ? ` · 가로 넘침 ${r.overflow}px` : ""}${r.errors.length ? ` · 콘솔 오류 ${r.errors.length}` : ""}`,
        );
        for (const h of r.hits) console.log(`    - ${h}`);
        for (const e of r.errors) console.log(`    ! ${e}`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\n합계: 한글 ${total}건`);
  process.exit(total > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
