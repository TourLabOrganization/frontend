<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Tour Navigator Frontend

Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS 4. 모바일부터 데스크톱까지 한 코드로 도는 반응형 웹앱.
백엔드는 `TourLabOrganization/backend`(Spring Boot 4, REST + JWT)다.
`CLAUDE.md`는 이 파일을 불러오기만 한다. 규칙은 이 파일에 쓴다.

## 작업 전에 읽을 문서

| 지금 하려는 일 | 먼저 읽을 문서 |
|---|---|
| 라이브러리 추가, 기술 선택 | `docs/stack.md` |
| 파일·폴더 만들기, 이름 짓기, 서버·클라이언트 컴포넌트 나누기 | `docs/structure.md` |
| 화면 만들기, 색·글꼴·반응형 | `docs/ui.md` |
| 화면에 보이는 문구 추가 | `docs/i18n.md` |
| 백엔드 API 호출, 로그인 토큰 | `docs/api.md` |
| 환경변수·API 키, 외부 API 호출 | `docs/security.md` |
| PoC(`Tour-Navigator-App`)에서 기능 가져오기 | `docs/poc.md` |
| 브랜치 만들기·커밋 메시지 쓰기·PR 올리기 | `docs/git.md` |
| Next.js API 쓰는 법 | `node_modules/next/dist/docs/` (위 블록) |

문서 간에 같은 규칙이 다르게 적혀 있으면 이 파일을 기준으로 한다.
그런 부분을 발견하면 `docs/` 쪽을 이 파일에 맞춰 고친다.

## 항상 적용

### 1. Next.js 15 이하 예제를 그대로 옮기지 않는다

- 바뀐 점은 `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`에 있다
- `cookies()`·`headers()`와 페이지·레이아웃의 `params`·`searchParams`는 전부 Promise다. `await`해서 쓴다.
  동기 접근은 16에서 완전히 없어졌다
- 페이지·레이아웃 props 타입은 전역 헬퍼 `PageProps<"/경로">`·`LayoutProps<"/경로">`를 쓴다
- `middleware.ts`는 `proxy.ts`로, 함수 이름은 `proxy`로 바뀌었다
- `next lint`는 없고 `next build`도 린트를 돌리지 않는다. `npm run lint`를 따로 돌린다

### 2. 백엔드는 `src/lib/api/client.ts`의 `api()`로만 부른다

- 백엔드를 `fetch`로 직접 부르지 않는다. 응답 껍데기(`{code, message, data}`) 풀기, 토큰 붙이기,
  만료 시 재발급을 `api()`가 한다
- 실패는 `ApiError`로 던져진다. 분기는 `message`가 아니라 `code`로 한다
- 컴포넌트에서는 TanStack Query(`useQuery`·`useMutation`)로 감싸서 부른다

### 3. API 키를 코드에 적지 않는다

- 키는 환경변수로만 읽는다. `.env.local`은 커밋하지 않는다
- `NEXT_PUBLIC_`이 붙은 값은 브라우저에 그대로 노출된다. 키 중에 붙여도 되는 것은 Google Maps 키 하나다
- 나머지 외부 API(TourAPI·Kakao·YouTube 등)는 Route Handler(`src/app/api/**/route.ts`)에서 부르고,
  브라우저는 그 Route Handler를 부른다

### 4. 화면 문구는 `messages/*.json`에 둔다

- 컴포넌트에 한국어·영어 문장을 직접 쓰지 않는다. `useTranslations`·`getTranslations`로 꺼낸다
- 키를 추가하면 `ko.json`과 `en.json`을 함께 고친다

### 5. 모바일부터 만든다

- 접두사 없는 클래스는 390px 폭 기준으로 쓰고, 넓은 화면은 `md:`·`lg:`로 덧붙인다
- 색은 `globals.css`의 토큰을 쓰고 hex 값을 직접 쓰지 않는다

### 6. 원격에 올리기 전에 사람에게 확인받는다

- 로컬 커밋까지는 확인 없이 진행한다. `git push`·`gh pr create`·`gh pr ready`·`gh pr merge`는
  실행 전에 사람에게 확인받는다
- 권한 확인을 건너뛰는 모드(bypass permissions, `--dangerously-skip-permissions`,
  자동 승인 설정)에서도 예외를 두지 않는다.
  도구 실행을 자동 승인한 것이 무엇을 공개할지까지 승인한 것은 아니다
- 한 번 확인받았다고 다음 푸시까지 확인받은 것으로 보지 않는다. 푸시마다 확인한다
- 주 브랜치(`develop`·`main`)에 직접 푸시하거나 force-push하는 것은
  확인 여부와 무관하게 하지 않는다 (`docs/git.md`)

## 커밋 전

`npm run format`을 실행한 뒤 `npm run check`(린트·타입 검사·포맷 검사·빌드)가 통과해야 한다.
화면을 바꿨다면 `npm run dev`로 띄워 390px 폭과 데스크톱 폭에서 직접 확인한다.
