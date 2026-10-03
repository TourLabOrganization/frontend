# 구조와 이름

## 폴더

```
src/
  app/                  라우트. 폴더 경로가 곧 URL
    layout.tsx          전역 레이아웃 (폰트 · Provider)
    providers.tsx       클라이언트 Provider (TanStack Query)
    api/**/route.ts     Route Handler. 키가 필요한 외부 API를 대신 부른다
  components/           여러 기능이 함께 쓰는 컴포넌트
  features/<기능>/      한 기능에서만 쓰는 컴포넌트 · 훅 · 타입 · 데이터 (예: features/recommend, features/course, features/theme, features/planner, features/home, features/me, features/auth, 외국어 화면 데이터 번역 features/translations — 서버에서만 읽는다, docs/i18n.md)
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

| 경로                | 화면                                                                                                           | 코드                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/`                 | 홈(첫 방문 로고 시작 화면 · 배너 · 지역 시티투어 · 나의 테마 · 지금 인기 코스)                                 | `app/page.tsx`, `features/home`                                                                             |
| `/recommend`        | 테마 추천 설문 6.4(공통 6(S4는 관심사 두 가지) + 관심사 분기 1~2 + 필요할 때 확인 1, 아래 「추천과 데이터랩」) | `app/recommend/page.tsx`, `features/recommend`(`survey.ts`)                                                 |
| `/recommend/result` | 추천 결과(유형 · 테마 적합도 지수 상위 3개, 네트워크 없이 프론트에서 계산)                                     | `app/recommend/result/page.tsx`, `features/recommend/survey.ts` · `theme-index.ts`                          |
| `/themes/[themeId]` | 테마 화면. 하단 탭 5개(지도 · 코스 · 영화 · 스탬프 · 여행 정보)                                                | `app/themes/[themeId]/page.tsx`, `features/theme`, `features/course`, `features/planner/regions`(도시 이름) |
| `/planner`          | 투어 플래너. 지역 탭 + 하단 탭 3개(지도 · 코스 · 여행 정보)                                                    | `app/planner/page.tsx`, `features/planner`                                                                  |
| `/me`               | ME(계정 카드 · 나의 여행자 유형 · 저장된 플랜)                                                                 | `app/me/page.tsx`, `features/me`, `features/auth`, `features/planner`(저장한 코스 설정 · 도시 이름 · 일수)  |
| `/login`            | 이메일 로그인(`?next=` 돌아갈 곳 · `?email=` 채울 이메일 · `?joined=1` 가입 직후 안내)                         | `app/login/page.tsx`, `features/auth`                                                                       |
| `/signup`           | 이메일 회원가입(가입하면 바로 로그인, `?next=`)                                                                | `app/signup/page.tsx`, `features/auth`                                                                      |

### 테마 화면 주소 (`/themes/[themeId]`)

| 쿼리    | 값                                                         | 쓰임                                                              |
| ------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `tab`   | `map` · `course` · `film` · `stamp` · `info`               | 고른 탭. 없거나 모르는 값이면 `map`                               |
| `a`     | 여행 조건(Q10~Q14, `features/course/trip.ts` `encodeTrip`) | 코스 탭의 조건. 코스 탭의 일정 · 이동수단 칸이 q11 · q12만 바꾼다 |
| `plan`  | `classic` · `trend` · `quiet`                              | 코스 3안                                                          |
| `place` | 장소 id                                                    | 지도 탭에서 그 장소 시트를 연 채로 시작                           |

- 탭을 바꿔도 `a` · `plan`은 주소에 남긴다. 주소는 `features/theme/tabs.ts`의 `themeHref`로 만든다
- 영화 탭의 장면 카드는 `id`가 장면 id라 `?tab=film#{장면 id}`로 바로 간다
- 지도 탭: 지역 줄(RESCENE는 전국 · 경주 · 거제 · 수원 · 정선 · 대전 · 충주 · 동해 칩 — PoC 칩 거제 · 경주에 전국 목록 장소가 있는 도시를 더하고(대표 요청 2026-09-28), 칩 순서는 장소 번호 순(경주 1~7 · 거제 8~21 …)으로 둬 전국 목록 번호가 1부터 차례로 보인다(대표 결정 2026-09-29, `scripts/build-theme-extras.mjs`), 한 줄 + 「더보기」(`components/ui/ChipRow`, 가로 스크롤 없음). 한 도시 테마는 도시 이름 · 장소 수). 분류 칩은 투어 플래너와 같은 분류 아이콘. 목록은 늘 펼쳐 둔다(접기 없음, 대표 결정 2026-09-30). 목록 행의 거리는 도시 center(PoC `DATA.<도시>.center`, 더한 도시는 플래너 `regions.json` 도시 좌표)에서 직선거리이고, 여러 도시 보기(RESCENE 전국)는 거리 대신 도시 이름이다(목업 규칙, `features/theme/place-list.ts`). 장면이 있는 행은 영화(영상) 탭 바로가기
- RESCENE는 하단 탭 이름이 영상 · 팬소통이고, 영상 정렬은 인기순(PoC에 적힌 조회수) · 최신순이다
- 추천 결과 · ME 저장된 플랜 · 홈 추천 코스는 `tab=course`로, 홈 포스터 타일 · 배너는 기본(지도)으로 들어온다

### 투어 플래너 주소 (`/planner`)

| 쿼리     | 값                         | 쓰임                                                                                                                                        |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `city`   | 도시 한국어 이름(`경주`)   | 도시 보기. 없거나 장소가 없는 도시면 전국 보기                                                                                              |
| `plan`   | 저장된 플래너 플랜 id      | 코스 탭에서 그 플랜을 코스로 불러온다(담은 코스가 있고 다르면 먼저 묻는다). 불러오면 주소에서 뗀다                                          |
| `region` | 권역 key(`capital` 등 7개) | 전국 보기에서 고른 권역. 지도는 그 권역 도시들(울릉 · 독도 제외)의 가운데를 축척 32km(레벨 12)로 보이고 목록을 거른다. `city`가 있으면 무시 |
| `tab`    | `map` · `course` · `info`  | 고른 탭. 없거나 모르는 값이면 `map`                                                                                                         |
| `place`  | 장소 id                    | 지도 탭에서 그 장소 시트를 연 채로 시작                                                                                                     |

