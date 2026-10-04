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
- **설문 결과(테마 추천)는 `POST /api/v1/recommend`를 부르지 않는다.** 팀 명세서 integrated 6.5(2026-09-29) §01이 새 유형(C1~C10) 이름 · 점수를
  기존 recommendV4에 그대로 넘기지 않는다고 정했고, 이 API(recommendV4 계열)는 새 설문 6.4를 받지 못하며, data-server에는 설문 6.4 · 추천 6.5 API가 아직 없다.
  그래서 명세서의 참조 계산(순수 함수)을 프론트로 옮겨 네트워크 없이 계산한다(`features/recommend/survey.ts` · `theme-index.ts`, 규칙은 `docs/structure.md` 「추천과 데이터랩」).
  **data-server가 그 API를 내면 그 API를 부르도록 바꾼다**(그때는 위 원칙대로 받은 결과를 그대로 보인다)

## 외부 API (Route Handler)

백엔드가 아닌 외부 API는 브라우저가 직접 부르지 않고 우리 Route Handler(`src/app/api/**/route.ts`)가 대신 부른다(`AGENTS.md` 3번).

### 날씨 `GET /api/weather?lat=..&lng=..`

장소 시트(`components/ui/PlaceWeather`)의 날씨 칸(어제 · 오늘 · 내일). 코드는 `app/api/weather/route.ts`, 순수 함수는 `lib/weather.ts`.

`from` · `to`(YYYY-MM-DD, 어제 ~ 오늘 + 15일 안, from ≤ to)를 함께 주면 그 범위의 일별 예보를 돌려준다(2026-10-03, 코스 탭 일자별 날씨 경고 `features/planner/course-weather.ts`). 하나만 있거나 범위를 벗어나면 400. 캐시 규칙은 같다(주소에 날짜가 들어 범위마다 따로).

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
- 붙일 때는 키를 서버 환경변수로 읽는 별도 Route Handler로 만든다(`docs/security.md`). 미세먼지는 아래 `/api/air`로 붙였다

### 인기 관광지 `GET /api/tour/popular?city=&locale=`

홈 「지금 인기 관광지」(`features/home/PopularAttractions`). 코드는 `app/api/tour/popular/route.ts`, 처리는 `lib/tour-popular.ts`(서버 전용), 공통 타입은 `lib/tour.ts`.

서버에 키가 없거나 호출이 실패 · 비면 수기 목록을 보인다(2026-10-03): `features/home/popular-fallback.ts` · `data/popular-fallback.json`(`scripts/build-popular-fallback.mjs`가 `scripts/data/popular-manual.csv`로 만든다. 홈 칩 도시 8곳 × 10곳, 모두 플래너 장소 id라 장소 시트가 열린다. 근거는 한국관광 데이터랩 인기 관광지 2025-09~2026-08 순위(Data-Analytics `age_upgrade/data/raw`)와 집중률 상위 상례). 집중률 값이 없어 순위만 보이고, 머리에 「{날짜} 수기 조사 기준」 · 출처 줄에 「한국관광 데이터랩 … 수기 정리」를 적는다. 키가 있고 호출이 성공하면 실시간 목록이 우선이다.

- **원천**: 장소 시트 방문 집중률과 같은 한국관광공사 관광지 집중률 방문자 추이 예측 `TatsCnctrRateService/tatsCnctrRatedList`.
  관광지 이름(`tAtsNm`) 없이 `areaCd` · `signguCd`만 넣어 그 시군구 관광지 전체의 날짜별 집중률을 받는다(쪽당 1,000행, 시군구당 최대 5쪽).
  받은 행은 그 시군구 것(`signguCd`가 그 코드 또는 옛 · 새 코드: 강원 42 ↔ 51 · 전북 45 ↔ 52)만 남긴다 — 서비스가 시군구 조건을 무시하고 전국 결과를 주면
  다른 도시 관광지(제주 우도 등)가 강릉 · 속초 · 전주 목록에 섞였다(2026-09-29 대표 제보). 새 코드로 그 시군구 행이 없으면 옛 코드로 한 번 더 부르고,
  행의 코드는 앱 코드(새 법정동)로 맞춘다(`districtItems`, `lib/tour-api.ts` `signguVariants` · `inSigngu`). 장소 시트 방문 집중률도 같은 규칙이다
- **도시**: 칩 10곳(`POPULAR_CITIES`: 서울 · 부산 · 제주 · 경주 · 강릉 · 전주 · 인천 · 속초 · 대구 · 춘천. 대구 · 춘천은 2026-10-04 추가). 도시마다 플래너 장소(숙박 제외)가 많은 시군구 순으로 장소 5곳 이상인 곳 최대 4곳을 부른다(서울: 종로 · 송파 · 용산 · 마포, 부산: 해운대 · 기장 · 영도 · 부산진)
- **순위**: 기준 날짜(오늘, 없으면 오늘 이후 가장 이른 날)의 집중률이 높은 순 10곳. 수준(여유 · 보통 · 혼잡)은 장소 시트와 같은 40 · 70% 기준
- **장소 연결**: 세 단계로 잇고, 홈 목록은 이은 줄을 투어 플래너 지도의 장소 시트(`/planner?city=&place=`)로 연다
  1. **이름**: 같은 도시 · 같은 시군구 플래너 장소 중 이름 점수 2점 이상(`nameScore`). 장소 시트 방문 집중률의 규칙(괄호 · 공백 · 가운뎃점 무시, 같음 3 · 품음 2)에
     표기 차이를 맞춘 이름도 비교한다 — 앞의 도시 이름을 뗀 이름(「경주 대릉원」 = 「대릉원」), 같은 뜻 끝말(해수욕장 · 해안 → 해변, 전통시장 · 재래시장 → 시장).
     맞춘 이름으로 품는지 볼 때는 짧은 쪽이 3글자 이상이어야 한다
  2. **위치**: 이름으로 못 찾으면 국문 관광정보 `KorService2/searchKeyword2`(관광지 이름)에서 같은 시군구(법정동 `lDongRegnCd` + `lDongSignguCd`) ·
     이름 점수 2점 이상인 곳을 고르고(여행코스 · 숙박 제외, 관광지 · 문화시설 · 레포츠 · 쇼핑 먼저), 그 좌표 250m 안의 가장 가까운 같은 도시 플래너 장소(숙박 제외),
     없으면 1km 안에서 이름 글자쌍이 절반 이상 겹치는 곳(`matchByLocation`). 이름이 아주 다르게 적힌 같은 곳을 잇는다
  3. **신규 관광지**: 그래도 없으면 그 한국관광공사 관광지를 신규 관광지 `kto:<contentid>`로 만들어 `place`에 담는다(아래 「신규 관광지」).
     한국관광공사 검색에서도 못 찾거나 검색이 실패하면 한국관광공사 이름(한국어)을 글자로만 둔다
