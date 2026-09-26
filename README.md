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
| 지도        | @vis.gl/react-google-maps (Google Maps)       |
| 코드 포맷   | Prettier · ESLint                             |
| 테스트      | Vitest                                        |
| 배포        | Vercel                                        |

라이브러리를 고른 이유와 필요할 때 추가할 것은 `docs/stack.md`.

## 들어 있는 것

| 영역        | 내용                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- |
| 백엔드 호출 | `src/lib/api/client.ts` — 응답 껍데기 풀기, `ApiError`, 토큰 첨부, 401 시 재발급 한 번              |
| 데이터 캐시 | `src/app/providers.tsx` — TanStack Query Provider                                                   |
| 다국어      | `src/i18n/` + `messages/` — 쿠키로 언어 선택, 메시지 키 타입 검사                                   |
| 디자인 토큰 | `src/app/globals.css` — 클린 트래블 색 · 글자 크기, Pretendard (`docs/ui.md`)                       |
| 공통 UI     | `src/components/ui/` — 화면 틀, 상단 바, 하단 버튼, 하단 탭, 버튼, 보기, 배지, 진행 막대, 링크형 탭 |
| CI          | PR마다 `npm run check` — 린트 · 타입 검사 · 포맷 검사 · 테스트 · 빌드 (`.github/workflows/ci.yml`)  |
| 컨벤션      | `AGENTS.md` + `docs/` 8개 문서 (`CLAUDE.md`는 `AGENTS.md`를 불러오는 한 줄)                         |

## 들어 있지 않은 것

로그인 화면, 투어 플래너(`/planner`, 직접 고르는 코스 — 3단계 예정), 외부 API Route Handler.
필요해질 때 추가한다. 라이브러리는 `docs/stack.md`의 표에서 고른다.

홈(`/` — 첫 방문 로고 시작 화면, 배너, 나의 테마, 추천 코스, 하단 탭), 테마 추천(`/recommend`),
테마 화면(`/themes/[themeId]` — 하단 탭 지도 · 코스 3안 · 영화 속 장면 · 스탬프 · 여행 정보, Google 지도), ME(`/me` — 추천받은 나의 테마, 저장된 플랜)는 있다.
추천 결과, 저장한 코스, 테마별 북마크 · 스탬프는 로그인 없이 이 브라우저의 localStorage에만 둔다 (`src/lib/local-store.ts`).
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

| 이름                          | 설명                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_BASE_URL`    | 백엔드 주소. 로컬 백엔드는 `http://localhost:8080`                       |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Maps 키. 브라우저에 노출되므로 도메인 제한을 건 키만 쓴다         |
| `NEXT_PUBLIC_GOOGLE_MAP_ID`   | Google 지도 ID. 비우면 `DEMO_MAP_ID`(번호 핀에 필요)                     |
| `DATA_GO_KR_KEY` 외           | 서버 전용 외부 API 키. 목록과 규칙은 `.env.example` · `docs/security.md` |

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