- 주소는 `features/planner/query.ts`의 `plannerHref` · `scopeHref`로 만든다. 기본값(전국 · `map`)은 주소에 적지 않는다
- 지역 탭 · 도시 고르기는 탭을 남기고 범위만 바꾸고, 하단 탭은 범위를 남기고 탭만 바꾼다
- 권역 key와 도시 목록은 `features/planner/data/regions.json`(PoC `REG` + `MACRO_OF`)에 있다. 권역 이름은 목업 지도가 그리는 `MACRO_REGION` 이름(경북권 · 경남권 · 전라권 …)이다
- 도시별 장소 수(`placeCounts`, `pickCity` 기준. 도시 보기 규칙은 아래 「도시 보기」)도 `regions.json`에 있다(빌드 스크립트가 센다). 도시 고르기 · 여행 정보 탭 도시 선택은 이 값(`regions.ts` `PLACE_COUNT_BY_CITY` · `CITY_GROUPS`)을 쓰고
  `data.ts`(places.json)를 import하지 않는다. 여행 정보 탭 클라이언트 컴포넌트가 places.json에 닿지 않는지는 `planner/info-bundle.test.ts`가 확인한다
- 지도 탭 전국 보기는 권역을 행정구역 경계 면으로 칠한다(`region-shapes.ts`, 통계청 2018 시도 경계를 권역으로 합친 것). 땅은 흰빛으로 눌러 바탕 지도 글씨를 줄이고, 경계선 · 마우스를 올린 권역 · 이름표는 브랜드 파랑이다(`PlannerMap` `AREA_FILL` · `AREA_ACCENT`, 값은 globals.css 토큰). 면 가운데에 「수도권」 이름표를 두고, 면이나 이름표를 누르면 그 권역(`?region=`)의 도시 묶음(원형)으로 들어간다
- 지도 탭은 분류 칩과 배지 칩(데이터랩 인기 · 유네스코 · 한국관광 100선 · 열린관광지 · 관광특구 · 관광단지, `features/planner/badges.ts`)을 AND로 거른다. 배지 칩은 한 번에 하나, 다시 누르면 꺼진다
  - 데이터랩 인기 = `popRank`(한국관광 데이터랩 인기관광지 순위 1~100)가 있는 곳 173곳(경주 · 거제 · 부산 · 제주 · 서울 · 영월 6개 지역).
    목록 행 · 장소 시트에 「데이터랩 인기 {n}위」 배지를 붙인다
  - 관광특구 · 관광단지 = 지정구역 문구(`vz`, data-server `zone`)가 있는 곳 전부 210곳(관광특구 · 관광단지 · 지정관광지. 예전에는 「관광특구」 글자가 든 34곳만).
    장소 시트 배지는 종류와 지정 연도(「관광단지 (2008 지정)」, 연도가 `0000`이면 종류만). 외국어는 `lib/kr-units.ts`의 관광특구 · 관광단지 · 관광지 · 지정 치환
  - 장소 시트 배지 줄(`PlaceSheet` `badges`)에는 데이터랩 인기 · 유네스코 · 100선 · 열린관광지 · 지정구역을 모두 보인다
- 목록 순서(`features/planner/list-order.ts`) = **인기 먼저 + 나머지 가나다**. 도시 안에서 `popRank`가 있는 곳을 순위 오름차순으로 먼저(같은 순위는 이름순),
  나머지는 이름순(코드 포인트 비교). 전국 · 권역 목록은 도시 이름 → 도시 안에서 인기 → 이름. 순위가 있는 도시에서만 목록 위에 「순위가 있는 곳을 먼저 보여요」 안내 한 줄.
  - 결정 이유: 팀 요청(2026-09-28 「가나다순 말고 자주 방문한 순위로」)에 맞춰 대표가 정했다. data-server `docs/contract.md`는 「`popRank`로 정렬하지 말라」고 권한다
    (6개 지역 173곳만 값이 있어 나머지 94%가 「순위 없음」 한 덩어리로 밀린다). 그래서 순위를 전체 정렬 키로 쓰지 않고 「순위 있는 곳을 앞에 세우기」로만 쓰고,
    순위 없는 곳 · 순위 없는 도시(예: 가평)는 예전처럼 이름순을 지킨다. 순위 옆에 배지 · 안내를 붙여 왜 앞에 있는지 보이게 했다
- 분류 표시는 분류 아이콘(`features/planner/CategoryIcon.tsx`, lucide, 분류 색 토큰 `text-cat-*`)이다. 장소 목록 행 · 분류 칩(아이콘 16 + 이름) · 담은 장소 · 「이 날에 장소 추가」가 쓴다.
  아이콘은 장식(`aria-hidden`)이고 분류 이름은 글자로 함께 보인다. 모르는 분류는 회색 점. **지도 핀은 색 점 그대로**(`category.ts` `categoryDot`, 수백 개가 겹치면 아이콘이 오히려 읽기 어렵다)

  | 분류                           | 아이콘        | 색 토큰        |
  | ------------------------------ | ------------- | -------------- |
  | 숙박 `stay`                    | `BedDouble`   | `cat-stay`     |
  | 문화유산 · 전통체험 `herit`    | `Landmark`    | `cat-herit`    |
  | 로컬상권 · 먹거리 `food`       | `Utensils`    | `cat-food`     |
  | 테마파크 · 액티비티 `activity` | `FerrisWheel` | `cat-activity` |
  | 해양 · 자연경관 `sea`          | `Waves`       | `cat-sea`      |
  | 힐링 · 생태 · 체험 `heal`      | `Leaf`        | `cat-heal`     |

- **담은 코스 표시**(`course-map.ts` · `PlannerMap` `CourseLayer`, 2026-10-03): 코스에 담은 장소가 있으면 코스 탭과 같은 입력으로 일정을 계산해(`buildPlannerSchedule`) 날짜마다 색 하나(7가지 hex, `DAY_COLORS`)로
  경유지 순서 선(Polyline)과 번호 핀(그날 몇 번째, 누르면 장소 시트), 마지막 날을 뺀 날마다 그날 밤 숙소 핀(침대 아이콘, 코스 탭 「숙박」과 같은 `pickNightStay`: 담은 숙박 장소 → 표본, 25km 밖이면 없음).
  지도 아래 범례 줄: 「코스 n곳 표시」 토글(aria-pressed) · 날짜 색 점 · 「코스에 맞춰 보기」(코스 점들에 화면을 맞춤, 범위가 바뀌면 다시 범위에 맞춘다). 문구 `Planner.map.course*`