- 이름은 앱 장소면 화면 언어 이름, 신규 관광지 · 글자만인 곳은 집중률 서비스의 이름(한국어)이다
- **입력**: 도시(10곳 중 하나) · 화면 언어뿐. 틀리면 400. 키가 없으면 503, 모든 시군구 실패면 502, 결과가 없으면 `{ "empty": true }` — 홈은 키가 없으면 섹션째 숨긴다
- **응답**: `{ "date", "items": [{ "name", "district", "rate", "id", "place"? }] }`. `place`는 신규 관광지일 때만 있다.
  캐시 6시간(장소 시트 방문 집중률과 같다). 관광지 검색은 7일 캐시(이름이 맞은 곳은 부르지 않는다)

### 신규 관광지 `kto:<contentid>` · `GET /api/tour/spot?id=`

앱 장소 데이터(`places.json`)에 없는 한국관광공사 관광지. 홈 인기 관광지가 이름 · 위치로도 앱 장소를 못 찾을 때 만든다(`features/planner/kto-place.ts`).

- **장소 만들기**(`lib/tour-api.ts` `toKtoPlace`): 국문 관광정보 항목의 이름(`title`) · 좌표(`mapy` · `mapx`, 한국 범위만) · 대표 이미지(https) · 주소 ·
  개요(태그 제거). 시군구 코드는 법정동 코드(`lDongRegnCd` + `lDongSignguCd`, `signgu.json`과 같은 체계). 도시 · 권역은 같은 시군구 앱 장소가 가장 많이 속한 도시,
  없으면 가장 가까운 앱 장소의 도시(인기 관광지에서 만든 곳은 고른 칩 도시로 연다). 분류는 콘텐츠 타입 · 대분류(`cat1`) · 새 분류(`lclsSystm1`)로 정하고
  (문화시설 · 인문 → herit, 레포츠 · 쇼핑 · 축제 → activity, 음식 → food, 숙박 → stay, 자연 · 관광지는 이름에 바다 말이 있으면 sea 아니면 heal),
  권장 체류는 분류별 기본값(60분, 활동 90분), 운영시간은 비운다
- **서버**: 장소 id를 받는 칸(`/api/tour/audio` · `related` · `crowd` · `photo`)은 `parseTourQuery`가 `kto:` id를 국문 관광정보 공통정보 `KorService2/detailCommon2`로
  풀어 앱 장소와 같게 처리한다(7일 캐시, 키가 없거나 못 풀면 404). 대표 사진은 한국관광공사 대표 이미지를 바로 쓴다. 미세먼지(`/api/air`)는 좌표로 시도를 정하고,
  날씨는 좌표뿐이다. 장소 시트의 설명 · 사진 · 주소(`/api/planner/places/kto:…`)는 `lib/tour-spot.ts`가 공통정보에서 만든다 —
  개요 · 주소는 한국어뿐이라 외국어 화면(`view`)에는 보내지 않는다
- **`GET /api/tour/spot?id=kto:…`**: 브라우저가 기억해 두지 않은 신규 관광지를 링크로 열었을 때 장소 한 곳(앱 장소와 같은 필드 + `photo` · `addr`).
  틀린 id 400 · 키 없음 503 · 없음 404 · 외부 실패 502. 시군구 코드 · 개요는 보내지 않는다
- **브라우저**: 홈에서 신규 관광지 줄을 누르거나 링크로 받으면 localStorage `tn.extraPlaces`(최근 200곳, `features/planner/extra-places.ts`)에 장소를 기억한다.
  투어 플래너 지도 · 목록(도시는 `pickCity`, 권역은 `macro`) · 장소 시트 · 코스 담기 · 코스 탭이 앱 장소처럼 쓴다(`place-lookup.ts` `findAnyPlace` · `isKnownPlace`).
  코스는 id만 저장하므로 기억해 둔 장소가 없으면 코스에서 빠진다
- **외국어 이름**(`withForeignNames`): 영문 · 중문(간체) · 일문 · 스페인어 관광정보(`EngService2` · `ChsService2` · `JpnService2` · `SpnService2`)의
  `locationBasedList2`(반경 200m, 거리순)에서 좌표 50m 안 · 같은 콘텐츠 타입(국문 12 → 다국어 76 등) 중 가장 가까운 곳의 이름을 쓴다(7일 캐시).
  못 찾거나 실패한 언어는 건너뛴다 — 영어는 앱이 옮긴 로마자(`lib/romanize.ts`, `enByApp`), 중 · 일 · 스페인어는 영어 이름을 쓴다.
  외국어 화면에서 로마자 이름이면 장소 시트에 「앱이 번역했어요」. 다국어 서비스도 각각 공공데이터포털 활용신청이 필요하다(신청하지 않으면 로마자 이름)
- 홈 인기 관광지의 글자만인 곳(앱 장소 · 신규 관광지 모두 없음)은 외국어 화면에서 로마자로 적는다
- **한계**: 자동 코스 후보(`auto`)에는 넣지 않는다

### 인기 관광지 모으기 `GET /api/tour/popular/collect?source=&scope=&regions=&top=` (개발 서버 전용)

