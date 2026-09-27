# 구조와 이름

## 폴더

```
src/
  app/                  라우트. 폴더 경로가 곧 URL
    layout.tsx          전역 레이아웃 (폰트 · Provider)
    providers.tsx       클라이언트 Provider (TanStack Query)
    api/**/route.ts     Route Handler. 키가 필요한 외부 API를 대신 부른다
  components/           여러 기능이 함께 쓰는 컴포넌트
  features/<기능>/      한 기능에서만 쓰는 컴포넌트 · 훅 · 타입 · 데이터 (예: features/recommend, features/course, features/theme, features/planner, features/home, features/me)
  lib/                  화면과 무관한 코드 (api 클라이언트, 데이터랩 조회 api/datalab.ts, 여러 기능이 쓰는 localStorage 값 local-store.ts, 유틸)
  i18n/                 다국어 설정
messages/               화면 문구 (ko.json · en.json)
scripts/                데이터 생성 스크립트 (원천 파일 경로를 인자로 받는다)
public/                 정적 파일
```

- 새 코드는 `features/<기능>/`에서 시작한다
- 두 번째 기능이 실제로 import하게 되면 그때 `components/`나 `lib/`로 올린다.
  미리 올려 두지 않는다

## 화면 경로

| 경로                | 화면                                                                           | 코드                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `/`                 | 홈(첫 방문 로고 시작 화면 · 배너 · 지역 시티투어 · 나의 테마 · 지금 인기 코스) | `app/page.tsx`, `features/home`                                                                             |
| `/recommend`        | 테마 추천 15문항                                                               | `app/recommend/page.tsx`, `features/recommend`                                                              |
| `/recommend/result` | 추천 결과(테마 순위는 백엔드 추천 API)                                         | `app/recommend/result/page.tsx`, `features/recommend/api.ts`, `lib/api/datalab.ts`                          |
| `/themes/[themeId]` | 테마 화면. 하단 탭 5개(지도 · 코스 · 영화 · 스탬프 · 여행 정보)                | `app/themes/[themeId]/page.tsx`, `features/theme`, `features/course`, `features/planner/regions`(도시 이름) |
| `/planner`          | 투어 플래너. 지역 탭 + 하단 탭 3개(지도 · 코스 · 여행 정보)                    | `app/planner/page.tsx`, `features/planner`                                                                  |
| `/me`               | ME(나의 여행자 유형 · 저장된 플랜)                                             | `app/me/page.tsx`, `features/me`, `features/planner`(저장한 코스 설정 · 도시 이름 · 일수)                   |

### 테마 화면 주소 (`/themes/[themeId]`)

| 쿼리    | 값                                           | 쓰임                                                              |
| ------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `tab`   | `map` · `course` · `film` · `stamp` · `info` | 고른 탭. 없거나 모르는 값이면 `map`                               |
| `a`     | 추천 답(Q10~Q14, `encodeAnswers`)            | 코스 탭의 조건. 코스 탭의 일정 · 이동수단 칸이 q11 · q12만 바꾼다 |
| `plan`  | `classic` · `trend` · `quiet`                | 코스 3안                                                          |
| `place` | 장소 id                                      | 지도 탭에서 그 장소 시트를 연 채로 시작                           |

- 탭을 바꿔도 `a` · `plan`은 주소에 남긴다. 주소는 `features/theme/tabs.ts`의 `themeHref`로 만든다
- 영화 탭의 장면 카드는 `id`가 장면 id라 `?tab=film#{장면 id}`로 바로 간다
- 지도 탭: 지역 줄(RESCENE는 전국 · 거제 · 경주 칩, 한 도시 테마는 도시 이름 · 장소 수), 목록 접기. 목록 행의 거리는 도시 center(PoC `DATA.<도시>.center`)에서 직선거리이고, 여러 도시 보기(RESCENE 전국)는 거리 대신 도시 이름이다(목업 규칙, `features/theme/place-list.ts`). 장면이 있는 행은 영화(영상) 탭 바로가기
- RESCENE는 하단 탭 이름이 영상 · 팬소통이고, 영상 정렬은 인기순(PoC에 적힌 조회수) · 최신순이다
- 추천 결과 · ME 저장된 플랜 · 홈 추천 코스는 `tab=course`로, 홈 포스터 타일 · 배너는 기본(지도)으로 들어온다