- 도시 보기(`city`)는 장소의 `pickCity`(도시 고르기에서 속한 도시)로 거른다. **도시를 고르면 그 도시(`locKo`)의 장소가 전부 나온다**:
  `pickCity`는 전용 화면 장소면 그 화면 도시, 전국 목록 장소면 `locKo`다(`scripts/build-planner.mjs`)
  - 결정 이유: PoC `cityRows`는 전용 화면이 있는 도시(서울 · 부산 · 제주 · 영월 · 경주 · 거제)의 전국 목록 장소 447곳을 버려서
    그 장소(예: 경주 분황사 · 경주중앙시장 · 황남빵 · 경주 호텔)가 전국 · 권역 보기에만 나왔다. 대표가 「다 고쳐야지 당연히」로 정했다(2026-09-28,
    팀장 요청 「장소 3,000여 곳이 앱에 다 구현돼야 함」과 같은 뜻). 그래서 도시별 장소 수가 목업 화면 숫자와 다르다(경주 40 → 70, 서울 87 → 262 …)
  - 중복 제외: 같은 장소가 전용 화면 묶음과 전국 목록에 함께 있으면 한쪽만 도시에 넣는다(대표 결정 2026-09-28 「이름이 조금 다른 같은 장소도 중복」).
    같은 장소 = 같은 도시 · 숙박 여부가 같고 · 좌표 200m 이내이고, 이름을 정규화(괄호와 그 안 · 공백 · 문장부호 제거, 앞뒤의 도시 이름과 「호텔」 제거)했을 때
    한쪽이 다른 쪽을 품는 것. 눈으로 가른 예외를 더한다: `SAME_PLACES`(좌표가 1~2km 벌어졌거나 이름이 서로를 품지 않는 같은 장소: 영월 고씨굴 · 해운대달맞이길 · 제주 올레시장 · 사려니숲길)와
    `DIFFERENT_PLACES`(규칙에 걸리지만 다른 장소: 코엑스 · 별마당도서관, 반포한강공원 · 달빛무지개분수, 경주중앙시장 · 중앙시장 야시장)
  - 남기는 쪽은 전용 화면 장소다. 단 데이터랩 인기 순위가 전국 목록 쪽에만 있으면 순위가 도시 목록에서 사라지지 않게 전국 목록 쪽을 남긴다(서울스카이 78위 · 서귀포매일올레시장 3위 · 한라산둘레길 사려니숲길 15위)
  - 지금 도시에서 뺀 장소는 14곳이다(BIFF광장 · 제주 올레시장 · 사려니숲길 · 영월 고씨굴 · 경주 감은사지동서삼층석탑 · 동백섬 · 장릉 · 해운대달맞이길 · 롯데월드타워 서울스카이 · F1963 ·
    힐튼호텔 경주 · 서울숲 · 양남 주상절리 파도소리길 · 청령포 관음송). 전국 · 권역 보기에는 둘 다 남는다. `pickCity`가 없는 장소는 이 14곳뿐이다
  - 도시가 바뀌어 전용 화면 도시의 추천 코스 후보(`auto`)가 늘었다(추천 코스가 달라질 수 있다). 시티투어 「코스빌더에 넣기」 장소(`citytour.json`)도 같은 후보로 다시 만들었다
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
  검색어가 없으면 그 날 도시(첫 장소 도시, 없으면 앞뒤 날)의 장소를 보이고, 검색어가 있으면 다른 도시 장소까지 찾는다(여러 도시 코스, 2026-10-02)
- 일자별 일정의 구간마다 수단 · 시간 · 거리(`legInfo` km, 요약 총 거리와 같은 값)를 붙이고, 첫날 위 · 마지막 날 아래에 광역 체인(아래)과 본 구간 수단 예매 링크(`data/booking.ts` `wideBookingLink`)를 둔다
- **여러 도시 코스**(2026-10-02, 그 전에는 한 도시만 담고 다른 도시 장소를 담으려면 비울지 물었다): 어느 도시 장소든 그대로 담긴다. `city`는 처음 담은 장소의 도시(대표 도시: 추천 코스 후보 · 제목의 기준).
  - 도시가 다른 장소 사이는 `legInfo`가 광역 구간으로 잰다(둘 다 전철권이면 광역전철 12 + km × 0.95 + 환승 15, 둘 다 KTX · SRT 관문이면 기차 18 + km × 0.30 + 35, 아니면 버스 18 + km × 0.68 + 35. `schedule.ts` `wideLegMode`가 같은 규칙으로 수단을 정한다).
    일자별 일정의 그 구간은 「기차(광역 이동) · 시간 · km」처럼 수단을 붙이고 그 수단의 예매 링크(`wideBookingLink`, 자가용은 없음)를 둔다(`CourseDaySection` `legLinks`)
  - 가는 광역 체인은 첫 장소 도시, 돌아오는 체인은 마지막 장소 도시(`planTrip` `regIn` · `regOut`). 코스 제목은 도시를 순서대로 「서울 → 경주」(`courseCities`)
  - 추천 코스를 불러오면 지정한 숙박 장소 중 추천 코스의 도시들에 있는 것만 남긴다(`keepStays`). 그날 밤 숙소 · 주변 숙소는 그 날 기준점 도시 기준이라 그대로다
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
- **항공편 카드**(`FlightCard`, PoC `flightBoard*` · `busanAir*`): 광역 교통이 항공이고 자가용이 아닐 때, 제주 · 서귀포 여행이면 「제주 노선 운항 현황」,
  첫 도시가 부산 · 김해 · 양산 · 창원 · 거제면 「김해공항 노선 운항 현황」. 방향 · 공항 고르기(제주 카드는 출발지가 공항이면 그 공항, 아니면 김포부터) →
  편성 요약 표(운항 항공사 · 일 운항 · 첫 · 막 출발 · 비행 시간) → 항공사별 운항 개요(편도 편수 가운데 값의 비중 막대) → 지금 수속 소요(한국공항공사, `/api/airport/process`, 키가 있을 때) →
  항공사 공식 시간표 링크. 노선의 항공사표가 있으면 요약의 합계 · 첫 · 막 편을 그 표에서 다시 계산한다(PoC `flightSched`. PoC 김해 카드는 다시 계산하지 않지만 같은 노선이 두 카드에서 달라 보이지 않게 맞췄다).
  고른 방향 · 공항은 저장하지 않는다(PoC도 화면 상태). 데이터 `data/flights.json`은 `scripts/build-flights.mjs`가 PoC 하드코딩 값(「정기 편성 요약 · 시즌·요일에 따라 변동」)에서 만든다
