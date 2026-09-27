# 구조와 이름

## 폴더

```
src/
  app/                  라우트. 폴더 경로가 곧 URL
    layout.tsx          전역 레이아웃 (폰트 · Provider)
    providers.tsx       클라이언트 Provider (TanStack Query)
    api/**/route.ts     Route Handler. 키가 필요한 외부 API를 대신 부른다
  components/           여러 기능이 함께 쓰는 컴포넌트
  features/<기능>/      한 기능에서만 쓰는 컴포넌트 · 훅 · 타입 · 데이터 (예: features/recommend, features/course, features/theme, features/planner, features/home, features/me)
  lib/                  화면과 무관한 코드 (api 클라이언트, 데이터랩 조회 api/datalab.ts, 여러 기능이 쓰는 localStorage 값 local-store.ts, 유틸)
  i18n/                 다국어 설정
messages/               화면 문구 (ko.json · en.json)
scripts/                데이터 생성 스크립트 (원천 파일 경로를 인자로 받는다)
public/                 정적 파일
```

- 새 코드는 `features/<기능>/`에서 시작한다
- 두 번째 기능이 실제로 import하게 되면 그때 `components/`나 `lib/`로 올린다.
  미리 올려 두지 않는다

## 화면 경로

| 경로                | 화면                                                                           | 코드                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `/`                 | 홈(첫 방문 로고 시작 화면 · 배너 · 지역 시티투어 · 나의 테마 · 지금 인기 코스) | `app/page.tsx`, `features/home`                                                                             |
| `/recommend`        | 테마 추천 15문항                                                               | `app/recommend/page.tsx`, `features/recommend`                                                              |
| `/recommend/result` | 추천 결과(테마 순위는 백엔드 추천 API)                                         | `app/recommend/result/page.tsx`, `features/recommend/api.ts`, `lib/api/datalab.ts`                          |
| `/themes/[themeId]` | 테마 화면. 하단 탭 5개(지도 · 코스 · 영화 · 스탬프 · 여행 정보)                | `app/themes/[themeId]/page.tsx`, `features/theme`, `features/course`, `features/planner/regions`(도시 이름) |
| `/planner`          | 투어 플래너. 지역 탭 + 하단 탭 3개(지도 · 코스 · 여행 정보)                    | `app/planner/page.tsx`, `features/planner`                                                                  |
| `/me`               | ME(나의 여행자 유형 · 저장된 플랜)                                             | `app/me/page.tsx`, `features/me`, `features/planner`(저장한 코스 설정 · 도시 이름 · 일수)                   |

### 테마 화면 주소 (`/themes/[themeId]`)

| 쿼리    | 값                                           | 쓰임                                                              |
| ------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `tab`   | `map` · `course` · `film` · `stamp` · `info` | 고른 탭. 없거나 모르는 값이면 `map`                               |
| `a`     | 추천 답(Q10~Q14, `encodeAnswers`)            | 코스 탭의 조건. 코스 탭의 일정 · 이동수단 칸이 q11 · q12만 바꾼다 |
| `plan`  | `classic` · `trend` · `quiet`                | 코스 3안                                                          |
| `place` | 장소 id                                      | 지도 탭에서 그 장소 시트를 연 채로 시작                           |

- 탭을 바꿔도 `a` · `plan`은 주소에 남긴다. 주소는 `features/theme/tabs.ts`의 `themeHref`로 만든다
- 영화 탭의 장면 카드는 `id`가 장면 id라 `?tab=film#{장면 id}`로 바로 간다
- 지도 탭: 지역 줄(RESCENE는 전국 · 거제 · 경주 칩, 한 도시 테마는 도시 이름 · 장소 수), 목록 접기. 목록 행의 거리는 도시 center(PoC `DATA.<도시>.center`)에서 직선거리이고, 여러 도시 보기(RESCENE 전국)는 거리 대신 도시 이름이다(목업 규칙, `features/theme/place-list.ts`). 장면이 있는 행은 영화(영상) 탭 바로가기
- RESCENE는 하단 탭 이름이 영상 · 팬소통이고, 영상 정렬은 인기순(PoC에 적힌 조회수) · 최신순이다
- 추천 결과 · ME 저장된 플랜 · 홈 추천 코스는 `tab=course`로, 홈 포스터 타일 · 배너는 기본(지도)으로 들어온다

### 투어 플래너 주소 (`/planner`)

| 쿼리     | 값                         | 쓰임                                                                                               |
| -------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `city`   | 도시 한국어 이름(`경주`)   | 도시 보기. 없거나 장소가 없는 도시면 전국 보기                                                     |
| `plan`   | 저장된 플래너 플랜 id      | 코스 탭에서 그 플랜을 코스로 불러온다(담은 코스가 있고 다르면 먼저 묻는다). 불러오면 주소에서 뗀다 |
| `region` | 권역 key(`capital` 등 7개) | 전국 보기에서 고른 권역. 지도는 그 권역에 맞추고 목록을 거른다. `city`가 있으면 무시               |
| `tab`    | `map` · `course` · `info`  | 고른 탭. 없거나 모르는 값이면 `map`                                                                |
| `place`  | 장소 id                    | 지도 탭에서 그 장소 시트를 연 채로 시작                                                            |