인기 관광지에서 앱 장소 목록에 없는 곳을 모아 투어 플래너 장소 데이터에 누적한다(`features/planner/data/added-places.json`, `docs/structure.md` 「추가 장소」).
코드는 `app/api/tour/popular/collect/route.ts`, 처리는 `lib/tour-collect.ts`, 파일에 합치는 것은 `scripts/add-popular-places.mjs`.

- **범위**: `scope=all`(기본)은 플래너 장소(숙박 제외)가 있는 시군구 전부(`signgu.json`, 211곳). 한 시군구가 두 도시에 걸치면(기장군: 부산 · 양산) 장소가 많은 도시에 붙인다.
  `scope=home`은 홈 칩 10개 도시를 홈과 같은 시군구 선택으로. `regions=서울,부산`으로 좁힐 수 있다
- **후보**: 홈 인기 관광지와 같은 집중률 행(`districtItems`)에서 지역마다 기준 날짜의 상위 `top`곳(기본 10, 0이면 전부)
- **판정**(홈의 세 단계와 같다. 풀은 그 도시 장소 + 그 시군구 코드의 장소): 이름 점수 2 이상이면 `existing-name`, 관광정보 검색 좌표 250m 안(또는 1km 안 이름 절반 겹침)이면 `existing-location`,
  이미 있는 추가 장소면 `existing-id`, 관광정보에 없으면 `missing`, 나머지가 `new`
- **추가 장소**: id `pop<contentid>`(브라우저가 기억하는 `kto:`와 다르다 — 데이터 파일에 들어가 모든 사용자에게 보인다). 필드는 신규 관광지(`toKtoPlace`)와 같고
  도시 · 도시 고르기 도시는 그 지역, 권역은 그 지역 장소의 권역, 외국어 이름은 `withForeignNames`. 설명은 관광정보 개요, 없으면 「○○ 인기 관광지 n위(날짜 집중률 기준)」.
  좌표 근거에 주소 · 집중률 · contentid를 적는다. Data-Analytics `tools/add_popular_places.py`와 같은 규칙 · 같은 id다
- **오디 해설 관광지**(`source=odii`): 인기 관광지 대신 관광지 오디오 가이드(오디) 한국어 관광지 목록(`Odii/themeBasedList`, 쪽당 1,000행 · 최대 5쪽)의 관광지 전부가 후보다(`collectOdii`).
  지역은 주소(addr1 시도 · addr2 시군구)로 정하고(`odiiRegion`: 광역시 · 특별시 · 세종은 그 이름, 제주 · 서귀포 → 제주, 그 밖은 시군구에서 시 · 군을 뗀 것, 강원 고성 → 고성(강원), 경기 광주 → 경기광주),
  장소 표에 없는 지역이면 30km 안 가장 가까운 장소의 지역, 그것도 없으면 `no-region`. 같은 지역 장소와 이름 → 위치로 잇고, 남는 곳은 국문 관광정보(같은 이름 · 1km 안)에서 찾으면 `pop<contentid>`와 그 분류,
  못 찾으면 `odii<tid>`와 이름 낱말 분류(`odiiRuleCategory`: 해변 · 섬 → sea, 시장 → food, 체험 · 파크 → activity, 사 · 궁 · 유적 · 박물관 → herit, 공원 · 숲 · 오름 → heal, 그 밖은 herit).
  출처에 「오디 tid」를 적는다. Data-Analytics `tools/add_odii_places.py`와 같은 규칙 · 같은 id
- **시티투어 경유지 관광지**(`source=citytour`, 2026-10-03): 시티투어 280노선의 경유지 중 앱 장소와 맞지 않는 곳(`cityTourStops`: 식사 · 역 · 터미널 · 안내소 등 `NOT_SIGHT`와 「박물관」 · 「2곳」 같은 일반 명사 `CITYTOUR_GENERIC`을 뺀 360곳 안팎,
  지역은 노선의 첫 여행지 `visits[0]`, 같은 지역 · 같은 이름은 노선 수로 모은다)이 후보다(`collectCityTour`). 여행지 도시들의 장소 풀(`visitPool`)에서 이름 → 국문 관광정보 검색(그 도시 시군구 코드와 맞는 결과만, 코드 없는 행은 둔다) → 위치 → `pop<contentid>` 추가 장소.
  출처에 「시티투어 경유지(n개 노선)」을 적고 설명은 관광정보 개요(없으면 「○○ 시티투어 경유지(n개 노선)」). 모은 뒤 `node scripts/build-citytour.mjs`를 다시 돌리면 노선의 `placeIds`가 새 장소까지 잇는다(대조 풀에 `added-places.json`을 넣는다).
  웹 검색 좌표는 믿기 어려워(동명 장소 · 요약 오류) 쓰지 않는다
  키가 없는 환경에서는 사람이 후보 표(`cityTourStops` 결과)를 보고 좌표 · 분류 · 설명을 적은 `scripts/data/citytour-manual-places.csv`를 `node scripts/add-manual-places.mjs`로 넣는다(2026-10-03, 시티투어 표 124행 중 기존 장소와 겹치는 27곳을 빼고 97곳 + 연관 관광지 표 67행 중 63곳 + 혼잡도 관광지 표 7곳 = 167곳, 그중 기존 장소와 같은 이름이던 5곳을 같은 장소 통합(`scripts/merge-same-places.mjs`)으로 빼서 162곳, + 사용자 요청 표 `scripts/data/user-manual-places.csv` 2곳(속초 설악해맞이공원 · 쇠머리오름(우도봉), 2026-10-04. 이중섭 문화거리 · 1100고지습지는 이미 있었다) = 164곳 `ctm<해시>`(`nearOk=1`은 이웃 장소라 250m 규칙을 넘긴다). 김포 · 부천 · 광명은 장소가 없던 도시라 `regions.json` 권역 목록으로 권역을 정한다). 좌표는 관광정보 값이 아니라 수기라 출처에 「좌표 수기 입력(지도 검증 필요)」을 적고, 시군구 경계 폴리곤 안에 드는지 확인한 뒤 넣었다. 뒤에 키 있는 수집기가 같은 곳을 만나면 이름 · 위치로 기존 장소로 본다
