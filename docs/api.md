# 백엔드 연동

백엔드는 `TourLabOrganization/backend`(Spring Boot 4)다.
API 목록은 백엔드의 `/swagger-ui.html`, 명세 JSON은 `/v3/api-docs`에 있다.

## 응답 규약

| 경우 | 본문                                                       |
| ---- | ---------------------------------------------------------- |
| 성공 | `{ "code": "API_SUCCESS", "message": "...", "data": ... }` |
| 실패 | `{ "code": "RESOURCE_NOT_FOUND", "message": "..." }`       |

`api()`는 성공이면 `data`만 돌려주고, 실패면 `ApiError`(`status`, `code`, `message`)를 던진다.

## 쓰는 법

```tsx
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError, saveTokens, type AuthTokens } from "@/lib/api/client";

type UserMeResponse = { id: number; email: string };

// 조회
const me = useQuery({
  queryKey: ["users", "me"],
  queryFn: () => api<UserMeResponse>("/api/v1/users/me"),
});

// 변경
const login = useMutation({
  mutationFn: (body: { email: string; password: string }) =>
    api<AuthTokens>("/api/v1/auth/login", {
      method: "POST",
      body,
      auth: false,
    }),
  onSuccess: (tokens) => saveTokens(tokens),
});

// 에러 분기는 code로 한다
if (
  login.error instanceof ApiError &&
  login.error.code === "AUTH_LOGIN_FAILED"
) {
  // ...
}
```

- 응답 타입 이름은 Swagger에 나온 DTO 이름을 그대로 쓴다
- `queryKey`는 URL 경로를 쪼갠 배열로 쓴다: `/api/v1/users/me` → `["users", "me"]`

## 공개 API는 서버 컴포넌트에서 부른다

로그인 없이 보는 공개 API(데이터랩 조회 등)는 서버 컴포넌트에서 `api()`로 바로 부른다.
서버끼리 부르므로 CORS와 무관하고(미리보기 배포에서도 동작), 화면이 로딩 없이 그려진다.
로그인 토큰이 필요한 호출은 토큰이 브라우저(localStorage)에 있으므로 클라이언트 컴포넌트에서 위의 TanStack Query 방식으로 부른다.

```tsx
// 서버 컴포넌트 · 서버 함수
import { api } from "@/lib/api/client";

const tfi = await api<TfiResponse>("/api/v1/tfi", {
  auth: false,
  signal: AbortSignal.timeout(8000), // 시간 제한
  next: { revalidate: 3600 }, // 자주 안 바뀌는 조회는 1시간 캐시
});
```

- **시간 제한**: 모든 호출에 `signal: AbortSignal.timeout(8000)`을 준다. `api()`는 `signal` · `next`를 `fetch`에 그대로 넘긴다
- **revalidate**: TFI · 체류시간 · 코스처럼 자주 안 바뀌는 조회는 `next: { revalidate: 3600 }`
- **실패 처리**: 시간 초과 · 네트워크 오류 · `ApiError`를 모두 잡아 화면에 실패 문구를 보인다. 페이지 전체를 에러로 만들지 않는다
  - 테마 여행 정보 탭: 데이터랩 블록 대신 「데이터랩 정보를 불러오지 못했어요」 한 줄. 받는 동안은 `Suspense`로 자리 잡힌 스켈레톤을 두고 탭의 나머지를 먼저 보낸다
- **응답 모양 검사**: fetch 함수가 화면이 쓰는 필드(배열 · 객체)를 검사해 모양이 틀리면 실패로 돌려준다(`parseTfi` · `parseStayTime` · `parseCourseList`).
  없어도 되는 필드(`themeLabels` 등)는 빈 값으로 채운다. 데이터랩 블록은 가공(코스 찾기 · 지역 고르기)까지 실패 처리 안에서 한다
- **안전망**: 그래도 새는 오류는 `app/error.tsx`(짧은 문구 + 「다시 시도」 `retry` + 홈으로)가 받는다
- **DTO 타입**: Swagger DTO 이름 그대로 쓰고, 필드 주석은 `/v3/api-docs`의 description을 옮긴다