- 주소는 `features/planner/query.ts`의 `plannerHref` · `scopeHref`로 만든다. 기본값(전국 · `map`)은 주소에 적지 않는다
- 지역 탭 · 도시 고르기는 탭을 남기고 범위만 바꾸고, 하단 탭은 범위를 남기고 탭만 바꾼다
- 권역 key와 도시 목록은 `features/planner/data/regions.json`(PoC `REG` + `MACRO_OF`)에 있다. 권역 이름은 목업 지도가 그리는 `MACRO_REGION` 이름(경북권 · 경남권 · 전라권 …)이다
- 도시별 장소 수(`placeCounts`, `pickCity` 기준)도 `regions.json`에 있다(빌드 스크립트가 센다). 도시 고르기 · 여행 정보 탭 도시 선택은 이 값(`regions.ts` `PLACE_COUNT_BY_CITY` · `CITY_GROUPS`)을 쓰고
  `data.ts`(places.json)를 import하지 않는다. 여행 정보 탭 클라이언트 컴포넌트가 places.json에 닿지 않는지는 `planner/info-bundle.test.ts`가 확인한다
- 지도 탭은 분류 칩과 배지 칩(유네스코 · 한국관광 100선 · 열린관광지 · 관광특구, `features/planner/badges.ts`)을 AND로 거른다. 배지 칩은 한 번에 하나, 다시 누르면 꺼진다
- 도시 보기(`city`)는 장소의 `pickCity`(도시 고르기에서 속한 도시)로 거른다. 전용 화면이 있는 도시(서울 · 부산 · 제주 · 영월 · 경주 · 거제)는
  그 화면 장소만 보이고, 같은 도시의 전국 목록 장소는 전국 · 권역 보기에만 들어간다(PoC `cityRows` 규칙, `scripts/build-planner.mjs`)
- 코스에 담은 장소와 코스 설정(플랜 이름 · 출발일 · 귀가일 · 출발지 · 귀가지 · 출발 시각 · 여행지 출발 시각 · 광역 교통 · 현지 이동 ·
  고른 광역 경로 · 환승 관문 · 지하철 호선과 역 · 제주도민 여부 `jejuResident`)은 주소가 아니라 localStorage `tn.planner.course`에 둔다(`features/planner/course-store.ts`).
  없는 필드는 기본값(오늘 · 당일 · 서울역 · 귀가지 = 출발지 · 08:00 · 19:00 · 고른 경로 · 관문 · 역 없음).
  장소별로 바꾼 체류 분(`stayOv`, PoC `stayOv`)과 덮어쓰기 대상 플랜 id(`planId`, PoC `planId`), 경로 선택 창을 닫은 도착 도시(`routeSkip`),
  배편 시간표 카드에서 고른 출발 항구(`ferryPort`, 섬별), 울릉 안내 창이 열려 있는지(`ulNotice`)도 같은 값에 둔다.
  저장된 플랜의 `settings`에는 `routeSkip` · `ferryPort` · `ulNotice`를 뺀 설정이 들어간다(PoC 플랜 필드와 같다. `jejuResident`는 PoC 플랜 필드에 없지만 일정이 달라져 넣는다).
  날짜는 PoC `planSave`처럼 고른 그대로 저장한다(고르지 않았으면 `null`이라 불러오는 날의 오늘 · 당일로 계산된다). 「저장됨」 비교도 같은 값으로 한다(`planContentKey`).
  예전 플랜은 없는 필드를 기본값으로 읽는다(`jejuResident` 없음 = 아직 답하지 않음)
- 날짜는 달력에서 출발일 → 귀가일 순으로 누른다(PoC `calendarDays` pick, `features/planner/calendar.ts`). 귀가일을 고르는 중(`endDate` 없음)에는 당일로 계산하고,
  `MAX_TRIP_DAYS`를 넘는 날은 고를 수 없다(PoC에는 상한이 없다)
- 체류 시간은 담은 장소 행에서 15분씩 바꾼다(15~600분, 추천값과 같으면 덮어쓰기를 지운다, PoC `setStay`). 일정 계산은 장소의 `min` 대신 이 값을 받을 뿐 식은 그대로다(`course-edit.ts`)
- 일자별 일정의 「장소 추가」는 그 날 마지막 장소 뒤에 끼워 넣는다(PoC `addCourseAt`, 빈 날은 맨 뒤). 날짜 나누기가 다시 계산되므로 그 날이 꽉 차면 다음 날로 밀린다.
  검색은 그 날 도시(첫 장소 도시, 없으면 앞뒤 날)의 장소만이다. PoC는 맞는 장소가 없으면 전국에서 찾지만 한 코스는 한 도시라 넓히지 않는다