- **키가 필요해 옮기지 않은 것**: 제주 항공 실시간 운항 편성(`loadFlights` · `KAC_ENDPOINT`, PoC에서도 주소가 비어 꺼져 있다), 휴게소(`loadRests`),
  지도 검색으로 제주 집 · 숙소를 출발지로 추가(`custom`, 그래서 도민 안내의 「검색으로 집 · 숙소를 지정」은 빼고 「첫날은 출발 시각부터」로 썼다),
  카페리 항만까지 운전의 카카오모빌리티 실측(`ownDriveMin` real, PoC 기본 식만 쓴다)

### 데이터 원본과 스크립트

원본은 PoC(`Tour-Navigator-App`, 읽기만)이고 이 리포에 넣지 않는다. 만든 JSON은 손으로 고치지 않는다. 스크립트를 돌린 뒤 `npm run format`.
마지막 동기화: 2026-09-27, PoC main f44eb97 (`docs/poc.md`). 장소 분류 · 영어 이름 · 지정구역 · 인기 순위는 data-server develop ac9eb34(2026-09-28)로 덮었다(아래).

| 스크립트                          | 입력(PoC)                                                                                                                                                                  | 출력                                                                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/build-planner.mjs`       | `체류시간 산정/체류시간_장소별.csv` · `Tour Planner.dc.html` · `파생 데이터/`(장소 · 지역거점 · 출발지 CSV) · data-server `places.json`                                    | `features/planner/data/places.json`(3,109곳, 가벼운 필드) · `place-details.json`(무거운 필드) · `regions.json`                                                                 |
| `scripts/build-wide.mjs`          | `Tour Planner.dc.html`(`METRO_STATIONS` · `BUSAN_STATIONS` · 호선 순서 · 색 · 이름 · `ORIGIN_ALT`)                                                                         | `features/planner/data/wide.json`(지하철 출발 · 귀가역, 수단별 대체 관문)                                                                                                      |
| `scripts/build-places.mjs`        | `체류시간_장소별.csv` · `Tour Planner.dc.html` · `RESCENE Route.dc.html` · data-server `places.json`                                                                       | `features/course/data/places.json`(테마 5개 장소) · `hubs.json` · `fixtures/gyeongju-nation.json`                                                                              |
| `scripts/build-citytour.mjs`      | `data/citytour.json`(시티투어 280노선). 플래너 `places.json` · `place-details.json`(ct)을 먼저 만든다                                                                      | `features/home/data/citytour.json`(노선 + 코스빌더에 넣을 장소 id + 실제 여행지 `visits`)                                                                                      |
| `scripts/build-theme-extras.mjs`  | 테마 화면 5개 `*.dc.html`                                                                                                                                                  | `features/theme/data/extras.json`(사진 · 설명 · 장면 연결 · 좌표 기준) · `scenes.json`(RESCENE 조회수 포함) · `cities.json`(도시 칩 · center)                                  |
| `scripts/build-stays.mjs`         | `Tour Planner.dc.html`(`STAYS`)                                                                                                                                            | `features/planner/data/stays.json`(숙소 표본 153곳, 가격대 `band` 제외)                                                                                                        |
| `scripts/build-region-shapes.mjs` | 통계청(KOSTAT) 센서스용 행정구역경계 2018 시도 경계(southkorea/southkorea-maps `kostat/2018/json/skorea-provinces-2018-geo.json`). Turf.js는 `npm i --no-save`로 받아 쓴다 | `features/planner/data/region-shapes.json`(시도 17곳을 권역 7곳으로 합쳐 단순화한 바깥 경계, 20㎢ 미만 섬 제외)                                                                |
| `scripts/build-ferry.mjs`         | `Tour Planner.dc.html`(`FERRY_ROUTES` · `FERRY_STATS`)                                                                                                                     | `features/planner/data/ferry.json`(배편 항로 제주 6 · 울릉 4, 운항 실적 9개 항로)                                                                                              |
| `scripts/build-flights.mjs`       | `Tour Planner.dc.html`(`JEJU_SCHED` · `JEJU_AIR_ROUTES` · `BUSAN_ROUTES` · `BUSAN_SCHED` · `ROUTE_AIRLINES` · `AIRLINE_SCHED`)                                             | `features/planner/data/flights.json`(제주 노선 10개 공항 · 김해 3개 노선 요약, 항공사표 5개 노선, 항공사 시간표 링크 10개)                                                     |
| `scripts/build-names.mjs`         | `Tour Planner.dc.html`(`REG` · `CITY_NAME` · `I18N.locs`) · `파생 데이터/장소.csv`(중 · 일 장소명)                                                                         | `features/names/data/zh.json` · `ja.json` · `es.json`(권역 · 도시 · 장소 이름표, 그 언어 화면일 때만 싣는다)                                                                   |
| `scripts/official-name-fixes.mjs` | (원천 없음) 그 장소가 아닌 중 · 일 공식 명칭 id 목록 `WRONG_OFFICIAL_NAMES`와 판정 `isOfficialName`                                                                        | `build-names.mjs` · `build-planner.mjs`가 공식 명칭을 거를 때 쓴다(`docs/i18n.md`)                                                                                             |
| `scripts/build-tic.mjs`           | `data/tic.json`(관광안내소 725곳, 칼럼은 `파생 데이터/관광안내소.csv`)                                                                                                     | `features/planner/data/tic.json`(칸 이름만 붙이고 값은 원천 그대로)                                                                                                            |
| `scripts/add-popular-places.mjs`  | 개발 서버 `GET /api/tour/popular/collect`(한국관광공사 집중률 · 관광정보, `lib/tour-collect.ts`)                                                                           | `features/planner/data/added-places.json`(인기 관광지에서 누적한 추가 장소 `pop<contentid>`) · `signgu.json` · `regions.json`(`placeCounts`) · `place-details.json`에 덧붙인다 |
| `scripts/add-manual-places.mjs`   | `scripts/data/citytour-manual-places.csv`(사람이 좌표를 적은 시티투어 경유지 표)                                                                                           | 같은 네 파일에 `ctm<해시>` 추가 장소를 덧붙인다(관광공사 키 없이. 기존 장소 250m 안 · 1km 안 이름 겹침은 건너뜀)                                                               |

data-server 합치기 (`scripts/data-server.mjs`)

- data-server(팀 데이터 정본, 읽기만)의 `data/derived/places.json`(3,118곳)을 id로 합친다. 맥도날드 드라이브스루 9곳은 빌드에서 뺀다(`build-planner.mjs` `EXCLUDED`, 대표 결정 2026-09-29) — 앱 장소는 3,109곳. 필드 뜻은 data-server `docs/contract.md`
- 경로: 두 스크립트의 마지막 인자 → 환경변수 `DATA_SERVER_DIR` → 기본값 `../data-server`(이 리포 옆 클론). 파일이 없으면 멈춘다.
  스크립트가 끝에 data-server 커밋과 바뀐 값 수를 출력한다. 다시 만들면 위 「마지막 동기화」 줄의 커밋을 고친다
- 합치는 필드(나머지 필드와 순서는 PoC 원천 그대로):
  - `cat` ← `catFinal`(TourAPI 공식 분류로 교정한 값. 계약 문서가 `catApp` 말고 `catFinal`을 쓰라고 정했다). ac9eb34 기준 플래너 170곳 · 테마 장소 355곳 중 66곳이 바뀌었다
  - `en` ← `nameEn`(다를 때만). ac9eb34의 6곳 차이는 모두 data-server 값에 JS 이스케이프(`\'` · `\u2019`)가 글자 그대로 남은 것이라, 풀고 비교해 바뀐 곳은 0곳이다
  - `vz` ← `zone`(지정구역 문구, 210곳. PoC `파생 데이터/장소.csv` 지정구역과 같은 값) · `popRank`(데이터랩 인기관광지 순위, 173곳). 값이 있을 때만 넣는다
