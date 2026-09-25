# 스택

| 역할        | 쓰는 것                                                      | 비고                                                        |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| 프레임워크  | Next.js 16 (App Router, Turbopack)                           | React 19.2                                                  |
| 언어        | TypeScript (strict)                                          |                                                             |
| 스타일      | Tailwind CSS 4                                               | 토큰은 `src/app/globals.css`의 `@theme`                     |
| 서버 데이터 | TanStack Query 5                                             | 백엔드 호출은 `api()`를 `useQuery`·`useMutation`으로 감싼다 |
| 다국어      | next-intl 4                                                  | URL에 언어 코드 없이 쿠키로 고른다                          |
| 포맷·린트   | Prettier(+ Tailwind 클래스 정렬), ESLint(eslint-config-next) |                                                             |
| 배포        | Vercel                                                       |                                                             |
| 런타임      | Node.js 24.21.0 (`.nvmrc`) · npm 11.19.0                     | CI도 `.nvmrc`의 버전을 쓴다                                 |

## 의존성 설치

- `package-lock.json`은 `.nvmrc`의 Node에 딸린 npm(11.19.0)으로 갱신한다.
  낮은 npm으로 만든 lockfile은 CI의 `npm ci`가 `Missing: ... from lock file`로 거부한다
- 로컬 Node 버전이 다르면 `npx -y npm@11.19.0 install <패키지>`로 설치한다
- Node를 올릴 때는 `.nvmrc`와 이 표의 버전을 함께 고친다

## 필요해지면 이것을 쓴다

같은 역할의 라이브러리를 둘 들이지 않는다. 아래 표에 없는 역할이 생기면 PR에 이유를 적고 표에 추가한다.

| 역할                 | 쓸 것                             | 쓰지 않는 것                                               |
| -------------------- | --------------------------------- | ---------------------------------------------------------- |
| 지도                 | `@vis.gl/react-google-maps`       | 다른 Google Maps 래퍼, 지도 라이브러리 혼용                |
| 전역 클라이언트 상태 | Zustand                           | Redux, Recoil, Jotai                                       |
| 폼·검증              | react-hook-form + zod             | Formik, yup                                                |
| 날짜                 | date-fns                          | moment, dayjs                                              |
| 아이콘               | lucide-react                      | 이모지로 아이콘 대신하기                                   |
| HTTP                 | `src/lib/api/client.ts`의 `api()` | axios, 백엔드 직접 `fetch`                                 |
| 스타일               | Tailwind 클래스                   | styled-components·emotion 같은 CSS-in-JS, CSS Modules 혼용 |

서버에서 가져오는 데이터를 Zustand에 복사해 두지 않는다. 서버 데이터는 TanStack Query 캐시가 들고 있고,
Zustand에는 화면 사이에서 공유하는 사용자 선택(고른 장소, 날짜 등)만 둔다.