- 일자별 일정의 구간마다 수단 · 시간 · 거리(`legInfo` km, 요약 총 거리와 같은 값)를 붙이고, 첫날 위 · 마지막 날 아래에 광역 체인(아래)과 본 구간 수단 예매 링크(`data/booking.ts` `wideBookingLink`)를 둔다
- 한 코스는 한 도시(`locKo`)의 장소만 담는다. 권역에서 불러온 추천 코스만 여러 도시가 섞일 수 있다
- 숙박 장소(`cat === "stay"`)는 코스에 담겨도 일정 계산 입력에서 빠지고 그날 밤 숙소로만 쓴다(PoC `courseList` · `courseStays`, `features/planner/stays.ts`).
  요약 · 「넣지 못한 장소」 · 일자별 시각에 들어가지 않는다. 「담은 장소」에는 번호 대신 숙소 표시와 「숙소로 지정됨」으로 남고, 코스 탭 배지는 PoC처럼 담은 장소 전체를 센다.
  추천 코스를 불러와도 지정한 숙박 장소(추천 코스와 같은 도시)는 뒤에 남는다(PoC `_keepStay`). 장소 시트의 코스 버튼은 「코스 숙소로 지정」 ↔ 「숙소 지정 해제」
- 마지막 날을 뺀 날마다 「숙박」 카드(PoC `dayPlan` 숙소 부분). 기준점 = 그날 마지막 경유지(비면 다음 날 첫 · 이전 날 마지막 경유지).
  반경 **25km**(PoC 값) 안에서 ① 코스에 담은 숙박 장소 중 가장 가까운 곳(「직접 지정」) ② 숙소 표본 중 가장 가까운 곳(「예시」) ③ 없으면 「숙소 A · B …」 + 「{기준점} 근처 · 숙소 미지정」.
  기준점이 없으면(경유지 없음) 담은 숙박 장소를 날짜 순서로 쓰고, 그것도 없으면 카드를 두지 않는다(PoC는 전국 표본을 돌려 쓰지만 도시와 무관한 숙소가 나와 옮기지 않았다)
- 「주변 숙소」: 기준점 25km 안의 우리 숙박 장소(같은 도시, 가까운 순 4곳, 누르면 그날 밤 숙소로 지정 · 해제하고 같은 기준점 25km 안의 다른 숙박 장소는 뺀다)와
  숙소 표본(우리 장소가 있으면 2곳 · 없으면 4곳, 누르면 한국어는 네이버 지도 · 그 밖은 Google 지도 검색 새 창)
- 숙박 예약(날짜별 · 코스 전체, PoC `stayBookings` · `coursePanelBookings`, `data/booking.ts`): Booking · Agoda · Airbnb · 야놀자 · 여기어때 · Trip.com.
  날짜별은 체크인 그날 · 체크아웃 다음 날, 검색어는 숙소 검색어(`stayQuery`, 미지정이면 기준점 이름). 코스 전체는 출발일(없으면 오늘) ~ 귀가일(같으면 다음 날), 검색어는 일정 첫 경유지(없으면 도시).
  날짜는 로컬 날짜로 만든다(`addLocalDays`, `toISOString`은 한국 시간에서 하루 밀린다)
- 숙소 표본 `features/planner/data/stays.json`은 PoC `STAYS`(「임의 구성 — 실제 예약 정보 아님」, 153곳)다. PoC의 가격대(`band`)는 임의로 만든 숫자라
  옮기지 않고 화면에도 가격을 보이지 않는다. 표본에는 「예시」와 안내 한 줄을 둔다. 중 · 일 · 스페인어는 영어 값을 쓴다
- 코스 탭의 일정 · 요약은 `features/planner/schedule.ts`의 `buildPlannerSchedule`이 계산하고 화면은 그 결과만 그린다.
  날짜 나누기는 테마 코스와 같은 `course/scenarios.ts`의 `splitDays`, 출발지는 `data/regions.json`의 `origins`(PoC `ORIGINS` 61곳)

#### 광역 체인 (`features/planner/wide-chain.ts` · `schedule.ts` · `metro.ts`)

PoC `Tour Planner.dc.html`의 광역 체인 규칙을 그대로 옮겼다(식 · 숫자는 코드 주석과 `wide-chain.test.ts`의 손계산 대조).