- 테마 코스 3안 중 「한적」은 분류가 `heal`인 장소를 우대하므로(`course/scenarios.ts`) 분류가 바뀌면 코스가 바뀐다. 공용 식은 그대로다
- `fixtures/gyeongju-nation.json`은 PoC 출력(`export_stay_csv.js`) 재현용이라 합치지 않는다

플래너 장소 필드

- 가벼운 필드(`places.json`, 클라이언트 번들에 들어간다): `course/places.ts` `Place` 필드(`id` · `n` · `ko` · `en` · `locKo` · `cat` · `lat` · `lng` · `min` · `hrs` · `open` · `close` · `yt` · `off` · `k100` · `un` · `bf` · `auto`) + `macro`(권역) · `pickCity`(도시 고르기 도시) · `vz`(지정구역 문구) · `popRank`(데이터랩 인기 순위). `cat` · `en` · `vz` · `popRank`는 data-server 값
- 무거운 필드(`place-details.json`, id → 값): `desc`(설명 한 · 영) · `img` · `imgCredit` · `zh` · `ja`(중 · 일 장소명) · `src`(좌표 근거) · `url`(카카오 장소 URL) · `ct`(시티투어 경유) · `rs`(연관관광지).
  클라이언트는 이 JSON을 import하지 않는다. 장소 시트를 열 때 Route Handler `app/api/planner/places/[id]/route.ts`가 한 곳(1KB 안팎)만 돌려주고
  `features/planner/use-place-detail.ts`(TanStack Query)가 받는다. 동적 import로 나누면 시트 하나를 열 때 3,109곳 전체(약 650KB)나 큰 조각을 받아야 해서 Route Handler를 골랐다
- 추가 장소(`pop<contentid>` · `odii<tid>` · `ctm<해시>`, `features/planner/data/added-places.json`): 인기 관광지(한국관광공사 집중률)와 관광지 오디오 가이드(오디) 해설이 있는 관광지에서 모아 누적한 앱 장소. `data.ts`가 `places.json` 뒤에 이어 붙여
  지도 · 목록 · 코스 · 장소 시트가 빌드 장소와 똑같이 쓴다(가벼운 필드만. 시군구 코드는 `signgu.json`, 설명 · 사진 · 중 · 일 이름 · 좌표 근거는 `place-details.json`, 도시별 장소 수는 `regions.json`).
  모으는 규칙은 `lib/tour-collect.ts`(`docs/api.md` 「인기 관광지 모으기」), 파일에 합치는 것은 `scripts/add-popular-places.mjs`. Data-Analytics 저장소 `tools/add_popular_places.py`와 같은 규칙 · 같은 id라 두 저장소의 장소 표가 같게 늘어난다.
  갱신은 dev 서버를 띄우고 `node scripts/add-popular-places.mjs`(인기 관광지) · `--source odii`(오디 해설 관광지) · `--source citytour`(시티투어 경유지 중 앱에 없는 관광지, 2026-10-03) → `npm run format` → `node scripts/build-citytour.mjs <원천>`(노선 `placeIds`가 새 장소까지 잇게). 이미 있는 id는 다시 넣지 않는다
  관광공사 키 없이 사람이 좌표를 적은 표(`scripts/data/citytour-manual-places.csv`)로도 넣는다: `node scripts/add-manual-places.mjs` → id `ctm<sha1(도시|이름) 8자리>`, 기존 장소와 250m 안(또는 1km 안 이름 절반 겹침)이면 넣지 않고, 출처에 「좌표 수기 입력(지도 검증 필요)」을 적는다(2026-10-03, 시티투어 경유지 85곳). `docs/api.md` 「시티투어 경유지 관광지」
- 신규 관광지(`kto:<contentid>`): `places.json`에 없는 한국관광공사 관광지. 홈 인기 관광지가 이름 · 위치로도 앱 장소를 못 찾을 때 만들고,
  브라우저가 localStorage `tn.extraPlaces`(`features/planner/extra-places.ts`)에 같은 필드로 기억해 지도 · 장소 시트 · 코스가 앱 장소처럼 쓴다.
  무거운 필드 · 장소 시트 칸은 서버가 한국관광공사 공통정보로 만든다(`lib/tour-spot.ts`, `docs/api.md` 「신규 관광지」)