| 호출                   | 쓰는 곳                               | 타입                                          | 코드                 |
| ---------------------- | ------------------------------------- | --------------------------------------------- | -------------------- |
| `GET /api/v1/tfi`      | 테마 여행 정보 탭                     | `TfiResponse`                                 | `lib/api/datalab.ts` |
| `GET /api/v1/staytime` | 테마 여행 정보 탭                     | `StayTimeResponse` · `StayTimeRegionResponse` | `lib/api/datalab.ts` |
| `GET /api/v1/courses`  | 테마 여행 정보 탭(코스가 지나는 지역) | `CourseListResponse` · `CourseResponse`       | `lib/api/datalab.ts` |

- 추천 점수 · 일정 계산은 data-server가 정본이다. 백엔드가 중계하는 결과는 프론트에서 다시 계산하지 않고 그대로 보인다.
  백엔드 결과가 이상하면 프론트에서 고치지 않고 백엔드에 알린다
- **설문 결과(테마 추천)는 `POST /api/v1/recommend`를 부르지 않는다.** 팀 명세서 integrated 6.2(2026-09-28) §01이 새 유형(C1~C10) 이름 · 점수를
  기존 recommendV4에 그대로 넘기지 않는다고 정했고, 이 API(recommendV4 계열)는 새 설문 6.1을 받지 못하며, data-server에는 6.2 API가 아직 없다.
  그래서 명세서의 참조 계산(순수 함수)을 프론트로 옮겨 네트워크 없이 계산한다(`features/recommend/survey.ts` · `theme-index.ts`, 규칙은 `docs/structure.md` 「추천과 데이터랩」).
  **data-server가 6.2 API를 내면 그 API를 부르도록 바꾼다**(그때는 위 원칙대로 받은 결과를 그대로 보인다)

## 외부 API (Route Handler)

백엔드가 아닌 외부 API는 브라우저가 직접 부르지 않고 우리 Route Handler(`src/app/api/**/route.ts`)가 대신 부른다(`AGENTS.md` 3번).

### 날씨 `GET /api/weather?lat=..&lng=..`

장소 시트(`components/ui/PlaceWeather`)의 날씨 칸(어제 · 오늘 · 내일). 코드는 `app/api/weather/route.ts`, 순수 함수는 `lib/weather.ts`.

- **원천**: Open-Meteo `https://api.open-meteo.com/v1/forecast` (키 없음). PoC `shared.js` `_openMeteo`와 같은 값:
  `daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code`, `timezone=Asia/Seoul`.
  기간은 PoC의 `past_days=1` · `forecast_days=3` 대신 한국 날짜(`Intl.DateTimeFormat` `timeZone: "Asia/Seoul"`) 어제 ~ 내일을 `start_date` · `end_date`로 적는다.
  주소가 날마다 달라져 서버 캐시가 전날 응답을 오늘로 돌려주지 않는다
- **입력**: `lat` · `lng` 숫자, 한국 범위(위도 33–39 · 경도 124–132, `KOREA_BOUNDS`)만. 빠졌거나 틀리거나 범위 밖이면 400 `{ "message": "invalid lat/lng" }`.
  플래너 · 테마 장소 좌표가 모두 이 범위 안인지는 `lib/weather.test.ts`가 확인한다.
  좌표는 소수 2자리(약 1km)로 반올림해 같은 동네를 같은 캐시로 묶는다(브라우저도 반올림한 주소로 부른다)
- **응답**: `{ "days": [{ "date", "max", "min", "rain", "code" }] }` — 어제 · 오늘 · 내일 3일(더 오면 넷째 날부터 버린다).
  화면은 순번이 아니라 `date`로 한국 날짜 기준 어제 · 오늘 · 내일 칸을 고르고(`pickWeatherDays`), 없는 칸은 「–」다.
  `date` 한국 날짜 `YYYY-MM-DD`, `max` · `min` 최고 · 최저 기온 °C(없으면 `null`), `rain` 강수량 mm(없으면 0), `code` WMO 날씨 코드(없으면 `null`).
  화면은 최저 기온을 보이지 않는다(PoC와 같다)