- **광역 교통 먼저**: 01 광역 교통 → 출발지 · 귀가지 · 시각 → 02 현지 이동 순서. 출발지 · 귀가지 목록은 고른 수단의 관문만(PoC `WIDE_ALLOW` · `wideOriginFilter`,
  맞는 곳이 없으면 전체), 도착 관문이 받는 수단의 출발지만, 기차역 → 버스터미널 → 공항 → 항만 순(`originOptions`). 버스가 아니면 리무진 공항 항목은 뺀다(`airTwin`).
  지금 값이 목록에 없으면(예전 설정) 맨 앞에 더해 보인다
- 출발지를 고르면 그 관문 종류로 광역 교통이 정해진다(`gwWideOf`: 공항 = 항공, 항만 = 배, 역 = 기차, 터미널 = 버스, 섞인 관문은 그대로).
  광역 교통을 바꿨는데 출발지가 맞지 않으면 그 수단의 첫 관문으로, 귀가지가 맞지 않으면 「출발지와 동일」로(`fixOriginsForWide`)
- 광역 교통 칸은 도착 관문에 없는 버스 · 기차 · 항공 · 배, 섬의 자가용(제주 제외, 아래 섬 여행)을 막는다. 지하철은 출발 · 귀가역을 고르는 칸이라 막지 않지만,
  도착 관문에 육로 수단이 없는 섬(울릉)이면 자가용처럼 막는다(「서울역 → 목포연안여객터미널 → 도동항」 같은 경로가 나오지 않게). 제주는 항공 · 배 · 자가용 3칸 그대로
- **지하철**: 광역 교통이 지하철이면 출발지 · 귀가지를 호선 → 역명으로 고른다(귀가역 기본 「출발역과 동일」). 도착 도시가 전철권(`METRO_CITY`)이면 「출발 전철역」 하나를 고른다.
  역은 `data/wide.json`(PoC `METRO_STATIONS` 262역 · `BUSAN_STATIONS` 46역). 호선 이름은 PoC `metroLineLabel` · `BUSAN_LINE_LABEL`(부산 호선의 중 · 일 · 스페인어는 영어)
- **체인**(`wideChain`): 출발점 → (전철 접근 15 + km × 1.2) → 출발 관문 → 본 구간(KTX · SRT 18 + km × 0.30, 버스 20 + km × 0.68, 항공 90 + km × 0.11, 배 60 + km × 0.85,
  광역전철 12 + km × 0.95, km = 직선 × 1.35) → 도착 관문(항공 · 배 · 버스면 그 좌표). 자가용은 관문 없이 한 구간.
  시각표(`chainSchedule`)는 본 구간 앞 환승 = (도착 + 15분)을 10분 단위 올림(공항 · 항만은 없음), 본 구간 뒤 접근 구간은 10분 뒤
- **첫날**: 첫 일정 시작 = 출발 시각 + 체인 소요 + 도착 관문 → 첫 장소(`firstLeg`, 현지 이동 수단). **마지막 날**: 마지막 장소 → 귀가 관문(`lastLeg`)을 빼고
  여행지 출발 시각 안에 끝난다. 공용 식(`course/schedule.ts` · `scenarios.ts`)은 그대로 두고 넘기는 여행지 출발 시각을 `lastLeg`만큼 당긴다(창 · 날짜 나누기 모두).
  추천 코스는 PoC처럼 체인 + 30분으로 창을 잰 뒤 실제 창에 들어가는 만큼만 담는다
- **일자별 카드**: 1일차 위 가는 길 체인(시각 · 장소 · 설명 · 예매), 도착 후 구간(「≈ 대중교통 N분 · x km」, 길찾기: 한국어 카카오맵 · 그 밖 Google 지도),
  마지막 날 아래 귀가 체인(여행지 출발 시각부터). 환승 관문은 출발점 90km 안 그 수단 관문 가까운 순 8곳(2곳 이상일 때), 수단별로 저장(`gwPick`)
- **경로 선택 창**(`routeAsk`): 도착 도시에 닿는 경로(`routeCands`)가 2개 이상이면 코스 탭에서 한 번 스스로 연다. 고르면 도착 도시별 `routePick`, 닫으면 `routeSkip`(기본 경로 유지).
  출발지가 관문이고 그 수단이 닿으면 경로는 하나다(서울역 → 경주 KTX). 「경로 변경」으로 다시 연다
- **키가 필요해 옮기지 않은 것**: TAGO 열차 · 고속버스 · 지하철 시간표(`getTrains` · `getBuses` · `getSubwayDeps` · `getBusanMetroDeps`), 공항 수속 실측(`getAirportProcess`, 없으면 90분),
  카카오 역 이름 검색(`metroQSearch`), 지도 검색으로 출발지 추가(`custom` · `custAsk`), Google 대중교통 실측(`fetchTransit`). 시각은 모두 거리 기반 예상치라 카드에 안내 한 줄을 둔다

#### 섬 여행 — 제주 · 울릉 (`features/planner/island.ts` · `wide-chain.ts` · `schedule.ts` · `ferry.ts`)

