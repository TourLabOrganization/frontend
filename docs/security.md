# 환경변수와 키

## 환경변수

- 로컬: `cp .env.example .env.local` 후 값을 채운다. `.env.local`은 커밋되지 않는다
- 배포: Vercel 프로젝트 설정의 Environment Variables에 넣는다
- 새 변수를 쓰면 `.env.example`에 이름과 설명을 함께 추가한다

## `NEXT_PUBLIC_` 규칙

- `NEXT_PUBLIC_`이 붙은 값은 빌드할 때 브라우저 코드에 그대로 박힌다. 비밀이 아니다
- 붙여도 되는 것: 백엔드 주소, 카카오 지도 JavaScript 키(`NEXT_PUBLIC_KAKAO_MAP_KEY`)
- 카카오 지도 키는 카카오 개발자 앱의 「JavaScript SDK 도메인」에 등록한 주소에서만 동작한다.
  지금 등록한 주소는 `http://localhost:5173`, `https://tour-navigator.vercel.app`이다.
  로컬은 `127.0.0.1`이 아니라 `localhost`로 연다. 배포 주소를 새로 쓰면 먼저 도메인을 등록한다
- 같은 카카오 앱의 REST API 키(`KAKAO_REST_KEY`)는 서버 전용이라 `NEXT_PUBLIC_`을 붙이지 않는다
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

### 공공데이터포털 키 `DATA_GO_KR_KEY`

- 서버 전용이다(`NEXT_PUBLIC_`을 붙이지 않는다). 공공데이터포털의 **디코딩** 키를 넣는다(주소에 넣을 때 코드가 인코딩한다)
- 장소 시트의 오디오 가이드 · 함께 많이 가는 관광지 Top · 방문 집중률 예측이 쓴다(`app/api/tour/*`, `docs/api.md`).
  공공데이터포털에서 한국관광공사 세 API(관광지 오디오 가이드정보 · 관광지별 연관 관광지 정보 · 관광지 집중률 방문자 추이 예측 정보)를 각각 활용신청해야 한다
- 같은 키로 장소 시트 날씨 칸의 미세먼지(`app/api/air`, 한국환경공단_에어코리아_대기오염정보)와 플래너 항공편 카드의 공항 수속 소요
  (`app/api/airport/process`, 한국공항공사_공항 소요시간 정보)도 부른다. 두 서비스도 각각 활용신청해야 하고, 신청하지 않으면 그 줄 · 칸만 숨는다.
  입력은 좌표(와 플래너 장소 id)뿐이고 서버가 17개 시도 중 하나를 정해 부른다 · 공항 소요시간은 입력이 없다
- 홈 인기 관광지(`app/api/tour/popular`)는 장소 시트 방문 집중률과 같은 서비스를 시군구 단위로 부른다. 입력은 정해진 도시 8곳과 화면 언어뿐이다
- 장소 대표 사진(`app/api/tour/photo`)도 같은 키로 한국관광공사 국문 관광정보 · 관광사진을 부른다(각각 활용신청). 입력은 장소 id뿐이다
- 키가 없으면 세 칸은 조용히 숨는다(한국어 화면의 스토리텔링 31곳만 보인다). 브라우저에는 키가 있는지(참 · 거짓)만 내려간다
- 키는 공공데이터포털 주소의 쿼리로만 보내고 응답 · 오류 문구 · 로그에 넣지 않는다. 입력은 장소 id뿐이라 아무 검색어나 대신 불러 주지 않는다

## 로그인 토큰

- 토큰은 localStorage에 저장된다(`src/lib/api/client.ts`). 페이지에 끼어든 스크립트가 읽을 수 있으므로
  `dangerouslySetInnerHTML`로 외부에서 받은 문자열을 넣지 않는다

## PoC의 키

- PoC 리포(`Tour-Navigator-App`)에는 키가 화면 파일에 박힌 채 공개돼 있다. 그 값을 이 리포로 복사하지 않는다
