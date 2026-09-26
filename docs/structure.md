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
  lib/                  화면과 무관한 코드 (api 클라이언트, 여러 기능이 쓰는 localStorage 값 local-store.ts, 유틸)
  i18n/                 다국어 설정
messages/               화면 문구 (ko.json · en.json)
scripts/                데이터 생성 스크립트 (원천 파일 경로를 인자로 받는다)
public/                 정적 파일
```

- 새 코드는 `features/<기능>/`에서 시작한다
- 두 번째 기능이 실제로 import하게 되면 그때 `components/`나 `lib/`로 올린다.
  미리 올려 두지 않는다

## 화면 경로

| 경로                | 화면                                                            | 코드                                                                 |
| ------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/`                 | 홈(첫 방문 로고 시작 화면 · 배너 · 나의 테마 · 추천 코스)       | `app/page.tsx`, `features/home`                                      |
| `/recommend`        | 테마 추천 14문항                                                | `app/recommend/page.tsx`, `features/recommend`                       |
| `/recommend/result` | 추천 결과                                                       | `app/recommend/result/page.tsx`                                      |
| `/themes/[themeId]` | 테마 화면. 하단 탭 5개(지도 · 코스 · 영화 · 스탬프 · 여행 정보) | `app/themes/[themeId]/page.tsx`, `features/theme`, `features/course` |
| `/planner`          | 투어 플래너. 지역 탭 + 하단 탭 3개(지도 · 코스 · 여행 정보)     | `app/planner/page.tsx`, `features/planner`                           |
| `/me`               | ME(추천받은 나의 테마 · 저장된 플랜)                            | `app/me/page.tsx`, `features/me`                                     |

### 테마 화면 주소 (`/themes/[themeId]`)

| 쿼리    | 값                                           | 쓰임                                                              |
| ------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `tab`   | `map` · `course` · `film` · `stamp` · `info` | 고른 탭. 없거나 모르는 값이면 `map`                               |
| `a`     | 추천 답(Q10~Q14, `encodeAnswers`)            | 코스 탭의 조건. 코스 탭의 일정 · 이동수단 칸이 q11 · q12만 바꾼다 |
| `plan`  | `classic` · `trend` · `quiet`                | 코스 3안                                                          |
| `place` | 장소 id                                      | 지도 탭에서 그 장소 시트를 연 채로 시작                           |

- 탭을 바꿔도 `a` · `plan`은 주소에 남긴다. 주소는 `features/theme/tabs.ts`의 `themeHref`로 만든다
- 영화 탭의 장면 카드는 `id`가 장면 id라 `?tab=film#{장면 id}`로 바로 간다
- 추천 결과 · ME 저장된 플랜 · 홈 추천 코스는 `tab=course`로, 홈 포스터 타일 · 배너는 기본(지도)으로 들어온다

### 투어 플래너 주소 (`/planner`)

| 쿼리     | 값                         | 쓰임                                                                                 |
| -------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `city`   | 도시 한국어 이름(`경주`)   | 도시 보기. 없거나 장소가 없는 도시면 전국 보기                                       |
| `region` | 권역 key(`capital` 등 7개) | 전국 보기에서 고른 권역. 지도는 그 권역에 맞추고 목록을 거른다. `city`가 있으면 무시 |
| `tab`    | `map` · `course` · `info`  | 고른 탭. 없거나 모르는 값이면 `map`                                                  |
| `place`  | 장소 id                    | 지도 탭에서 그 장소 시트를 연 채로 시작                                              |

- 주소는 `features/planner/query.ts`의 `plannerHref` · `scopeHref`로 만든다. 기본값(전국 · `map`)은 주소에 적지 않는다
- 지역 탭 · 도시 고르기는 탭을 남기고 범위만 바꾸고, 하단 탭은 범위를 남기고 탭만 바꾼다
- 권역 key와 도시 목록은 `features/planner/data/regions.json`(PoC `REG`)에 있다
- 코스에 담은 장소는 주소가 아니라 localStorage `tn.planner.course`에 둔다(`features/planner/course-store.ts`)

## 서버 컴포넌트와 클라이언트 컴포넌트

- 기본은 서버 컴포넌트다. 클릭 · 입력 · 상태 · 브라우저 API가 필요한 가장 작은 컴포넌트에만 `"use client"`를 붙인다
- 페이지나 레이아웃 전체에 `"use client"`를 붙이지 않는다
- 로그인 토큰이 필요한 백엔드 호출은 클라이언트 컴포넌트에서 한다. 토큰이 브라우저(localStorage)에 있기 때문이다.
  로그인 없이 보는 공개 데이터는 서버 컴포넌트에서 불러도 된다
- Google Maps처럼 `window`가 필요한 라이브러리는 클라이언트 컴포넌트 안에서만 쓴다

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