PoC의 섬 규칙을 그대로 옮겼다(식 · 숫자는 `island.test.ts`의 손계산 대조).

- **섬 판정**(`islandOf`): 도착 도시가 제주 · 서귀포면 제주, 울릉이면 울릉(PoC `isJejuTrip` · `ulleungTrip` · `ferryVals`)
- **제주 광역 교통**: 항공 · 배 · 자가용 3칸만 보인다(PoC `wideOpts` `_jeju`). 예전에 고른 버스 · 기차 · 지하철은 고르지 않은 것으로 읽는다.
  자가용을 고르면 출발지를 배의 관문(항만)으로 맞추고(PoC `wideOpts` pick) 「제주는 섬이라 자가용만으로는 갈 수 없어요. 제주도민인가요?」 두 선택(PoC `jejuOwn*`)
  - **예, 제주도민 — 자가용만**(`jejuResident: true`): 광역 체인 없이 섬 안에서 자가용만. 출발지 · 귀가지 선택을 감추고, 첫날은 출발 시각부터(체인이 없으면 `accIn` 0, 공용 식대로 09:00보다 이르면 09:00)
  - **아니요 — 카페리**(`false`) · 아직 답하지 않음(`null`): 배 칸도 함께 강조하고 출발지 목록은 항만만(PoC `wideOriginFilter(…, 'ship')`).
    체인 = (출발지가 항만이 아니면) 항만까지 운전(`car`, `ownDriveMin`) + 카페리(`carferry`, 배 본 구간 60 + km × 0.85에 선적 · 하선 **30분**). 현지 이동은 자가용.
    본 구간 앞 환승 올림은 PoC `chainSchedule` 그대로(카페리는 항공 · 배가 아니라 운전 뒤면 올림이 붙는다). 경로 후보 · 환승 관문 · 예매 버튼은 없다(자가용, PoC `transBtns`)
- **울릉**: 출발지 · 귀가지는 울릉 항로 항구만(후포 → 묵호 → 강릉 → 포항, 항해 시간이 짧은 순), 울릉이 아니면 울릉 항로 항구는 목록에 없다(PoC `originOptions`).
  저장된 값은 두고 계산할 때만 고친다(`tripOriginKey`, PoC `oKey`: 울릉이면 울릉 항구가 아닌 값 → 포항여객선터미널, 울릉이 아니면 울릉 항구 → 서울역).
  코스 탭에서 여행이 울릉이 되면 한 번 안내 창(PoC `ulNotice*`)을 띄우고 출발지를 포항여객선터미널, 맞지 않는 귀가지를 「출발지와 동일」로 바꾼다(`ulleungSync`, PoC `syncUlleung`).
  화면을 열 때 이미 울릉 항구면 다시 띄우지 않는다. 배 본 구간 = 승선 수속 **40분** + 항구별 항해 시간(`sailMin`, 없으면 190분, PoC `accessMin` 울릉 분기)
- **배편 시간표 카드**(`FerryCard`, PoC `ferryVals`): 섬 여행에서 광역 교통이 배이거나, 제주 자가용에서 「아니요 — 카페리」를 골랐을 때만.
  출발 항구 고르기 · 표(운항 선사 · 소요 시간 · 운항 횟수 · 첫 출항 · 막 출항 · 도착 항구) · 안내 · 「가보고싶은섬 예매」(`island.theksa.co.kr`) · 「선사 시간표 검색」(네이버, 「선사 항구 섬 시간표」).
  한국어가 아니면 PoC 영어 값(`opEn` · `durEn`)과 PoC가 만드는 영어 표기(「무렵」 빼기 · `/day` · `/week` · 도착 항구)를 쓴다. 중 · 일 · 스페인어 값은 PoC에 없어 영어
- **운항 실적**(`FERRY_STATS`가 있는 항로만, 제주 부산 항로는 없다): 기간 · 항차 수, 연중 통제(결항)율, 여행월 통제율(출발일이 없으면 가장 궂은 달), 1–12월 막대(여행월 강조,
  화면 읽기용 달별 숫자 목록), 최근 1년 주요 출항, 여행월 통제율 **6%** 이상이면 경고 문장, 출처 한 줄. 단계 색은 6% 이상 `warning` · 15% 이상 `danger`(PoC `lvl`). 월 · 숫자 · 기간은 `Intl`
- 데이터 `data/ferry.json`은 `scripts/build-ferry.mjs`가 PoC `FERRY_ROUTES`(제주 6항 · 울릉 4항) · `FERRY_STATS`(한국해양교통안전공단 항로별 여객선 운항상황,
  odcloud 15146814, 2022-12 ~ 2026-05 실적 중 제주 · 울릉 9개 항로 집계)에서 만든다. 갱신은 PoC 값이 바뀐 뒤 스크립트를 다시 돌린다(실적을 직접 다시 집계하지 않는다)
