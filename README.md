# Tour Navigator Frontend

영상 속 장소를 따라 걷는 여행 계획 앱의 프론트엔드.
모바일부터 데스크톱까지 한 코드로 도는 반응형 웹앱이다.

## 기술 스택

| 구분        | 사용 기술                                     |
| ----------- | --------------------------------------------- |
| 프레임워크  | Next.js 16 (App Router, Turbopack) · React 19 |
| 언어        | TypeScript                                    |
| 스타일      | Tailwind CSS 4                                |
| 서버 데이터 | TanStack Query 5                              |
| 다국어      | next-intl 4 (ko · en)                         |
| 지도        | 카카오 지도 (react-kakao-maps-sdk)            |
| 코드 포맷   | Prettier · ESLint                             |
| 테스트      | Vitest                                        |
| 배포        | Vercel                                        |

라이브러리를 고른 이유와 필요할 때 추가할 것은 `docs/stack.md`.

## 들어 있는 것

| 영역        | 내용                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 백엔드 호출 | `src/lib/api/client.ts` — 응답 껍데기 풀기, `ApiError`, 토큰 첨부, 401 시 재발급 한 번. 데이터랩 조회는 `src/lib/api/datalab.ts` |
| 데이터 캐시 | `src/app/providers.tsx` — TanStack Query Provider                                                                                |
| 다국어      | `src/i18n/` + `messages/` — 쿠키로 언어 선택, 메시지 키 타입 검사                                                                |
| 디자인 토큰 | `src/app/globals.css` — 클린 트래블 색 · 글자 크기, Pretendard (`docs/ui.md`)                                                    |
| 공통 UI     | `src/components/ui/` — 화면 틀, 상단 바, 하단 버튼, 하단 탭, 화면 안 탭 바, 버튼, 보기, 배지, 진행 막대, 링크형 탭, 장소 시트    |
| CI          | PR마다 `npm run check` — 린트 · 타입 검사 · 포맷 검사 · 테스트 · 빌드 (`.github/workflows/ci.yml`)                               |
| 컨벤션      | `AGENTS.md` + `docs/` 8개 문서 (`CLAUDE.md`는 `AGENTS.md`를 불러오는 한 줄)                                                      |

## 백엔드 연동 현황

| 화면              | 백엔드 API                                                         | 비고                                                                                                                            |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 추천 결과         | (부르지 않음)                                                      | 설문 6.3 · 추천 6.4를 팀 명세서 참조 계산으로 프론트에서 계산한다. data-server에 그 API가 생기면 그 API로 바꾼다(`docs/api.md`) |
| 테마 여행 정보 탭 | `GET /api/v1/courses` · `GET /api/v1/tfi` · `GET /api/v1/staytime` | 「데이터랩으로 본 {지역}」                                                                                                      |
| 로그인 · 회원가입 | (아직 연결 안 함)                                                  |                                                                                                                                 |

공개 API는 서버 컴포넌트에서 부른다(`docs/api.md`). 설문 유형 판정 · 테마 적합도 지수 · 홈 시티투어 내 유형 추천은 data-server API가 생기기 전까지 프론트에서 계산한다(`docs/structure.md` 「추천과 데이터랩」).

## 들어 있지 않은 것

로그인 화면, 외부 API Route Handler(지금 Route Handler는 플래너 장소 시트의 설명 · 사진을 돌려주는 `/api/planner/places/[id]` 하나다).
필요해질 때 추가한다. 라이브러리는 `docs/stack.md`의 표에서 고른다.