- 값이 없으면 필드를 비운다. 관문(`regions.json` `hubs`) · 출발지(`origins`)는 PoC `REGION_HUB` · `ORIGINS` 모양 그대로 두고 수단(`modes`)만 `지역거점.csv` · `출발지.csv`(전철 `metro` 포함) 값을 쓴다

### 추천과 데이터랩

- 테마 추천은 팀 명세서 「Tour Navigator 신규 설문 통합 상세명세서」 integrated 6.5(2026-09-29)의 설문 6.4 · 추천 6.5 참조 계산
  (Data-Analytics 저장소 `survey/implementation/score_survey.py` · `reference_calc/recommend_reference.py`)을
  프론트로 옮겨 네트워크 없이 계산한다(`features/recommend/survey.ts` · `theme-index.ts` · `features/home/citytour.ts`).
  명세서 예제 숫자와 Python 참조 계산 결과 300건(`features/recommend/data/reference-cases.json`)을 테스트로 고정한다.
  명세서 §01이 새 유형 이름 · 점수를 기존 recommendV4(백엔드 `POST /api/v1/recommend`)에 넘기지 않는다고 정했고 data-server에 이 API가 아직 없어서다.
  data-server가 API를 내면 그 API를 부르도록 바꿀 임시본이다(`docs/api.md`)
- 설문 6.4 · 추천 6.5 규칙 요약(괄호는 명세서 절). 6.1에서 바뀐 것: S4 바다 가산 C2 +1 · C3 +1 · C9 +4, 유형별 100점 환산, 경계 12점, F1 +20, 가중치 2^(차/12), C9 프로필, 시티투어 코스 점수(6.3 · 6.4),
  S4 관심사 두 가지 · 관심사 항 평균 · 지역 대표 5개의 관심사별 1자리 보장(6.4 · 6.5)

  | 단계      | 규칙                                                                                                                                                                                                                                             |
  | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | 문항      | 공통 S1~S6(필수, §05~§06. S4만 서로 다른 두 개를 고르고 두 보기 점수를 모두 더한다) + S4 두 관심사가 정한 분기 B1~B7 1~2개(B 번호 순, 같은 B는 한 번, §07~§10, 「없음」은 모든 유형 0점) + 필요할 때만 F1(§11). 건너뛰기 없음. 7~9문항           |
  | 점수      | 보기의 원점수를 유형마다 `원점수 × 100 / 최대 원점수`로 환산해 더한다(최대 원점수 = 한 경로(S4 두 관심사와 그 B)에서 그 유형이 받을 수 있는 가장 큰 원점수, C1 23 · C2 19 · C3 20 · C4 19 · C5 22 · C6 10 · C7 17 · C8 11 · C9 11 · C10 15, §12) |
  | F1        | S1~S6 + B 점수에서 최고점 12점 이내 유형 E₀가 2개 이상이면 한 번 묻는다. 보기 = E₀의 경험 설명(C 번호 순) + 「위 경험들이 비슷하게 중요해요」(E₀ 모두 20/\|E₀\|), 유형을 고르면 +20(100점 척도)                                                  |
  | 유형      | E = 최고점 12점 이내(점수 내림차순, 같으면 C 번호 순), α = 2^((s − smax)/12)를 E 안에서 나눈 값, R = 같은 식을 10개로 나눈 값. E가 1개면 단일형, 2개 이상이면 복합형(자르지 않는다, §12)                                                         |
  | 간접 선호 | u = Σ α · W̃(W = 유형별 5범주 프로필 표를 행 합으로 나눈 값, q_source = type_profile_prior, §13)                                                                                                                                                  |
  | 테마      | 지수 = 100 · (u · p̃ + 0.5 · r) / 1.5(p̃ = 테마 5범주 비중 ÷ 합, r = S4 두 관심사 중 자료가 있는 것의 평균(범주 비중 · 야경은 야경 비중, 드라마 · 공연 · 쇼핑은 빠지고 둘 다 없으면 0)), 상위 3개. 지역 · 한류 · 연령 · 인구통계 가산 0(§14 · §15) |

- 없앤 것: 국내 · 해외(Q6), 예산(Q7), 정보 경로(Q9), 앱 언어 가산, 국내면 C7~C10 제외, 여행 지역(Q15)과 데이터랩 TFI 보정(§04 · §38).
  여행 조건(Q10~Q14)은 설문이 아니라 테마 코스 탭 조건이다(`features/course/trip.ts`, 주소 형식은 그대로)
- 주소 `?a=`는 `s1.30s~s2.solo~…~s4.history_nature~…~b2.a~b3.none~f1.balanced`(문항 순서 고정, `answers.ts`). S4 두 관심사는 INTERESTS 순서로 `_`로 잇는다(`+`는 주소에서 공백이 된다).
  예전 15문항 형식(`q1.…`)과 S4 한 가지였던 설문 6.3 주소는 미완료로 읽혀 추천 기록 없음처럼 다룬다
- 결과 화면은 테마 3개 아래에 「나에게 맞는 지역 시티투어」 5개를 홈 내 유형 추천과 같은 계산(`recommendTourPicks`)으로 보인다(`features/recommend/ResultCityTours.tsx`, 카드는 `CityTourCard`).
- 결과 화면은 지수 1위 테마를 localStorage `tn.lastTopTheme`(`{ a, slug }`)에 적고, ME는 다시 계산하지 않고 이 값을 읽는다. ME · 알림의 유형은 E의 첫 유형이다
- 데이터랩 조회(TFI · 체류시간 · 코스 지역)는 테마 화면(여행 정보 탭 `features/theme/DatalabSection.tsx`)이 쓴다(`lib/api/datalab.ts`).
  TFI 막대는 `components/TfiBars.tsx`

### 홈 지역 시티투어