### 투어 플래너 주소 (`/planner`)

| 쿼리     | 값                         | 쓰임                                                                                               |
| -------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `city`   | 도시 한국어 이름(`경주`)   | 도시 보기. 없거나 장소가 없는 도시면 전국 보기                                                     |
| `plan`   | 저장된 플래너 플랜 id      | 코스 탭에서 그 플랜을 코스로 불러온다(담은 코스가 있고 다르면 먼저 묻는다). 불러오면 주소에서 뗀다 |
| `region` | 권역 key(`capital` 등 7개) | 전국 보기에서 고른 권역. 지도는 그 권역에 맞추고 목록을 거른다. `city`가 있으면 무시               |
| `tab`    | `map` · `course` · `info`  | 고른 탭. 없거나 모르는 값이면 `map`                                                                |
| `place`  | 장소 id                    | 지도 탭에서 그 장소 시트를 연 채로 시작                                                            |

- 주소는 `features/planner/query.ts`의 `plannerHref` · `scopeHref`로 만든다. 기본값(전국 · `map`)은 주소에 적지 않는다
- 지역 탭 · 도시 고르기는 탭을 남기고 범위만 바꾸고, 하단 탭은 범위를 남기고 탭만 바꾼다
- 권역 key와 도시 목록은 `features/planner/data/regions.json`(PoC `REG` + `MACRO_OF`)에 있다. 권역 이름은 목업 지도가 그리는 `MACRO_REGION` 이름(경북권 · 경남권 · 전라권 …)이다
- 지도 탭은 분류 칩과 배지 칩(유네스코 · 한국관광 100선 · 열린관광지 · 관광특구, `features/planner/badges.ts`)을 AND로 거른다. 배지 칩은 한 번에 하나, 다시 누르면 꺼진다
- 도시 보기(`city`)는 장소의 `pickCity`(도시 고르기에서 속한 도시)로 거른다. 전용 화면이 있는 도시(서울 · 부산 · 제주 · 영월 · 경주 · 거제)는
  그 화면 장소만 보이고, 같은 도시의 전국 목록 장소는 전국 · 권역 보기에만 들어간다(PoC `cityRows` 규칙, `scripts/build-planner.mjs`)
- 코스에 담은 장소와 코스 설정(플랜 이름 · 출발일 · 귀가일 · 출발지 · 출발 시각 · 여행지 출발 시각 · 광역 교통 · 현지 이동)은
  주소가 아니라 localStorage `tn.planner.course`에 둔다(`features/planner/course-store.ts`). 없는 필드는 기본값(오늘 · 당일 · 서울역 · 08:00 · 19:00)
- 한 코스는 한 도시(`locKo`)의 장소만 담는다. 권역에서 불러온 추천 코스만 여러 도시가 섞일 수 있다
- 코스 탭의 일정 · 요약은 `features/planner/schedule.ts`의 `buildPlannerSchedule`이 계산하고 화면은 그 결과만 그린다.
  날짜 나누기는 테마 코스와 같은 `course/scenarios.ts`의 `splitDays`, 출발지는 `data/regions.json`의 `origins`(PoC `ORIGINS` 61곳)

### 데이터 원본과 스크립트

원본은 PoC(`Tour-Navigator-App`, 읽기만)이고 이 리포에 넣지 않는다. 만든 JSON은 손으로 고치지 않는다. 스크립트를 돌린 뒤 `npm run format`.
마지막 동기화: 2026-09-27, PoC main f44eb97 (`docs/poc.md`).