홈(`/` — 첫 방문 로고 시작 화면, 배너, 나의 테마, 추천 코스, 하단 탭), 테마 추천(`/recommend`),
테마 화면(`/themes/[themeId]` — 하단 탭 지도 · 코스 3안 · 영화 속 장면 · 스탬프 · 여행 정보, 카카오 지도), ME(`/me` — 추천받은 나의 테마, 저장된 플랜)는 있다.
투어 플래너(`/planner` — 전국 · 도시별 장소 3,118곳 지도와 목록, 권역 묶음, 도시 고르기, 분류 아이콘 · 배지(데이터랩 인기 · 유네스코 · 한국관광 100선 · 열린관광지 · 관광특구 · 관광단지) 필터, 데이터랩 인기 순위가 있는 곳을 먼저 보이는 목록, 코스에 담기, 여행 정보)도 있다.
장소 데이터는 PoC 9/27 빌드(`Tour-Navigator-App` main f44eb97)에서 `scripts/`로 만든다(`docs/structure.md` 「데이터 원본과 스크립트」).
플래너의 코스 탭은 코스 빌더다(날짜 · 출발지 · 시각 · 광역 교통 · 현지 이동, 추천 코스 불러오기, 일자별 일정, 1박마다 숙소 카드(주변 숙소 · 날짜가 채워진 숙박 예약), 예매 링크, 코스 저장 → ME).
일정 계산은 `src/features/planner/schedule.ts`, 도시 고르기 숫자는 PoC 규칙(전용 화면 도시 우선, `pickCity`)을 따른다.
추천 결과, 저장한 코스(테마 · 플래너), 테마별 북마크 · 스탬프, 플래너에 담은 장소와 코스 설정은 로그인 없이 이 브라우저의 localStorage에만 둔다 (`src/lib/local-store.ts`).
코스 3안은 트렌드·혼잡도 데이터가 아직 없어 장소 데이터만으로 만든 대체 규칙을 쓴다 (`src/features/course/scenarios.ts`).
홈 타일은 작품 포스터, 추천 결과 카드는 작품 스틸(TMDB 이미지)이다. 작품이 없는 테마(RESCENE)는 토큰 색 자리표시다. 이미지 규칙은 `docs/ui.md`.

## 실행 방법

### 환경 설정

- Node.js 24.21.0 (`.nvmrc`). 의존성은 npm 11.19.0으로 설치한다 (`docs/stack.md`)

```bash
npm install
cp .env.example .env.local
```

`.env.local`에 채울 값:

| 이름                        | 설명                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`  | 백엔드 주소. 개발 서버는 `https://3.36.114.238.nip.io`, 로컬 백엔드는 `http://localhost:8080`                                     |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오 지도 JavaScript 키. 카카오 앱에 등록한 도메인(`localhost:5173` 등)에서만 동작한다                                          |
| `DATA_GO_KR_KEY`            | 서버 전용. 공공데이터포털 디코딩 키. 장소 시트의 오디오 가이드 · 연관 관광지 · 집중률 세 API 활용신청 필요(없으면 그 칸이 숨는다) |
| 그 밖의 서버 전용 키        | 서버 전용 외부 API 키. 목록과 규칙은 `.env.example` · `docs/security.md`                                                          |

### 실행

```bash
npm run dev
```

### 확인

- 화면: http://localhost:5173
- 포트가 5173인 이유: 백엔드 `CORS_ALLOWED_ORIGINS` 기본값이 `http://localhost:5173`이다 (`docs/api.md`)

### 커밋 전

```bash
npm run format   # Prettier로 정리
npm run test     # Vitest 단위 테스트
npm run check    # 린트 · 타입 검사 · 포맷 검사 · 테스트 · 빌드
```

CI도 PR마다 `npm run check`를 돌린다.

## 배포 설정

브랜치는 `develop`(개발 · 배포)과 `main`(릴리스) 2개를 쓴다 (`docs/git.md`).

Vercel에 GitHub 저장소를 연결해 배포한다.

- 프로덕션 브랜치는 `develop`이다. `develop`에 머지되면 프로덕션에 반영된다
- PR마다 미리보기 주소가 생긴다
- 환경변수는 Vercel 프로젝트 설정의 Environment Variables에 넣는다 (`.env.example`과 같은 이름)
- 서버(Vercel Function)는 서울(`icn1`)에서 돈다(`vercel.json`의 `regions`). 기본값은 미국 동부(`iad1`)인데, 서버가 부르는 백엔드(AWS 서울)와 한국관광공사 공공 API가 모두 한국에 있어 호출마다 태평양을 왕복하지 않게 옮겼다. Hobby 요금제는 한 지역만 고를 수 있다
