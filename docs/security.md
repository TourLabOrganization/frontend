# 환경변수와 키

## 환경변수

- 로컬: `cp .env.example .env.local` 후 값을 채운다. `.env.local`은 커밋되지 않는다
- 배포: Vercel 프로젝트 설정의 Environment Variables에 넣는다
- 새 변수를 쓰면 `.env.example`에 이름과 설명을 함께 추가한다

## `NEXT_PUBLIC_` 규칙

- `NEXT_PUBLIC_`이 붙은 값은 빌드할 때 브라우저 코드에 그대로 박힌다. 비밀이 아니다
- 붙여도 되는 것: 백엔드 주소, Google Maps 키(Google Cloud 콘솔에서 HTTP 리퍼러 제한을 건 경우만)
- 그 외 키에는 붙이지 않는다

## 키가 필요한 외부 API

키가 필요한 외부 API는 Route Handler에서 부른다. 서버에서만 돌기 때문에 키가 브라우저로 나가지 않고,
브라우저에서는 같은 출처를 부르는 셈이라 CORS에도 걸리지 않는다(한국공항공사 API처럼 브라우저 호출이 막힌 것도 이 방식으로 부른다).
PoC 구성도의 "CORS 프록시(계획) — Cloudflare Workers / Vercel Function"이 바로 이것이다. Vercel에 배포하면 Route Handler가 Vercel Function으로 돈다.

```ts
// src/app/api/places/route.ts
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword") ?? "";

  const url = new URL("https://apis.data.go.kr/..."); // 부를 API의 고정 주소
  url.searchParams.set("serviceKey", process.env.DATA_GO_KR_KEY ?? "");
  url.searchParams.set("keyword", keyword);

  const res = await fetch(url);
  return Response.json(await res.json(), { status: res.status });
}
```

- API마다 Route Handler를 따로 만든다. 주소를 통째로 받아 대신 불러 주는 범용 프록시를 만들지 않는다.
  누구나 우리 서버를 거쳐 아무 주소나 부를 수 있게 된다
- 사용자가 보낸 값은 쿼리 파라미터로만 넘기고, 호출할 호스트와 경로는 코드에 고정한다

## 로그인 토큰

- 토큰은 localStorage에 저장된다(`src/lib/api/client.ts`). 페이지에 끼어든 스크립트가 읽을 수 있으므로
  `dangerouslySetInnerHTML`로 외부에서 받은 문자열을 넣지 않는다

## PoC의 키

- PoC 리포(`Tour-Navigator-App`)에는 키가 화면 파일에 박힌 채 공개돼 있다. 그 값을 이 리포로 복사하지 않는다