- **실패**: 시간 제한(`AbortSignal.timeout(8000)`) · Open-Meteo 오류 · 모양이 다른 응답이면 502 `{ "message": "weather unavailable" }`.
  화면은 「날씨를 불러오지 못했어요」와 「다시 시도」
- **캐시**: 서버 fetch `next: { revalidate: 1800 }`(일별 예보는 몇 시간마다 바뀌므로 30분), 응답 `Cache-Control: public, max-age=1800`,
  클라이언트 TanStack Query `staleTime` 30분(`["weather", lat, lng]`). 시트가 열려 날씨 칸이 그려질 때만 부른다
- **출처 표기**: Open-Meteo 데이터는 CC BY 4.0이다. 날씨 칸 머리에 「날씨: Open-Meteo」를 https://open-meteo.com/ 새 창 링크로 둔다
- **날씨 코드 → 아이콘**: Open-Meteo 문서의 WMO 코드 표대로 묶는다(`weatherKind`) — 맑음 0 · 구름 1–3 · 안개 45 · 48 · 이슬비 51–57 · 비 61–67 ·
  눈 71–77 · 소나기 80–82 · 눈 소나기 85–86 · 뇌우 95–99, 그 밖은 「날씨 정보 없음」. 아이콘은 lucide, 화면 읽기용 이름은 `PlaceSheet.weather.kinds`

**키가 필요해 미룬 것** (PoC는 공공데이터포털 키 `DATA_GO_KR_KEY`로 부른다)

- 기상청 단기예보: PoC는 키가 있으면 오늘 · 내일을 기상청 값으로 덮어쓴다(`getKmaForecast`, 위경도 → 예보 격자 변환 포함)
- 에어코리아 미세먼지: PoC 날씨 칸 아래의 대기질 줄. 그래서 제목은 PoC의 「날씨 · 미세먼지」가 아니라 「날씨」다
- 붙일 때는 키를 서버 환경변수로 읽는 별도 Route Handler로 만든다(`docs/security.md`)

## 인증

- 로그인하면 access token(30분)과 refresh token(14일)을 받는다. `saveTokens()`로 저장한다(localStorage)
- `api()`가 access token을 `Authorization: Bearer ...`로 붙인다. 로그인 · 회원가입 · 재발급 요청에는 `auth: false`를 준다
- 401이 오면 `api()`가 `/api/v1/auth/reissue`로 한 번 재발급하고 원래 요청을 다시 보낸다
- **refresh token은 한 번 쓰면 폐기된다.** 재발급을 따로 구현하지 않는다.
  같은 refresh token으로 두 번 요청하면 두 번째가 실패해 로그아웃된다. `api()`는 동시에 여러 401이 나도 재발급을 한 번만 보낸다
- 로그아웃은 `api("/api/v1/auth/logout", { method: "POST" })` 뒤에 `saveTokens(null)`

## 백엔드에 알려 줄 것

- **해결됨**: `GET /api/v1/tfi?region=…`가 502를 내던 문제(2026-09-27)는 2026-09-28 백엔드 수정으로 해결됐다(`?region=경주` 200 확인).
  프론트는 지금처럼 지역 없이 `/api/v1/tfi`를 한 번 불러 필요한 지역을 고른다
- TFI `themeLabels`는 한국어만 온다. TFI 테마 이름은 `messages`의 `Datalab.themes`로 옮겨 보인다

- 백엔드 CORS는 백엔드 환경변수 `CORS_ALLOWED_ORIGINS`에 적힌 주소만 허용한다.
  백엔드 `.env.example`의 기본값이 `http://localhost:5173`이라서 개발 서버를 5173번에서 띄운다(`npm run dev`).
  포트를 바꾸지 않는다. 배포 도메인은 정해지면 백엔드에 추가해 달라고 요청한다
- 백엔드를 로컬에서 띄우면 API 문서는 `http://localhost:8080/swagger-ui.html`이다 (JDK 21 · Docker 필요, 백엔드 README)
- Vercel 미리보기 배포는 주소가 매번 바뀐다. 정확한 주소만 받는 지금 설정으로는 미리보기에서 백엔드 호출이 막힌다