- **응답**: `{ "source", "scope", "targets": [{ "region", "codes" }], "candidates": [{ "region", "rank", "name", "district", "signgu", "rate", "date", "verdict", "id" }], "places": [추가 장소] }`.
  `source=odii`면 `{ "source", "candidates": [{ "tid", "name", "region", "regionBy", "verdict", "id" }], "places" }`, `source=citytour`면 `{ "source", "candidates": [{ "region", "name", "tours", "verdict", "id" }], "places" }`. 캐시 없음.
  관광공사 호출(집중률 · 관광정보 검색 · 오디 목록)도 모두 캐시 없이(`no-store`) 부른다: 홈 · 장소 시트의 fetch 캐시(집중률 6시간 · 관광정보 하루)를 같이 쓰면 개발 서버에 남은 하루 전 응답이 돌아와
  「기준 날짜 행 없음」으로 아무것도 모으지 못했다(2026-10-02 고침). `districtItems`는 `cache` 인자를 받는다(홈은 기본 6시간).
  배포(`NODE_ENV=production`)에서는 404 — 시군구 211곳 × 최대 5쪽을 부르므로 개발 서버에서 스크립트로만 쓴다. 키가 없으면 503, 실패하면 502
- **연관 관광지 전수 재조사**(`source=related`, 2026-10-03): 장소가 있는 시군구 전부(`allTargets`, `regions`로 좁힐 수 있다)마다 관광지별 연관 관광지 시군구 전체 목록(`TarRlteTarService1/areaBasedList1`, 기준월 2개월 전 → 비면 3 · 4개월 전, 쪽당 2,000행 · 최대 5쪽)을 받아
  「함께 많이 가는 관광지」로 나오는 모든 관광지(`rlteTatsNm`)를 시군구 코드 · 정규화 이름으로 모은다(`relatedStops`: 연계 수 · 최고 순위 · 기준 관광지 최대 3곳. 주차장 · 화장실 · 체인 브랜드는 장소 시트와 같이 뺀다).
  지역은 그 코드가 든 조회 대상 지역(없으면 관광정보 좌표에서 30km 안 가장 가까운 장소의 지역). 그 지역 장소 풀에서 이름 → 국문 관광정보 검색(같은 시군구 코드 결과만, 숙소는 숙박 타입도 받는다) → 위치 → `pop<contentid>` 추가 장소(숙박은 `stay`).
  관광정보에 없으면 좌표를 몰라 `missing`(후보 표에만). 출처에 「연관 관광지(연계 n회 · 기준 관광지)」, 설명은 관광정보 개요(없으면 「○○ 등과 함께 많이 찾는 곳 (연관 n회)」, 장소 표의 기존 연관 관광지 행과 같은 꼴). Data-Analytics `tools/add_related_places.py`와 같은 규칙 · 같은 id.
  시군구 211곳 × 최대 5쪽을 부르므로 오래 걸린다(`--regions`로 나눠 돌릴 수 있다). 응답 `{ "source", "months": { 시군구: 기준월 }, "candidates": [{ "region", "name", "signgu", "category", "stay", "links", "bestRank", "bases", "verdict", "id" }], "places" }`

### 축제 · 행사 `GET /api/tour/festival?city=&locale=`

플래너 여행 정보 탭 「{도시} 축제 · 행사」 칸(`features/planner/InfoFestivals`, 2026-10-03). 코드는 `app/api/tour/festival/route.ts`, 처리는 `lib/tour-festival.ts`.

- **입력**: `city`(플래너 도시 한국어 이름, 아니면 400) · `locale`(5개 언어, 기본 ko). 브라우저 주소는 `lib/tour.ts` `festivalPath`
- **호출**: 그 도시의 시군구(앱 장소 `signgu.json`, 장소 1곳 이상 전부)마다 법정동 코드(`lDongRegnCd` · `lDongSignguCd`)로 `searchFestival2`를 한 쪽(100행) 부른다.
  새 코드로 결과가 없으면 옛 코드(`signguVariants`)로 한 번 더. `eventStartDate`는 이달 1일(진행 중인 것까지 받으려고)
- **응답**: `{ "city", "items": [{ "id"(contentid), "title", "start", "end"(YYYY-MM-DD), "ongoing", "addr", "lat"?, "lng"?, "image"?(https), "tel"? }] }` 또는 `{ "empty": true }`.
  끝난 것(종료일 < 오늘, 서울 날짜)은 빼고 진행 중(시작일 ≤ 오늘)이 종료일 순으로 먼저, 예정은 시작일 순. 같은 contentid는 한 번, 최대 20건. 외국어 화면은 그 언어 서비스 결과만(한국어로 대신하지 않는다)
- **캐시** 6시간(`TOUR_FESTIVAL_SECONDS`). 키 없음 503 · 실패 502(화면은 빈 상태 문구). 서버에 키가 없으면 화면이 부르지 않는다(`TourApiProvider`)

### 대표 사진 `GET /api/tour/photo?id=`

장소 시트 맨 위 사진. 장소 자료(플래너 `place-details.json` · 테마 `extras.json`)에 사진이 없는 장소만 시트가 부른다. 코드는 `app/api/tour/photo/route.ts`,
처리는 `lib/tour-photo.ts`(서버 전용), 클라이언트가 쓰는 응답 타입은 `components/ui/place-photo.ts`.

- **순서**(PoC `loadPhoto`): ① 한국관광공사 국문 관광정보 `KorService2/searchKeyword2`의 대표 이미지(`firstimage`) — 제목이 이름과 같음 0 · 이름으로 끝남 1 · 이름으로 시작 2,
  같지 않으면 제목이 8글자 넘게 길면 제외, 거리 같은 이름 12km · 나머지 3km 이내, 숙박 · 쇼핑 · 코스 제외, 관광지 · 문화시설 · 레포츠가 음식점보다 먼저 →
  ② 관광사진 `PhotoGalleryService1/gallerySearchList1`(제목이 같거나 서로 품는 사진) → ③ 한국어 위키백과 요약의 대표 이미지(SVG 제외, 800px)
