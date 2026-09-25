# PoC에서 가져오기

`TourLabOrganization/Tour-Navigator-App`은 PoC(개념 증명)다.
어떤 기능과 데이터, 화면 흐름이 필요한지 확인하는 참고 자료이고, 코드 · 구조 · 디자인을 그대로 옮기지 않는다.

최신 PoC는 `main`보다 앞선 작업 브랜치에 있을 수 있다. 팀 시스템 구성도(2026-09-25 초안)의 기준 브랜치는
`claude/brave-dirac-zmdr4p`이고, 키를 `config.js`로 뺀 코드와 날씨 · 대기질 · 축제 · TMDB 연동이 여기에 있다.
참고하기 전에 `git fetch`로 브랜치를 확인한다.

| PoC                                                      | 이 리포에서                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 화면마다 `*.dc.html` 한 파일에 템플릿과 로직이 함께 있다 | 라우트(`src/app/`)와 기능 폴더(`src/features/<기능>/`)로 나눈다                                                                 |
| `DATA` · `STAYS` · `TRANSIT` 같은 데이터 상수            | 백엔드나 데이터 서버 API가 생기기 전까지는 `src/features/<기능>/data/`에 JSON으로 두고, 생기면 API 호출로 바꾼다                |
| `I18N` 레이어                                            | 화면 문구는 `messages/`로, 장소 이름 번역은 데이터 쪽으로 (`docs/i18n.md`)                                                      |
| `config.js`(`APP_CONFIG`)로 읽는 API 키                  | 환경변수와 Route Handler (`docs/security.md`)                                                                                   |
| CORS 프록시(계획) — Cloudflare Workers / Vercel Function | Route Handler가 그 역할을 한다 (`docs/security.md`)                                                                             |
| Google Maps 스크립트 직접 로드                           | `@vis.gl/react-google-maps` (`docs/stack.md`)                                                                                   |
| 인라인 `style=""`                                        | Tailwind 클래스와 토큰 (`docs/ui.md`)                                                                                           |
| `테마 추천 알고리즘/`(Python 오프라인 파이프라인)        | 파이프라인은 옮기지 않는다. 결과물 `data/derived/*.json`을 받아, 선호 문항 응답으로 군집을 판정하는 점수 계산만 프론트에서 한다 |

PoC 화면을 옮길 때는 먼저 PoC의 `README.md` · `ARCHITECTURE.md` · `APIS.md`로 기능을 파악하고,
옮길 범위를 PR 설명에 적는다.
