# 구조와 이름

## 폴더

```
src/
  app/                  라우트. 폴더 경로가 곧 URL
    layout.tsx          전역 레이아웃 (폰트 · Provider)
    providers.tsx       클라이언트 Provider (TanStack Query)
    api/**/route.ts     Route Handler. 키가 필요한 외부 API를 대신 부른다
  components/           여러 기능이 함께 쓰는 컴포넌트
  features/<기능>/      한 기능에서만 쓰는 컴포넌트 · 훅 · 타입 · 데이터 (예: features/planner)
  lib/                  화면과 무관한 코드 (api 클라이언트, 유틸)
  i18n/                 다국어 설정
messages/               화면 문구 (ko.json · en.json)
public/                 정적 파일
```

- 새 코드는 `features/<기능>/`에서 시작한다
- 두 번째 기능이 실제로 import하게 되면 그때 `components/`나 `lib/`로 올린다.
  미리 올려 두지 않는다

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