- **키**: ①②는 `DATA_GO_KR_KEY`(「한국관광공사_국문 관광정보 서비스_GW」 · 「한국관광공사_관광사진 정보_GW」 활용신청). 키가 없으면 ③만 본다(위키백과는 키가 없다)
- **응답**: `{ "src", "source": "kto" | "ktoGallery" | "wikipedia" }` · 못 찾으면 `{ "empty": true }`. 사진 주소는 https로 바꾼다.
  시트는 출처를 「사진: 한국관광공사」처럼 적는다(`PlaceSheet.photoSources`). 한 단계가 실패해도 다음 단계로 넘어간다
- **캐시**: 7일(대표 사진은 자주 바뀌지 않는다). 클라이언트는 하루
- **옮기지 않은 것**: PoC 제주 브랜드 콘텐츠 이미지(`api.brandcontents.or.kr`)는 HTTP 주소라 HTTPS 앱에서 브라우저가 막는다

### 미세먼지 `GET /api/air?lat=..&lng=..[&id=..]`

장소 시트 날씨 칸 아래의 「미세먼지 · 시도 평균」 줄(PoC 날씨 · 미세먼지 칸). 코드는 `app/api/air/route.ts`, 순수 함수는 `lib/air-quality.ts`.

- **원천**: 한국환경공단 에어코리아 대기오염정보 `B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty`
  (`returnType=json` · `numOfRows=200` · `ver=1.3` · `sidoName`). 키 `DATA_GO_KR_KEY`, 공공데이터포털에서 「한국환경공단_에어코리아_대기오염정보」 활용신청 필요
- **규칙**(PoC `shared.js` `getAirQuality`): 시도 모든 측정소의 PM10 · PM2.5 평균(빈 값 · 「-」 제외, 반올림) → 등급은 둘 중 나쁜 쪽
  (PM10 30 · 80 · 150, PM2.5 15 · 35 · 75 이하 → 좋음 · 보통 · 나쁨 · 매우나쁨). 측정소 하나를 고르지 않는다
- **시도 정하기**: `id`(플래너 장소 id)가 있으면 서버가 그 장소의 시군구 코드 앞 2자리로 정한다(광주 · 전남 통합 코드 12는 두 시도청 중 가까운 쪽).
  코드가 없으면 PoC처럼 가장 가까운 시도청(`SIDO_CENTERS` 17곳). PoC 방식만 쓰면 경주가 울산 값을 받아 코드를 먼저 본다
- **입력**: 좌표는 날씨와 같은 검사(한국 범위, 소수 2자리). 틀리면 400
- **응답**: `{ "sido", "pm10", "pm25", "grade": 1–4, "stations", "at" }`. 키가 없으면 503, 외부 실패 · 값 없음이면 502 — 화면은 줄을 숨긴다(PoC와 같다)
- **캐시**: 서버 fetch 30분(같은 시도의 장소가 한 번의 호출을 함께 쓴다), `Cache-Control` 30분, 클라이언트 `staleTime` 30분.
  서버에 키가 없으면(`TourApiProvider`) 부르지 않는다

### 공항 수속 소요 `GET /api/airport/process`

플래너 코스 탭 항공편 카드(`features/planner/FlightCard`)의 「○○공항 지금 수속 소요」. 코드는 `app/api/airport/process/route.ts`, 순수 함수는 `lib/airport-process.ts`.

- **원천**: 한국공항공사 공항 소요시간 `B551178/airport-process-time/v1`(`type=json`). 김포 · 제주 · 김해 · 청주 · 대구. 키 `DATA_GO_KR_KEY`, 「한국공항공사_공항 소요시간 정보」 활용신청 필요
- **규칙**(PoC `getAirportProcess` · `aptLeadMin`): `STY_TCT_AVG_ALL · A · B · C · D`(초) → 분(반올림). 탑승까지 잡을 시간 = 수속 + 20분, 최소 30분(안내 문장에만 쓰고 일정 계산은 바꾸지 않는다)
- **응답**: `{ "GMP": { "all", "a", "b", "c", "d", "at" }, … }`. 키가 없으면 503, 외부 실패면 502 — 카드는 그 칸만 숨긴다
- **캐시**: 5분(공사가 5분마다 갱신)
- **옮기지 않은 것**: PoC 실시간 운항 편성(`loadFlights`)은 PoC에서도 요청 주소(`KAC_ENDPOINT`)가 비어 꺼져 있다. 편성은 PoC 하드코딩 요약(`data/flights.json`)을 보인다

### 한국관광공사 칸 `GET /api/tour/audio` · `/api/tour/related` · `/api/tour/crowd`

장소 시트(`components/ui/PlaceTour`)의 날씨 칸 다음 세 칸(2026-09-29 팀 요청). 코드는 `app/api/tour/*/route.ts`,
처리는 `lib/tour-audio.ts` · `tour-related.ts` · `tour-crowd.ts`(vitest가 `@/` 경로를 풀지 못해 Route Handler는 이 함수를 부르기만 한다),
브라우저 주소는 `lib/tour.ts` `tourPath`가 만든다. 응답 모양이 바뀐 칸은 `v=<판>`을 붙여(`TOUR_PATH_VERSION`, audio 2) 브라우저 · CDN에 하루 캐시된 옛 응답을 피한다 — 모양을 바꾸면 판을 올린다.
공통(키 · 주소 · 응답 파싱 · 장소 찾기)은 `lib/tour-api.ts`, 화면과 함께 쓰는 타입 · 순수 함수는 `lib/tour.ts`.
규칙의 정본은 PoC 코드다: `Tour Planner.dc.html` `loadAudio` · `STORY_DB` · `getCrowd` · `crowdLvl`, `shared.js` `getRelatedSpots`.