- **키가 필요해 옮기지 않은 것**: 제주 항공 운항 현황(`loadFlights` · `KAC_KEY`), 공항 수속 실측(`getAirportProcess`), 휴게소(`loadRests`),
  지도 검색으로 제주 집 · 숙소를 출발지로 추가(`custom`, 그래서 도민 안내의 「검색으로 집 · 숙소를 지정」은 빼고 「첫날은 출발 시각부터」로 썼다),
  카페리 항만까지 운전의 카카오모빌리티 실측(`ownDriveMin` real, PoC 기본 식만 쓴다)

### 데이터 원본과 스크립트

원본은 PoC(`Tour-Navigator-App`, 읽기만)이고 이 리포에 넣지 않는다. 만든 JSON은 손으로 고치지 않는다. 스크립트를 돌린 뒤 `npm run format`.
마지막 동기화: 2026-09-27, PoC main f44eb97 (`docs/poc.md`).

| 스크립트                         | 입력(PoC)                                                                                                   | 출력                                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/build-planner.mjs`      | `체류시간 산정/체류시간_장소별.csv` · `Tour Planner.dc.html` · `파생 데이터/`(장소 · 지역거점 · 출발지 CSV) | `features/planner/data/places.json`(3,118곳, 가벼운 필드) · `place-details.json`(무거운 필드) · `regions.json`                                |
| `scripts/build-wide.mjs`         | `Tour Planner.dc.html`(`METRO_STATIONS` · `BUSAN_STATIONS` · 호선 순서 · 색 · 이름 · `ORIGIN_ALT`)          | `features/planner/data/wide.json`(지하철 출발 · 귀가역, 수단별 대체 관문)                                                                     |
| `scripts/build-places.mjs`       | `체류시간_장소별.csv` · `Tour Planner.dc.html` · `RESCENE Route.dc.html`                                    | `features/course/data/places.json`(테마 5개 장소) · `hubs.json` · `fixtures/gyeongju-nation.json`                                             |
| `scripts/build-citytour.mjs`     | `data/citytour.json`(시티투어 280노선). 플래너 `places.json` · `place-details.json`(ct)을 먼저 만든다       | `features/home/data/citytour.json`(노선 + 코스빌더에 넣을 장소 id)                                                                            |
| `scripts/build-theme-extras.mjs` | 테마 화면 5개 `*.dc.html`                                                                                   | `features/theme/data/extras.json`(사진 · 설명 · 장면 연결 · 좌표 기준) · `scenes.json`(RESCENE 조회수 포함) · `cities.json`(도시 칩 · center) |
| `scripts/build-stays.mjs`        | `Tour Planner.dc.html`(`STAYS`)                                                                             | `features/planner/data/stays.json`(숙소 표본 153곳, 가격대 `band` 제외)                                                                       |
| `scripts/build-ferry.mjs`        | `Tour Planner.dc.html`(`FERRY_ROUTES` · `FERRY_STATS`)                                                      | `features/planner/data/ferry.json`(배편 항로 제주 6 · 울릉 4, 운항 실적 9개 항로)                                                             |
| `scripts/build-names.mjs`        | `Tour Planner.dc.html`(`REG` · `CITY_NAME` · `I18N.locs`) · `파생 데이터/장소.csv`(중 · 일 장소명)          | `features/names/data/zh.json` · `ja.json` · `es.json`(권역 · 도시 · 장소 이름표, 그 언어 화면일 때만 싣는다)                                  |
| `scripts/build-tic.mjs`          | `data/tic.json`(관광안내소 725곳, 칼럼은 `파생 데이터/관광안내소.csv`)                                      | `features/planner/data/tic.json`(칸 이름만 붙이고 값은 원천 그대로)                                                                           |

플래너 장소 필드

- 가벼운 필드(`places.json`, 클라이언트 번들에 들어간다): `course/places.ts` `Place` 필드(`id` · `n` · `ko` · `en` · `locKo` · `cat` · `lat` · `lng` · `min` · `hrs` · `open` · `close` · `yt` · `off` · `k100` · `un` · `bf` · `auto`) + `macro`(권역) · `pickCity`(도시 고르기 도시) · `vz`(지정구역 문구)
- 무거운 필드(`place-details.json`, id → 값): `desc`(설명 한 · 영) · `img` · `imgCredit` · `zh` · `ja`(중 · 일 장소명) · `src`(좌표 근거) · `url`(카카오 장소 URL) · `ct`(시티투어 경유) · `rs`(연관관광지).
  클라이언트는 이 JSON을 import하지 않는다. 장소 시트를 열 때 Route Handler `app/api/planner/places/[id]/route.ts`가 한 곳(1KB 안팎)만 돌려주고
  `features/planner/use-place-detail.ts`(TanStack Query)가 받는다. 동적 import로 나누면 시트 하나를 열 때 3,118곳 전체(약 650KB)나 큰 조각을 받아야 해서 Route Handler를 골랐다
- 값이 없으면 필드를 비운다. 관문(`regions.json` `hubs`) · 출발지(`origins`)는 PoC `REGION_HUB` · `ORIGINS` 모양 그대로 두고 수단(`modes`)만 `지역거점.csv` · `출발지.csv`(전철 `metro` 포함) 값을 쓴다

### 추천과 데이터랩

- 설문 Q1~Q9로 유형(군집)을 판정하는 것(`features/recommend/scoring.ts`의 `classify`)만 프론트에서 한다
- 테마 순위는 백엔드 `POST /api/v1/recommend` 결과를 그대로 쓴다(`features/recommend/api.ts`).
  요청은 1순위 군집 · Q4 관심사 index · 야경 · Q15 지역(골랐을 때만), 응답 테마 이름은 `themes.ts`의 `key`로 우리 테마에 잇고 목록에 없는 테마(「[가상] …」)는 뺀다
- 결과 화면은 API 1위 테마를 localStorage `tn.lastTopTheme`(`{ a, slug }`)에 적고, ME는 다시 계산하지 않고 이 값을 읽는다
- 데이터랩 조회(TFI · 체류시간 · 코스 지역)는 결과 화면과 테마 화면(여행 정보 탭 `features/theme/DatalabSection.tsx`)이 함께 쓰므로 `lib/api/datalab.ts`에 둔다.
  TFI 막대는 `components/TfiBars.tsx`

### 홈 지역 시티투어

- 데이터 가공(분류 칩 · 내 유형 추천 · 지역 집계)은 `features/home/citytour.ts`, 경유지 → 플래너 장소 대조는 `citytour-match.ts`. 둘 다 목업(9/27 standalone) 규칙을 옮긴 순수 함수다
- 경유지 대조는 빌드 때 `scripts/build-citytour.mjs`가 미리 해서 노선마다 `placeIds`를 적는다(클라이언트가 3,118곳 · ct를 받지 않게). 노선 지역 이름과 같은 경유지(「서울 → … → 서울」)는 대조하지 않는다(목업과 다른 점)
- 「코스빌더에 넣기」는 `course-store`의 `replace`로 코스를 바꾸고 `/planner?tab=course`로 간다. 담아 둔 다른 코스가 있으면 먼저 묻는다
- 내 유형 추천은 `tn.lastRecommendation`의 답으로 `classify`를 다시 돌려 군집 선호 벡터(`CLUSTER_PREFS`, 목업 CL)와 맞춘다

- 카드(`CityTourCard`)와 「코스빌더에 넣기」 확인 창(`useCityTourAdd`)은 `features/home/CityTourCard.tsx`에 있고 플래너 여행 정보 탭도 이것을 쓴다.
  경로는 3줄까지만 보이고, 잘린 글이 있으면(그려진 높이로 판단, `citytour.ts` `routeOverflows`) 「경로 전체 보기」 토글(`aria-expanded`)을 둔다

### 투어 플래너 여행 정보 탭 (`?tab=info`)

- 순서: 선택한 지역(도시 고르기 · 광역 관문) → 시티투어 → 관광안내소 → 이동 요령(`RoutingHowTo`) → 지역별 관광 안내 링크
- 도시를 고르지 않으면 시티투어 · 관광안내소는 서울을 보이고 개수 앞에 「기본 지역」을 붙인다(PoC `_dflt`)
- 시티투어(`InfoCityTours`, PoC `ctList`): 홈과 같은 카드. 처음 3개, 「더 보기」마다 6개. 출처의 기준일은 첫 노선의 기준일. 코스가 없으면 빈 상태 문구
- 관광안내소(`InfoCenters`, PoC `tic*`): 제목 · 개수 → 1330 관광통역안내(`tel:1330`) → 외국어 화면에서 「내 언어 안내 가능한 곳만」 토글(`aria-pressed`, 개수) →
  목록(이름 · 안내 언어 칩 · 주소 · 운영 · 휴무 · 전화 `tel:` · 「지도」 카카오맵 새 창) → 처음 6곳 · 「더 보기」마다 10곳 → 출처.
  규칙은 `features/planner/tic.ts`(`langsOf` 외국어 원문 → EN · JP · CN · RU · VN · TH, `mineOf` 화면 언어 → 내 언어(스페인어는 영어), `cityInfoCenters` 정렬: 내 언어 안내 가능 → 휴게소 뒤로 → 이름)
- 두 데이터는 서버 컴포넌트(`PlannerInfoTab`)가 그 도시 것만 골라 넘긴다(전국 데이터를 클라이언트 번들에 싣지 않는다)
- 관광안내소 데이터 출처: 한국관광공사 전국관광안내소 정보 · 좌표 카카오(PoC `data/tic.json`). 갱신은 PoC 파일을 받은 뒤
  `node scripts/build-tic.mjs <Tour-Navigator-App/data/tic.json>` → `npm run format`
- 데이터 문구 치환(`lib/kr-units.ts` `krUnits`, PoC `KR_UNIT`): 외국어 화면에서 시티투어 요금 · 관광안내소 운영 · 휴무에만 적용한다(PoC `KR_UNIT_FIELDS`의 `ctList` · `ticList` info).
  이름 · 경로 · 주소는 원문 그대로다(PoC는 주소도 같은 info 문자열이라 치환을 거쳤지만, 주소 속 「관광지」 같은 말이 바뀌지 않게 뺐다)

### 머리줄 알림 (`tn.notifications.read`)

- 알림은 이 브라우저에 있는 정보(추천 결과 · 플래너 코스 · 저장된 플랜 · 시티투어 데이터)로만 만든다(`lib/notifications.ts`). 읽은 알림 id 목록을 `tn.notifications.read`에 둔다
- 알림 id는 내용으로 만들어서 내용이 바뀌면 다시 안 읽음이 된다

### 저장된 플랜 (`tn.savedPlans`)

- 테마 코스 `{ slug, a, plan, savedAt, name? }`와 투어 플래너 코스 `{ kind: "planner", id, name, city, placeIds, settings, savedAt }`가 한 배열에 산다.
  테마 코스의 `name`은 테마 코스 탭 「내 플랜」에서 이름을 적었을 때만 있다. 플래너 `settings`에는 체류 시간 덮어쓰기(`stayOv`)도 들어간다.
  `kind`가 없으면 테마 코스다. 읽기 · 쓰기는 `lib/local-store.ts`(`parseSavedPlans` · `parsePlannerPlans` · `writeSavedPlans` · `writePlannerPlans`)만 쓰고,
  한쪽을 쓸 때 다른 쪽 항목은 그대로 둔다
- ME는 둘을 저장한 순서대로 보인다. 플래너 플랜은 「{이름} · {도시} · {n박 m일} · {n}곳」, 누르면 `/planner?tab=course&plan={id}`
- 플래너 코스 탭과 테마 코스 탭의 「내 플랜」은 저장 · 저장소(불러오기 · 삭제) · 「{이름}」 덮어쓰기를 한다(PoC `planVals`, 목록은 `components/PlanStore`).
  덮어쓰기 대상은 불러오거나 방금 저장한 플랜이다(플래너는 `tn.planner.course`의 `planId`, 테마는 화면 상태). 덮어쓰기 · 삭제는 확인 창으로 묻는다.
  테마 코스는 같은 코스(slug · a · plan)를 하나만 두므로, 덮어쓰기로 같은 코스가 생기면 하나로 합친다(`overwriteThemePlan`)

### 저장한 장소 (`tn.savedPlaces`)

- 장소 시트의 「저장」(북마크). `{ id, source, savedAt, name: { ko, en } }[]`. `source`는 테마 slug 또는 `planner`이고, 같은 장소도 출처가 다르면 따로 저장한다.
  `name`은 ME가 장소 데이터(플래너 3,118곳)를 불러오지 않고 이름을 보이려고 저장할 때 적어 둔다. 읽기 · 쓰기는 `lib/local-store.ts`(`parseSavedPlaces` · `toggleSavedPlace` · `useSavedPlaces`)
- ME 「저장한 장소」는 저장한 순서대로, 누르면 테마는 `/themes/{slug}?tab=map&place={id}`, 플래너는 `/planner?place={id}`(시트가 열린 지도 탭)
- 테마 스탬프 탭 아래쪽 「저장한 장소」는 그 테마(`source`)에서 저장한 것만. 예전 테마별 북마크 `tn.bookmarks.{slug}`는 읽지 않는다
- 스탬프(`tn.stamps.{slug}`, `features/theme/storage.ts`)는 시트 · 스탬프 탭이 함께 쓰는 토글이다. PoC 코드(`d_toggleStamp`)에 위치 확인 규칙이 없어 위치를 보지 않는다

## 서버 컴포넌트와 클라이언트 컴포넌트

- 기본은 서버 컴포넌트다. 클릭 · 입력 · 상태 · 브라우저 API가 필요한 가장 작은 컴포넌트에만 `"use client"`를 붙인다
- 페이지나 레이아웃 전체에 `"use client"`를 붙이지 않는다
- 로그인 토큰이 필요한 백엔드 호출은 클라이언트 컴포넌트에서 한다. 토큰이 브라우저(localStorage)에 있기 때문이다.
  로그인 없이 보는 공개 데이터는 서버 컴포넌트에서 불러도 된다
- 카카오 지도처럼 `window`가 필요한 라이브러리는 클라이언트 컴포넌트 안에서만 쓴다

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
