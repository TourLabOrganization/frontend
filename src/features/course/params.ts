// 체류 · 일정 계산 상수.
// 출처: Tour-Navigator-App/체류시간 산정/stay_schedule.js (상수 이름 · 값을 그대로 옮겼다)
// 대조: 산정_파라미터.csv (팀 카톡 원본 TalkFile_산정_파라미터-2.csv.csv). 각 줄의 "CSV" 주석이 대응하는 파라미터다.
// 두 원천의 값은 모두 같다. JS 안에 숫자로만 있던 값은 CSV 이름으로 여기에 모았다.
// CSV에만 있고 stay_schedule.js가 쓰지 않는 값(STAY_NEAR_KM 25, CATEGORY_DEFAULT[*])은 옮기지 않았다.
// stay_schedule.js의 stayMin은 min이 없으면 0(코스 제외)이고 분류 기본값을 쓰지 않는다.

// ── 일자 창 ──────────────────────────────────────────────────────────
/** 하루 활동 시작 09:00. CSV DAY_START 540 */
export const DAY_START = 9 * 60;
/** 하루 활동 종료 21:00. CSV DAY_END 1260 */
export const DAY_END = 21 * 60;
/** 하루 예산 720분. CSV DAY_MIN 720 */
export const DAY = DAY_END - DAY_START;
/** 출발지 출발 시각 기본값. CSV DEFAULT_DEP 08:00 */
export const DEFAULT_DEP = "08:00";
/** 여행지 출발(귀가) 시각 기본값. CSV DEFAULT_RET 19:00 */
export const DEFAULT_RET = "19:00";

// ── 거리 보정 ───────────────────────────────────────────────────────
/** 직선거리 → 도로거리 (대중교통 · 렌터카). CSV ROAD_FACTOR 1.35 */
export const DETOUR = 1.35;
/** 직선거리 → 도로거리 (자가용). CSV ROAD_FACTOR_OWN 1.3 */
export const DETOUR_CAR = 1.3;
/** 지구 반지름(km). straightKm. CSV에 없음 */
export const EARTH_RADIUS_KM = 6371;

// ── 시내 이동 (legInfo, 시군 안) ────────────────────────────────────
/** CSV TRANSIT_SHORT_KM 3 */
export const TRANSIT_SHORT_KM = 3;
/** CSV TRANSIT_SHORT_PER_KM 11 */
export const TRANSIT_SHORT_PER_KM = 11;
/** CSV TRANSIT_SHORT_MIN 10 */
export const TRANSIT_SHORT_MIN = 10;
/** CSV TRANSIT_BASE 15 */
export const TRANSIT_BASE = 15;
/** CSV TRANSIT_PER_KM 3.6 */
export const TRANSIT_PER_KM = 3.6;
/** CSV DRIVE_SHORT_KM 30 */
export const DRIVE_SHORT_KM = 30;
/** CSV DRIVE_SHORT_BASE 8 */
export const DRIVE_SHORT_BASE = 8;
/** CSV DRIVE_SHORT_PER_KM 2.2 */
export const DRIVE_SHORT_PER_KM = 2.2;
/** CSV DRIVE_BASE 20 */
export const DRIVE_BASE = 20;
/** CSV DRIVE_PER_KM 1.05 */
export const DRIVE_PER_KM = 1.05;
/** 구간 최소 이동시간. CSV LEG_MIN_FLOOR 8 (ownDriveMin 시내 구간 하한도 같은 값) */
export const LEG_MIN_FLOOR = 8;

// ── 광역 이동 (legInfo 시군 간 · accessMin) ─────────────────────────
/** CSV METRO_BASE 12 */
export const METRO_BASE = 12;
/** CSV METRO_PER_KM 0.95 */
export const METRO_PER_KM = 0.95;
/** 전철권 환승 여유. CSV METRO_XFER 15 */
export const METRO_XFER = 15;
/** CSV RAIL_BASE 18 */
export const RAIL_BASE = 18;
/** CSV RAIL_PER_KM 0.3 */
export const RAIL_PER_KM = 0.3;
/** CSV BUS_BASE 18 */
export const BUS_BASE = 18;
/** CSV BUS_PER_KM 0.55 */
export const BUS_PER_KM = 0.55;
/** 광역 구간 발권 · 대기. CSV WIDE_XFER 35 */
export const WIDE_XFER = 35;
/** CSV AIR_BASE 90 */
export const AIR_BASE = 90;
/** CSV AIR_PER_KM 0.11 */
export const AIR_PER_KM = 0.11;
/** CSV SHIP_BASE 60 */
export const SHIP_BASE = 60;
/** CSV SHIP_PER_KM 0.85 */
export const SHIP_PER_KM = 0.85;

// ── 자가용 (ownDriveMin) ────────────────────────────────────────────
/** CSV OWN_CITY_KM 20 */
export const OWN_CITY_KM = 20;
/** CSV OWN_CITY_KMH 35 */
export const OWN_CITY_KMH = 35;
/** 고속도로 진출입. CSV OWN_RAMP_MIN 15 */
export const OWN_RAMP_MIN = 15;
/** 고속도로 표정속도(한국도로공사). CSV OWN_HWY_KMH 92 */
export const OWN_HWY_KMH = 92;
/** CSV OWN_REST_EVERY 120 */
export const OWN_REST_EVERY = 120;
/** CSV OWN_REST_MIN 15 */
export const OWN_REST_MIN = 15;

// ── 자동 코스 ───────────────────────────────────────────────────────
/** 시군을 넘어갈 때 더하는 환승 여유. CSV HOP_MIN 45 */
export const HOP = 45;
/** 자동 코스 최대 경유지. CSV AUTO_MAX_STOPS 18 */
export const MAX_STOPS = 18;
/** 확장(목록 외) 장소 순위 페널티(분). CSV OFF_LIST_PENALTY 26 */
export const OFF_LIST_PENALTY = 26;
/** 영상 장소 순위 우대(분). CSV VIDEO_BONUS 14 */
export const VIDEO_BONUS = 14;
/** 시군 가중치 = 영상 장소 수 × VIDEO_WEIGHT + min(장소 수, PLACE_WEIGHT_CAP). CSV에 없음 */
export const VIDEO_WEIGHT = 2;
export const PLACE_WEIGHT_CAP = 8;
/** 순번이 없는 장소의 순번. CSV에 없음 */
export const NO_ORDER = 99;
/** 한 시군에 담는 곳 수 = max(REGION_MIN_STOPS, 배분일수 × STOPS_PER_DAY). CSV에 없음 */
export const REGION_MIN_STOPS = 2;
export const STOPS_PER_DAY = 3;