| Route Handler                          | 칸                        | 부르는 공공 API (공공데이터포털, 한국관광공사 B551011)                                                                           | 키               | 캐시                                |
| -------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------- |
| `GET /api/tour/audio?id=&locale=`      | 오디오 가이드             | 관광지 오디오 가이드(오디) `Odii/storySearchList` · `themeBasedList` · `storyLocationBasedList`                                  | `DATA_GO_KR_KEY` | 1일(관광지 목록은 서버 메모리)      |
| `GET /api/tour/related?id=&locale=`    | 함께 많이 가는 관광지 Top | 관광지별 연관 관광지 `TarRlteTarService1/searchKeyword1` · `areaBasedList1`                                                      | `DATA_GO_KR_KEY` | 1일(`areaBasedList1`은 서버 메모리) |
| `GET /api/tour/crowd?id=`              | 방문 집중률 예측          | 관광지 집중률 방문자 추이 예측 `TatsCnctrRateService/tatsCnctrRatedList`                                                         | `DATA_GO_KR_KEY` | 6시간                               |
| `GET /api/tour/festival?city=&locale=` | 축제 · 행사(여행 정보 탭) | 관광정보 축제공연행사 조회 `KorService2/searchFestival2`(외국어는 `EngService2` · `ChsService2` · `JpnService2` · `SpnService2`) | `DATA_GO_KR_KEY` | 6시간                               |

- **키**: 서버 환경변수 `DATA_GO_KR_KEY`(공공데이터포털 디코딩 키, 세 API 모두 활용신청 필요, `docs/security.md`). 주소 · 응답 · 오류 문구 · 로그에 넣지 않는다
- **입력**: 장소 id(플래너 장소 id. 테마 장소도 같은 id)와 화면 언어뿐이다. 한국어 이름 · 좌표 · 시군구 코드는 서버가 장소 데이터에서 찾는다
  (아무 검색어나 대신 불러 주는 중계가 되지 않게). id가 없거나 언어가 5개 언어가 아니면 400, 모르는 id는 404
- **시군구 코드**: 연관 관광지 · 집중률은 `areaCd`(앞 2자리) · `signguCd`(법정동 5자리)를 받는다. PoC는 카카오 REST 좌표 → 행정구역으로 구하지만 우리에게는 REST 키가 없어,
  카카오 지도 JS SDK `services`의 `Geocoder.coord2RegionCode`로 장소마다 미리 구해 `features/planner/data/signgu.json`에 두었다(`scripts/build-signgu.mjs`, 모두 구함. 지금 3,211곳 = 빌드 3,049 + 추가 162).
  Route Handler만 읽는다(클라이언트 번들에 넣지 않는다, `lib/tour-api.test.ts`)