| 스크립트                         | 입력(PoC)                                                                                                   | 출력                                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/build-planner.mjs`      | `체류시간 산정/체류시간_장소별.csv` · `Tour Planner.dc.html` · `파생 데이터/`(장소 · 지역거점 · 출발지 CSV) | `features/planner/data/places.json`(3,118곳, 가벼운 필드) · `place-details.json`(무거운 필드) · `regions.json`                                |
| `scripts/build-places.mjs`       | `체류시간_장소별.csv` · `Tour Planner.dc.html` · `RESCENE Route.dc.html`                                    | `features/course/data/places.json`(테마 5개 장소) · `hubs.json` · `fixtures/gyeongju-nation.json`                                             |
| `scripts/build-citytour.mjs`     | `data/citytour.json`(시티투어 280노선). 플래너 `places.json` · `place-details.json`(ct)을 먼저 만든다       | `features/home/data/citytour.json`(노선 + 코스빌더에 넣을 장소 id)                                                                            |
| `scripts/build-theme-extras.mjs` | 테마 화면 5개 `*.dc.html`                                                                                   | `features/theme/data/extras.json`(사진 · 설명 · 장면 연결 · 좌표 기준) · `scenes.json`(RESCENE 조회수 포함) · `cities.json`(도시 칩 · center) |
| `scripts/build-names.mjs`        | `Tour Planner.dc.html`(`REG` · `CITY_NAME` · `I18N.locs`) · `파생 데이터/장소.csv`(중 · 일 장소명)          | `features/names/data/zh.json` · `ja.json` · `es.json`(권역 · 도시 · 장소 이름표, 그 언어 화면일 때만 싣는다)                                  |

플래너 장소 필드

- 가벼운 필드(`places.json`, 클라이언트 번들에 들어간다): `course/places.ts` `Place` 필드(`id` · `n` · `ko` · `en` · `locKo` · `cat` · `lat` · `lng` · `min` · `hrs` · `open` · `close` · `yt` · `off` · `k100` · `un` · `bf` · `auto`) + `macro`(권역) · `pickCity`(도시 고르기 도시) · `vz`(지정구역 문구)
- 무거운 필드(`place-details.json`, id → 값): `desc`(설명 한 · 영) · `img` · `imgCredit` · `zh` · `ja`(중 · 일 장소명) · `src`(좌표 근거) · `url`(카카오 장소 URL) · `ct`(시티투어 경유) · `rs`(연관관광지).
  클라이언트는 이 JSON을 import하지 않는다. 장소 시트를 열 때 Route Handler `app/api/planner/places/[id]/route.ts`가 한 곳(1KB 안팎)만 돌려주고
  `features/planner/use-place-detail.ts`(TanStack Query)가 받는다. 동적 import로 나누면 시트 하나를 열 때 3,118곳 전체(약 650KB)나 큰 조각을 받아야 해서 Route Handler를 골랐다
- 값이 없으면 필드를 비운다. 관문(`regions.json` `hubs`) · 출발지(`origins`)는 PoC `REGION_HUB` · `ORIGINS` 모양 그대로 두고 수단(`modes`)만 `지역거점.csv` · `출발지.csv`(전철 `metro` 포함) 값을 쓴다

### 추천과 데이터랩

- 설문 Q1~Q9로 유형(군집)을 판정하는 것(`features/recommend/scoring.ts`의 `classify`)만 프론트에서 한다
- 테마 순위는 백엔드 `POST /api/v1/recommend` 결과를 그대로 쓴다(`features/recommend/api.ts`).
  요청은 1순위 군집 · Q4 관심사 index · 야경 · Q15 지역(골랐을 때만), 응답 테마 이름은 `themes.ts`의 `key`로 우리 테마에 잇고 목록에 없는 테마(「[가상] …」)는 뺀다
- 결과 화면은 API 1위 테마를 localStorage `tn.lastTopTheme`(`{ a, slug }`)에 적고, ME는 다시 계산하지 않고 이 값을 읽는다
- 데이터랩 조회(TFI · 체류시간 · 코스 지역)는 결과 화면과 테마 화면(여행 정보 탭 `features/theme/DatalabSection.tsx`)이 함께 쓰므로 `lib/api/datalab.ts`에 둔다.
  TFI 막대는 `components/TfiBars.tsx`

### 홈 지역 시티투어

- 데이터 가공(분류 칩 · 내 유형 추천 · 지역 집계)은 `features/home/citytour.ts`, 경유지 → 플래너 장소 대조는 `citytour-match.ts`. 둘 다 목업(9/27 standalone) 규칙을 옮긴 순수 함수다
- 경유지 대조는 빌드 때 `scripts/build-citytour.mjs`가 미리 해서 노선마다 `placeIds`를 적는다(클라이언트가 3,118곳 · ct를 받지 않게). 노선 지역 이름과 같은 경유지(「서울 → … → 서울」)는 대조하지 않는다(목업과 다른 점)
- 「코스빌더에 넣기」는 `course-store`의 `replace`로 코스를 바꾸고 `/planner?tab=course`로 간다. 담아 둔 다른 코스가 있으면 먼저 묻는다
- 내 유형 추천은 `tn.lastRecommendation`의 답으로 `classify`를 다시 돌려 군집 선호 벡터(`CLUSTER_PREFS`, 목업 CL)와 맞춘다

### 머리줄 알림 (`tn.notifications.read`)

- 알림은 이 브라우저에 있는 정보(추천 결과 · 플래너 코스 · 저장된 플랜 · 시티투어 데이터)로만 만든다(`lib/notifications.ts`). 읽은 알림 id 목록을 `tn.notifications.read`에 둔다
- 알림 id는 내용으로 만들어서 내용이 바뀌면 다시 안 읽음이 된다

### 저장된 플랜 (`tn.savedPlans`)

- 테마 코스 `{ slug, a, plan, savedAt }`와 투어 플래너 코스 `{ kind: "planner", id, name, city, placeIds, settings, savedAt }`가 한 배열에 산다.
  `kind`가 없으면 테마 코스다. 읽기 · 쓰기는 `lib/local-store.ts`(`parseSavedPlans` · `parsePlannerPlans` · `writeSavedPlans` · `writePlannerPlans`)만 쓰고,
  한쪽을 쓸 때 다른 쪽 항목은 그대로 둔다
- ME는 둘을 저장한 순서대로 보인다. 플래너 플랜은 「{이름} · {도시} · {n박 m일} · {n}곳」, 누르면 `/planner?tab=course&plan={id}`

### 저장한 장소 (`tn.savedPlaces`)

- 장소 시트의 「저장」(북마크). `{ id, source, savedAt, name: { ko, en } }[]`. `source`는 테마 slug 또는 `planner`이고, 같은 장소도 출처가 다르면 따로 저장한다.
  `name`은 ME가 장소 데이터(플래너 3,118곳)를 불러오지 않고 이름을 보이려고 저장할 때 적어 둔다. 읽기 · 쓰기는 `lib/local-store.ts`(`parseSavedPlaces` · `toggleSavedPlace` · `useSavedPlaces`)
- ME 「저장한 장소」는 저장한 순서대로, 누르면 테마는 `/themes/{slug}?tab=map&place={id}`, 플래너는 `/planner?place={id}`(시트가 열린 지도 탭)
- 테마 스탬프 탭 아래쪽 「저장한 장소」는 그 테마(`source`)에서 저장한 것만. 예전 테마별 북마크 `tn.bookmarks.{slug}`는 읽지 않는다
- 스탬프(`tn.stamps.{slug}`, `features/theme/storage.ts`)는 시트 · 스탬프 탭이 함께 쓰는 토글이다. PoC 코드(`d_toggleStamp`)에 위치 확인 규칙이 없어 위치를 보지 않는다

## 서버 컴포넌트와 클라이언트 컴포넌트

- 기본은 서버 컴포넌트다. 클릭 · 입력 · 상태 · 브라우저 API가 필요한 가장 작은 컴포넌트에만 `"use client"`를 붙인다
- 페이지나 레이아웃 전체에 `"use client"`를 붙이지 않는다
- 로그인 토큰이 필요한 백엔드 호출은 클라이언트 컴포넌트에서 한다. 토큰이 브라우저(localStorage)에 있기 때문이다.
  로그인 없이 보는 공개 데이터는 서버 컴포넌트에서 불러도 된다
- 카카오 지도처럼 `window`가 필요한 라이브러리는 클라이언트 컴포넌트 안에서만 쓴다

## 이름

| 대상                 | 규칙                                                                             | 예                                        |
| -------------------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| 컴포넌트 파일        | PascalCase                                                                       | `ThemeCard.tsx`                           |
| 그 외 파일           | kebab-case                                                                       | `use-route-plan.ts`, `format-duration.ts` |
| `src/app/` 안의 파일 | Next.js 파일 규칙                                                                | `page.tsx`, `layout.tsx`, `route.ts`      |
| 컴포넌트             | named export. `page.tsx`·`layout.tsx`처럼 Next.js가 요구하는 곳만 default export | `export function ThemeCard()`             |
| 훅                   | `use` 접두사                                                                     | `useRoutePlan`                            |
| 백엔드 응답 타입     | Swagger에 나온 DTO 이름 그대로                                                   | `UserMeResponse`                          |
| URL 경로             | 소문자 kebab-case                                                                | `/theme-routes/[themeId]`                 |