- 데이터 가공(분류 칩 · 내 유형 추천 · 지역 집계)은 `features/home/citytour.ts`, 경유지 → 플래너 장소 대조는 `citytour-match.ts`. 둘 다 목업(9/27 standalone) 규칙을 옮긴 순수 함수다
- 경유지 대조는 빌드 때 `scripts/build-citytour.mjs`가 미리 해서 노선마다 `placeIds`를 적는다(클라이언트가 3,109곳 · ct를 받지 않게). 노선 지역 이름과 같은 경유지(「서울 → … → 서울」)는 대조하지 않는다(목업과 다른 점)
- **실제 여행지**(`visits`, 2026-10-02): 원천의 도시(`region`)는 운영 지자체(출발지)라, 서울에서 출발해 경기 각지를 도는 EG투어버스 12노선이 「서울 12개 코스」로 집계됐다.
  빌드 때 `citytour-match.ts` `TOUR_VISITS`(운영 도시와 다른 노선만 노선별로 읽고 적은 표: EG투어버스 → 파주 · 안산 · 광명 · 시흥 · 화성 · 부천 · 김포 · 수원 · 평택 · 용인 · 포천 · 양평,
  대전 광역투어 → 대전 + 이웃 도시, 세종 천안연계 · 서천 광역코스)로 노선마다 `visits`를 적고, 없으면 운영 도시 하나. 자동 대조는 동명 장소 오탐(홍성 죽도 → 울릉 죽도, 화성행궁 → 화성시)이 많아 쓰지 않는다.
  지역별 검색 · 도시 칩 수 · 「n개 지역」 · 여행 정보 탭 시티투어 · 추천 카드의 지역 이름은 `visits`로 센다(`regionCounts` · `visitsCity` · `tourRegion` = 첫 여행지).
  내 유형 추천의 「한 지역 한 노선」만은 명세서 §16 · 참조 계산과 같게 운영 도시(`region`) 그대로다(참조 계산 테스트가 그 결과를 고정한다).
  카드는 운영 도시가 여행지와 다르면 「서울 출발 · 여행지 파주」 한 줄을 보인다. 그 결과 서울은 0개 코스라 칩이 없고(원천에 서울 시내 노선이 없다) 지역별 검색의 처음 지역은 첫 권역의 첫 도시다. 지역 수는 72 → 83(완주 힐링로드 1 · 2코스에 전주를 더해 2026-10-03)
- 부분 이름 대조도 목업보다 조였다(대표 결정 2026-09-28, 「해운대(미포)」가 해운대가야밀면 식당에 대조되던 오류): 이름이 같은 장소 → 이름이 서로를 품는 장소 중
  관광지(먹거리 밖)를 먼저, 먹거리는 시티투어 경유(`ct`) 장소 · 장소 이름이 경유지 이름으로 끝나는 곳(「광복로」 → 부산 광복로) · 시장 · 골목 · 거리 경유지일 때만.
  후보가 여럿이면 `ct` → 이름 길이 차이가 가장 작은 곳, 같은 순위면 대조하지 않는다. 경유지는 `+`로도 나눈다
- 「코스빌더에 넣기」는 `course-store`의 `replace`로 코스를 바꾸고 `/planner?tab=course`로 간다. 담아 둔 다른 코스가 있으면 먼저 묻는다
- 내 유형 추천은 `tn.lastRecommendation`의 답을 설문 6.4로 계산해(`evaluate`) 명세서 §16 코스 점수로 정렬한다(`recommendTourPicks` · `courseScore`).
  점수 = 100 · (cos(u, p) · 커버리지 + Σ w · b) / (1 + Σ w). 가산은 관심사 0.5(S4 두 관심사 중 분류가 있는 것의 평균: 범주 비중, 야경이면 야경 코스), 야경 0.1(S6 저녁 · 밤까지 · S4에 야경 없음),
  여행 속도 0.1(빡빡하게 L, 천천히 1 − L, L = 방문 후보 3곳 0 ~ 8곳 1)이고 적용되는 항만 분모에 넣는다. 점수가 같으면 cos · 커버리지 큰 순, 분석 코스 id 순.
  한 지역 한 노선씩 5개. 분류가 있는 관심사마다 그 분류 비중이 가장 큰 코스(같은 최댓값이면 모두, 야경은 야경 코스) 중 가장 앞 코스로 한 자리를 먼저 채우고(카드에 「○○ 픽」 칩),
  남은 자리를 순위대로 채워 순위 순서로 보인다. 제목의 유형은 E의 첫 유형이다.
  목록은 밑으로 늘리지 않고 오디오 해설처럼 좌우로 넘기는 카드다(`CityTourMore` → `components/ui/CardCarousel`: 한 장이 폭을 다 차지, 한 번에 한 장씩 걸림, 이전 · 다음 화살표와 「n / 전체」. 추천 결과 화면 · 지역별 검색도 같다. 대표 결정 2026-10-02, 그 전의 「처음 3곳 + 더 보기」(2026-09-30)를 바꿨다).
  지역별 검색의 도시 칩은 투어 플래너 도시 고르기와 같은 권역(수도권 · 강원권 · 충청권 · 경북권 · 경남권 · 전라권 · 제주권, 없으면 기타 지역)으로 묶는다
  (`regions.ts` `groupCities`: 권역 대표 도시 먼저, 나머지는 노선 많은 순). 권역 이름만 먼저 보이고 누르면 그 권역 도시 칩이 펼쳐진다(처음엔 고른 지역이 든 권역만 펼침).
  검색어는 묶음 안의 도시를 거르고, 검색 중에는 맞는 권역을 모두 펼친다
- 코스 점수 자료(p · 커버리지 · 방문 후보 수 · 야경)는 Data-Analytics `reference_calc/eligible_courses.csv`(분석 적격 234코스)를
  `scripts/build-citytour-scores.mjs`로 `data/citytour-scores.json`(citytour.json과 같은 순서, 적격이 아니면 null)에 옮긴다. 적격이 아닌 46노선은 지역별 검색에만 보인다.
  카드의 분류 칩은 목업 키워드 분류(`tourProfile` · `tourTags`) 그대로다

- 카드(`CityTourCard`)와 「코스빌더에 넣기」 확인 창(`useCityTourAdd`)은 `features/home/CityTourCard.tsx`에 있고 플래너 여행 정보 탭도 이것을 쓴다.
  경로는 3줄까지만 보이고, 잘린 글이 있으면(그려진 높이로 판단, `citytour.ts` `routeOverflows`) 「경로 전체 보기」 토글(`aria-expanded`)을 둔다

### 투어 플래너 여행 정보 탭 (`?tab=info`)