- **응답**
  - audio `{ title, script, audioUrl?, playTime?, source: "odii" | "story", others?: [...] }`: 좌표 ±0.12도 안 · 이름 겹침으로 관광지(`tid`)를 정하고, 그 `tid`의 해설 중 대표 하나를 앞에 두고
    나머지 해설(천왕문 · 다보탑 · 대웅전 같은 세부 해설, 오디 순서, 각 항목은 같은 모양에 `others` 없음)을 `others`에 담는다(2026-10-02). 화면은 대표와 나머지를 좌우로 넘기는 카드(`CardCarousel`, `docs/ui.md`)로 보인다(밑으로 늘리지 않는다, 2026-10-02). 음성 플레이어는 보이는 카드에만 붙인다(안 보이는 해설의 음성은 받지 않는다). 이야기 검색은 30건까지 받는다(관광지 하나의 세부 해설을 다 담게). 외국어 화면은 한글이 섞인 항목을 `others`에서도 뺀다.
    대표는 음성 파일(`audioUrl`)이 있는 해설 먼저, 그 안에서 제목이 기준 이름(한국어 화면은 장소 이름, 외국어 화면은 그 언어 관광지 제목)과 같은 것 → 품는 것 → 첫째.
    음성 있는 해설이 없으면 대본만 있는 해설에서 같은 기준(2026-09-29 팀 결정 — 이 칸은 「오디오 가이드」다). 음성 주소(https mp3)가 있으면 화면이 `<audio controls preload="none">`로 재생하고
    재생 시간(`playTime`, 초)을 보인다(PoC는 대본만 보였다). 한국어 화면은 오디 결과가 없으면(키 없음 · 외부 실패 포함) 한국관광공사 관광 스토리텔링 31곳
    (`features/planner/data/stories.json`, `scripts/build-stories.mjs`로 PoC `STORY_DB`에서 옮김)
  - 오디 언어 코드(2026-09-29 실제 호출로 확인, PoC와 다르다): 오디에는 ko · en · jp 자료만 있다(PoC의 `ja` · `ch`는 0건). 화면 언어 → 코드는 ko → ko, en → en, ja → jp, zh → en, es → en
  - 외국어 화면은 오디 관광지 번호 `tid`로 잇는다(`tid`는 언어가 달라도 같다, 해설 번호 `stid`는 다르다). 이름은 언어마다 달라서
    (우리 영어 이름 Hwangnidan-gil ↔ 오디 관광지 Hwanglidan-gil ↔ 오디 해설 Hwangnidan Street) 이름 검색이 자주 비었다
    1. 한국어 이름으로 ko 해설을 찾아(한국어 화면과 같은 기준: 좌표 ±0.12도 · 이름 겹침) `tid`를 얻는다. 같은 기준의 해설이 `tid`만 달리 여럿이면 차례로 본다.
       한국어 이름으로 고를 해설이 없으면 앞의 도시 이름(`locKo`)을 뗀 이름(「전주한옥마을」 → 「한옥마을」), 그다음 공백을 뺀 이름으로 찾는다(한국어 화면도 같다).
       공백을 뺀 이름은 이름에 공백이 있을 때만이고, 도시 이름을 뗀 이름에도 공백이 있으면 그것도 공백을 뺀다(「정동심곡 바다부채길」은 0건 · 「정동심곡바다부채길」은 2건, 2026-09-29 확인)
       (바람의 언덕: 1139 · 2880, 영어 해설은 2880에만)
    2. 그 언어 관광지 목록(`Odii/themeBasedList`, 1,000개씩 en 2쪽 · jp 2쪽)에서 `tid`의 제목을 찾는다. 목록은 서버 메모리에 하루 둔다(한 쪽 약 0.3MB, 서버 fetch 캐시에 넣지 않는다)
    3. 그 제목으로 그 언어 이야기 검색 → 같은 `tid`이고 좌표 ±0.12도 안인 해설 중 대표(음성 먼저 → 제목이 관광지 제목과 같은 것 → 품는 것 → 첫째).
       없으면 그 ko 해설 좌표 둘레 1km(`Odii/storyLocationBasedList`, 가까운 순)의 그 언어 해설에서 같은 `tid`(해설 제목이 관광지 제목과 다를 때 — 황리단길 · 바람의 언덕)
    4. 일본어는 jp → 없으면 en. `tid`를 알지만 그 언어들에 없으면 숨긴다. ko 해설이 없어 `tid`를 모를 때만 그 언어 이름(영어 이름 · 일본어 공식 명칭)으로 찾는다
  - related `{ month: "YYYYMM", items: [{ rank, name, category, region, placeId? }], stays: [{ name, category, region, placeId? }] }`: 검색어 후보 · 이름 점수 · 순위.
    검색어 후보는 전체 이름 → 첫 단어 → 정규화한 앞 3글자 → 앞의 도시 이름을 뗀 이름 → 공백을 뺀 이름(오디오와 같은 규칙)이고, 가장 최근 기준월(2개월 전)에서 후보를 모두 보고 없으면 그달 시군구 전체 목록에서 고른다.
    그달 목록이 있는데 이 장소가 없으면 데이터 없음으로 보고 이전 달로 넘어가지 않는다(목록이 비었을 때만 3 → 4개월 전, 데이터 없는 곳도 호출이 한 달치로 끝난다).
    주차장 · 화장실(PoC 화면)과 전국 체인 브랜드(맥도날드 · 스타벅스 · CGV · 편의점 등 `lib/franchise-brands.ts`, 팀장 의견 2026-09-29 — 「/」 앞 이름이 브랜드로 시작하면)는 순위를 매기기 전에 뺀다.
    마복림떡볶이 · 교리김밥/경주본점 같은 지역 가게와 백화점 · 면세점 · 시장은 남긴다.
    숙소는 순위 계산에서 빼고 따로 보낸다(2026-09-29 팀 답, 명세서 §20처럼 관광지 계산에서만 뺀다): 한국관광공사 대분류(`rlteCtgryLclsNm`)는 관광지 · 음식 · 숙박이고,
    `items`는 관광지 · 음식만 순위 순 8개(순위는 그 안에서 1부터 다시 매긴다), `stays`는 숙박만 원래 순위 순 3개(순위 번호 없이).
    화면은 순위 목록 아래 「함께 많이 찾는 숙소」로 보이고, 숙소가 없으면 그 부분을 그리지 않는다. `items`가 비면 결과 없음이다.
    같은 이름(정규화) · 같은 도시(시군구 코드 또는 시도 · 시군구 이름)인 우리 장소면 `placeId`를 달고, 화면은 그 화면에서 열 수 있는 장소(플래너: 지금 범위, 테마: 그 테마 장소)만 눌러 그 장소 시트로 바꾼다.
    외국어 화면은 이어진 항목만 그 언어 장소 이름(`placeName`) · 우리 분류 이름(`Course.categories`) · 우리 도시 이름으로 보낸다
  - crowd `{ name, days: [{ date: "YYYY-MM-DD", rate }] }`: 이름 점수로 한 곳, 오늘(한국 날짜)부터 날짜순(실제로 30일이 온다). 집중률은 소수(41.2)로 온다.
    검색어 후보는 이름 → (3글자보다 길면) 정규화한 앞 3글자 → 앞의 도시 이름을 뗀 이름 → 공백을 뺀 이름(오디오와 같은 규칙)이고, 앞 후보에서 한 곳을 고르면 멈춘다(전주한옥마을은 「한옥마을」로 「전북 전주 한옥마을 [슬로시티]」)
    화면은 7일을 가로 막대와 정수 %(반올림)와 수준 글자로 보이고, 수준은 받은 값 그대로 판정한다(70 이상 혼잡 · 40 이상 보통 · 그 아래 여유. 69.6은 「70%」 · 보통)
  - 결과 없음은 `{ empty: true }`. 외국어 화면에 한글이 섞인 값(대본 · 이름)은 보내지 않는다(`docs/i18n.md`)
- **실패**: 키 없음 503 `{ "message": "not configured" }`(한국어 오디오만 스토리텔링 또는 결과 없음 200). 시간 제한(8초) · HTTP 오류 · `resultCode`가 `0000` · `00`이 아님 · 모양이 다른 응답은
  502 `{ "message": "tour api unavailable" }`. 화면은 실패 · 키 없음 · 결과 없음이면 칸째 숨긴다(오류 문구 · 빈 상자를 남기지 않는다)
- **키가 없을 때**: 루트 레이아웃이 키가 있는지(참 · 거짓만)를 `TourApiProvider`(`components/ui/tour-api-context.tsx`)로 내려 주고, 없으면 장소 시트가 연관 관광지 · 집중률 · 외국어 오디오를
  부르지 않는다(503이 브라우저 콘솔 오류로 남지 않게). 한국어 화면의 오디오 가이드만 부른다(스토리텔링)
- **캐시**: 서버 fetch `next: { revalidate }`(오디오 · 연관 관광지 1일, 집중률 6시간), 응답 `Cache-Control: public, max-age=`(같은 간격), 클라이언트 TanStack Query `staleTime` 같은 간격.
  `areaBasedList1`(최대 2,000행, 경주 202607은 약 0.9MB)은 Next 데이터 캐시 한도(2MB)를 넘으면 경고에 키가 든 주소가 찍혀, 서버 fetch 캐시 대신 서버 메모리에 하루 둔다
  (시군구 · 기준월마다 한 번, 최근 20개). 키 없음 · 외부 실패 때 대신 보내는 스토리텔링은 `no-store`
