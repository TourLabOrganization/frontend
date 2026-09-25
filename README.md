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
| 코드 포맷   | Prettier · ESLint                             |
| 배포        | Vercel                                        |

라이브러리를 고른 이유와 필요할 때 추가할 것은 `docs/stack.md`.

## 들어 있는 것

| 영역        | 내용                                                                                   |
| ----------- | -------------------------------------------------------------------------------------- |
| 백엔드 호출 | `src/lib/api/client.ts` — 응답 껍데기 풀기, `ApiError`, 토큰 첨부, 401 시 재발급 한 번 |
| 데이터 캐시 | `src/app/providers.tsx` — TanStack Query Provider                                      |
| 다국어      | `src/i18n/` + `messages/` — 쿠키로 언어 선택, 메시지 키 타입 검사                      |
| 디자인 토큰 | `src/app/globals.css` — PoC 팔레트 · 서체 임시 반영                                    |
| CI          | PR마다 린트 · 타입 검사 · 포맷 검사 · 빌드 (`.github/workflows/ci.yml`)                |
| 컨벤션      | `AGENTS.md` + `docs/` 8개 문서 (`CLAUDE.md`는 `AGENTS.md`를 불러오는 한 줄)            |

## 들어 있지 않은 것

실제 화면(홈 · 테마 코스 · 투어 플래너 · 테마 추천), 지도, 로그인 화면, 외부 API Route Handler,
테스트 도구. 필요해질 때 추가한다. 라이브러리는 `docs/stack.md`의 표에서 고른다.

홈은 제목만 있는 자리표시 화면이다. 디자인이 확정되면 만든다 (`docs/ui.md`).

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
npm run check    # 린트 · 타입 검사 · 포맷 검사 · 빌드
```

CI도 PR마다 `npm run check`를 돌린다.

## 배포 설정

브랜치는 `develop`(개발 · 배포)과 `main`(릴리스) 2개를 쓴다 (`docs/git.md`).

Vercel에 GitHub 저장소를 연결해 배포한다.

- 프로덕션 브랜치는 `develop`이다. `develop`에 머지되면 프로덕션에 반영된다
- PR마다 미리보기 주소가 생긴다
- 환경변수는 Vercel 프로젝트 설정의 Environment Variables에 넣는다 (`.env.example`과 같은 이름)