- 순서: 선택한 지역(도시 고르기 · 광역 관문) → 시티투어 → 숙소 → 축제 · 행사 → 관광안내소 → 이동 요령(`RoutingHowTo`) → 지역별 관광 안내 링크
- 도시를 고르지 않으면 시티투어 · 숙소 · 축제 · 행사 · 관광안내소는 서울을 보이고 개수 앞에 「기본 지역」을 붙인다(PoC `_dflt`)
- 시티투어(`InfoCityTours`, PoC `ctList`): 그 도시를 실제로 여행하는 노선(`visits`, 서울 출발 EG투어버스는 파주 · 안산 등에 보인다). 홈과 같은 카드를 좌우로 넘기는 카드 줄(`CardCarousel`)로(2026-10-02, 그 전의 처음 3개 + 「더 보기」 6개씩을 바꿨다). 출처의 기준일은 첫 노선의 기준일. 코스가 없으면 빈 상태 문구
- 숙소(`InfoStays`, 2026-10-02): 코스 빌더의 일자별 「숙박」(`CourseNightStay`: 그날 기준점 25km · 지정 · 해제)과 달리 고른 도시 전체의 숙소를 좌우로 넘기는 카드(`CardCarousel`)로. 앱 장소 목록의 숙박 장소(`cat === "stay"`, `pickCity` 없으면 `locKo`가 그 도시) 전부를 도심(`regions.json` 도시 좌표)에서 가까운 순으로, 그 뒤에 예시 숙소 표본(`data/stays.json`): 그 도시 region key(영어 이름 소문자)의 표본, 없으면 도심 25km 안, 가까운 순 최대 4곳(`info-stays.ts` `cityStays`, 서버 컴포넌트가 골라 카드에 쓰는 칸만 넘긴다). 카드: 이름 · 도시 · 분류(앱 장소는 체크인 안내 `hrs`, 표본은 동네 · 유형 + 「예시」 칩) · 도심 거리 · 「지도」(앱 장소 카카오맵, 표본 네이버 · Google 검색, 새 창) · 「숙박 예약 ▾」(오늘 → 내일, `stayBookingLinks`). 숙소가 없으면 빈 상태 문구
- 축제 · 행사(`InfoFestivals`, 2026-10-03): 브라우저가 `/api/tour/festival?city=&locale=`(`docs/api.md`, 한국관광공사 축제공연행사)를 부르고 좌우로 넘기는 카드(`CardCarousel`)로. 카드: 사진(있을 때, 보이는 카드에만) · 「진행 중」 · 「예정」 칩 · 제목 · 기간 · 주소 · 전화 · 「지도」(카카오맵 새 창).
  서버에 키가 없으면 칸을 두지 않고, 받는 동안 스켈레톤, 실패 · 결과 없음이면 빈 상태 문구. 문구 `Planner.info.festival`
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
  `name`은 ME가 장소 데이터(플래너 3,109곳)를 불러오지 않고 이름을 보이려고 저장할 때 적어 둔다. 읽기 · 쓰기는 `lib/local-store.ts`(`parseSavedPlaces` · `toggleSavedPlace` · `useSavedPlaces`)
- ME 「저장한 장소」는 저장한 순서대로, 누르면 테마는 `/themes/{slug}?tab=map&place={id}`, 플래너는 `/planner?place={id}`(시트가 열린 지도 탭)
- 다른 화면 · 다른 탭에서 장소 시트를 여는 링크(ME 저장한 장소, 홈 「지금 인기 관광지」, 테마 스탬프 · 영화 탭, 플래너 코스 탭)는 누를 때 그 탭의 sessionStorage에 장소 id를 남긴다(`lib/sheet-return.ts`).
  지도 탭은 처음 연 장소(`?place=`)와 표시가 같으면 시트를 닫을 때(X · Esc · 바깥) 뒤로 가기로 누른 자리에 돌아간다(스크롤 그대로).
  주소에 넣지 않는 것은 공유받은 주소로 연 사람이 시트를 닫을 때 앱 밖으로 나가지 않게 하려는 것이다.
  홈 인기 관광지의 고른 도시는 localStorage `tn.popularCity`에 둬서 돌아와도 같은 도시가 보인다.
  플래너 코스 탭의 장소 링크는 그래서 탭 바꾸기(replace)가 아니라 기록을 하나 쌓는다(뒤로 가기가 코스 탭으로 온다). 하단 탭 바 · 빈 코스의 「지도로」는 전처럼 replace다
- 테마 스탬프 탭 아래쪽 「저장한 장소」는 그 테마(`source`)에서 저장한 것만. 예전 테마별 북마크 `tn.bookmarks.{slug}`는 읽지 않는다
- 스탬프(`tn.stamps.{slug}`, `features/theme/storage.ts`)는 시트 · 스탬프 탭이 함께 쓰는 토글이다. PoC 코드(`d_toggleStamp`)에 위치 확인 규칙이 없어 위치를 보지 않는다

### 로그인 · 회원가입 (`features/auth`)

이메일 회원가입 · 로그인 · 로그아웃과 ME 맨 위 계정 카드(`AccountCard`)다. 백엔드 호출과 DTO 타입은 `auth-api.ts`, TanStack Query 훅은 `use-auth.ts`
(`useMe` — `["users", "me"]`, 토큰이 없으면 부르지 않고 null · 401이면 null, `useLogin` · `useSignup` · `useLogout`)이고,
입력 검사(`validate.ts`, 가입 규칙은 백엔드 DTO 그대로) · 실패 분류(`auth-error.ts`) · `?next=` 거르기(`next-path.ts`, 앱 안 경로만, 아니면 `/me`)는 테스트가 붙은 순수 함수다.
폼(`LoginForm` · `SignupForm`, 입력칸 `AuthField`)은 칸을 떠날 때와 제출할 때 검사하고 서버 오류는 제출 버튼 위 한 줄(`AuthAlert`)로 보인다.
토큰은 `lib/api/client.ts`가 localStorage에 두고, 저장한 플랜 · 장소는 로그인해도 지금처럼 이 브라우저에만 있다(서버 동기화 없음). 흐름과 오류 코드는 `docs/api.md` 「인증」
로그인 버튼 아래 「테스트 계정으로 로그인」(`useDemoLogin`)은 Route Handler `app/api/auth/demo/route.ts`가 서버 환경변수의 공용 테스트 계정(`demo-account.ts`)으로 대신 로그인한다. 환경변수가 없으면 버튼이 숨는다

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