- **출처 표기**: 칸 아래에 「한국관광공사 오디오 가이드(오디)」 · 「관광 스토리텔링 · 한국관광공사」 · 「한국관광공사 관광지별 연관 관광지 · 기준 {월}」 ·
  「한국관광공사 관광지 집중률 방문자 추이 예측」(5개 언어, `PlaceSheet.tour`). 집중률 칸에는 예측값이라는 안내를 둔다

## 인증

- 로그인하면 access token(30분)과 refresh token(14일)을 받는다. `saveTokens()`로 저장한다(localStorage)
- `api()`가 access token을 `Authorization: Bearer ...`로 붙인다. 로그인 · 회원가입 · 재발급 요청에는 `auth: false`를 준다
- 401이 오면 `api()`가 `/api/v1/auth/reissue`로 한 번 재발급하고 원래 요청을 다시 보낸다
- **refresh token은 한 번 쓰면 폐기된다.** 재발급을 따로 구현하지 않는다.
  같은 refresh token으로 두 번 요청하면 두 번째가 실패해 로그아웃된다. `api()`는 동시에 여러 401이 나도 재발급을 한 번만 보낸다
- 로그아웃은 `api("/api/v1/auth/logout", { method: "POST" })` 뒤에 `saveTokens(null)`

화면은 `features/auth`(`docs/structure.md` 「로그인 · 회원가입」)다. 오류는 `code`로 나눈다(`auth-error.ts`).

| 코드                    | HTTP | 언제                                               | 화면                                                                   |
| ----------------------- | ---- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| `AUTH_LOGIN_FAILED`     | 401  | 로그인: 이메일 · 비밀번호가 틀림                   | 「이메일 또는 비밀번호가 맞지 않아요」                                 |
| `USER_EMAIL_DUPLICATED` | 409  | 가입: 이미 가입한 이메일                           | 「이미 가입한 이메일이에요」 + 그 이메일을 채운 로그인 링크            |
| `INVALID_INPUT_VALUE`   | 400  | 가입: DTO 검사 실패                                | 「입력한 내용을 다시 확인해 주세요」                                   |
| `AUTH_TOKEN_INVALID`    | 401  | 내 정보 · 로그아웃: 토큰 없음 · 만료 · 틀림        | 내 정보는 재발급까지 실패하면 로그아웃 상태(null)로 보고 토큰을 지운다 |
| `USER_NOT_FOUND`        | 404  | 내 정보: 토큰 주인이 없음                          | ME 계정 카드 「계정 정보를 불러오지 못했어요」 + 다시 시도             |
| 그 밖                   | -    | 시간 초과(8초) · 네트워크 오류 · 5xx · 모르는 코드 | 「서버에 연결하지 못했어요…」. 같은 제출 버튼으로 다시 시도            |

- 2026-09-30 실제 응답: 틀린 로그인 401 `AUTH_LOGIN_FAILED`, 토큰 없는 내 정보 401 `AUTH_TOKEN_INVALID`, 형식이 틀린 가입 400 `INVALID_INPUT_VALUE`,
  가입 성공은 200이 아니라 **201 `API_CREATED`**다(`api()`는 2xx면 `data`를 돌려준다)
- **테스트 계정으로 로그인**: 로그인 버튼 아래. 브라우저는 백엔드가 아니라 이 앱의 `POST /api/auth/demo`를 부르고, 그 Route Handler가
  서버 환경변수(`DEMO_LOGIN_EMAIL` · `DEMO_LOGIN_PASSWORD`)로 백엔드에 로그인해 토큰만 돌려준다. 환경변수가 없으면 버튼이 숨는다(`docs/security.md`)
- **로그인**(`/login?next=`): 성공하면 토큰 저장 → `["users", "me"]` 무효화(다시 받기) → `next`로 `router.replace`. `next`는 앱 안 경로만 받고 아니면 `/me`(열린 리디렉트 막기, `next-path.ts`)
- **가입**(`/signup?next=`): 성공하면 같은 이메일 · 비밀번호로 로그인해 위와 같이 간다. 가입은 됐는데 자동 로그인이 실패하면 `/login?email=…&joined=1&next=…`(「가입했어요. 로그인해 주세요」)
- **ME 계정 카드 · 로그아웃**: `useMe()`는 토큰이 없으면 부르지 않고 null이다. 로그아웃은 서버 호출이 실패해도 `saveTokens(null)` → `setQueryData(["users", "me"], null)`

## 백엔드에 알려 줄 것

- **해결됨**: `GET /api/v1/tfi?region=…`가 502를 내던 문제(2026-09-27)는 2026-09-28 백엔드 수정으로 해결됐다(`?region=경주` 200 확인).
  프론트는 지금처럼 지역 없이 `/api/v1/tfi`를 한 번 불러 필요한 지역을 고른다
- TFI `themeLabels`는 한국어만 온다. TFI 테마 이름은 `messages`의 `Datalab.themes`로 옮겨 보인다

- 백엔드 CORS는 백엔드 환경변수 `CORS_ALLOWED_ORIGINS`에 적힌 주소만 허용한다.
  백엔드 `.env.example`의 기본값이 `http://localhost:5173`이라서 개발 서버를 5173번에서 띄운다(`npm run dev`).
  포트를 바꾸지 않는다. 배포 도메인은 정해지면 백엔드에 추가해 달라고 요청한다
- 백엔드를 로컬에서 띄우면 API 문서는 `http://localhost:8080/swagger-ui.html`이다 (JDK 21 · Docker 필요, 백엔드 README)
- Vercel 미리보기 배포는 주소가 매번 바뀐다. 정확한 주소만 받는 지금 설정으로는 미리보기에서 백엔드 호출이 막힌다
