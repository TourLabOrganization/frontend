// 장소 시트 날씨 칸의 「미세먼지」 줄. 한국환경공단 에어코리아 대기오염정보(ArpltnInforInqireSvc getCtprvnRltmMesureDnsty)를
// Route Handler(app/api/air)가 서버 키(DATA_GO_KR_KEY)로 부르고, 장소 시트(components/ui/PlaceWeather)가 그 결과를 그린다.
// PoC shared.js getAirQuality와 같은 규칙:
//   장소의 시도 → 그 시도 모든 측정소의 PM10 · PM2.5 평균(반올림) → 둘 중 나쁜 등급.
//   시도는 장소의 시군구 코드(앞 2자리)로 정하고, 코드가 없는 장소만 PoC처럼 가장 가까운 시도청(SIDO_CENTERS)으로 정한다
//   (가까운 시도청만 쓰면 경주가 울산, 속초가 강원 대신 다른 시도가 되는 경계 문제가 있어 코드를 먼저 본다).
//   측정소 하나를 고르지 않는다(시도 평균). 등급은 환경부 통합 기준(PM10 30 · 80 · 150, PM2.5 15 · 35 · 75)
// 여기에는 서버 · 화면이 함께 쓰는 순수 함수만 둔다(키를 읽지 않는다). 테스트가 "@/" 경로를 풀지 못해 상대 경로만 쓴다.
import { KOREA_BOUNDS, roundCoord } from "./weather";

/** 에어코리아 시도별 실시간 측정정보 주소 */
export const AIR_KOREA_URL =
  "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty";
/** 호출 시간 제한(ms) */
export const AIR_TIMEOUT_MS = 8000;
/** 같은 시도를 다시 받는 간격(초). 측정값은 1시간마다 바뀌고 PoC도 30분 캐시한다 */
export const AIR_REVALIDATE_SECONDS = 1800;

/** 시도 이름(에어코리아 sidoName 값)과 시도청 좌표(PoC SIDO_CENTERS 그대로) */
export const SIDO_CENTERS = [
  ["서울", 37.5665, 126.978],
  ["부산", 35.1796, 129.0756],
  ["대구", 35.8714, 128.6014],
  ["인천", 37.4563, 126.7052],
  ["광주", 35.1595, 126.8526],
  ["대전", 36.3504, 127.3845],
  ["울산", 35.5384, 129.3114],
  ["세종", 36.48, 127.289],
  ["경기", 37.4138, 127.5183],
  ["강원", 37.8228, 128.1555],
  ["충북", 36.6357, 127.4917],
  ["충남", 36.5184, 126.8],
  ["전북", 35.7175, 127.153],
  ["전남", 34.8679, 126.991],
  ["경북", 36.4919, 128.8889],
  ["경남", 35.4606, 128.2132],
  ["제주", 33.4996, 126.5312],
] as const;

export type Sido = (typeof SIDO_CENTERS)[number][0];

/** 두 좌표 사이 거리(km, 하버사인) */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** 좌표에서 가장 가까운 시도청의 시도(PoC nearestSido). 같은 거리면 표의 앞 시도 */
export function nearestSido(lat: number, lng: number): Sido {
  let best: Sido = SIDO_CENTERS[0][0];
  let min = Infinity;
  for (const [name, la, ln] of SIDO_CENTERS) {
    const d = haversineKm(lat, lng, la, ln);
    if (d < min) {
      min = d;
      best = name;
    }
  }
  return best;
}

/**
 * 시군구 코드 앞 2자리 → 시도(행정표준코드). 옛 강원 42 · 전북 45와 새 강원 51 · 전북 52를 모두 받는다.
 * 장소 자료는 광주 · 전남을 하나의 코드 12로 적어 두어(전남광주 통합 코드) 12는 둘 중 가까운 시도청으로 가른다
 */
const SIDO_BY_CODE: Readonly<Record<string, Sido>> = {
  "11": "서울",
  "26": "부산",
  "27": "대구",
  "28": "인천",
  "29": "광주",
  "30": "대전",
  "31": "울산",
  "36": "세종",
  "41": "경기",
  "42": "강원",
  "51": "강원",
  "43": "충북",
  "44": "충남",
  "45": "전북",
  "52": "전북",
  "46": "전남",
  "47": "경북",
  "48": "경남",
  "50": "제주",
};

/** 장소의 시도: 시군구 코드가 있으면 그 코드(12는 광주 · 전남 중 가까운 쪽), 없거나 모르는 코드면 가장 가까운 시도청 */
export function sidoOf(signgu: string, lat: number, lng: number): Sido {
  const prefix = signgu.slice(0, 2);
  if (prefix === "12") {
    const near = (s: Sido) => {
      const c = SIDO_CENTERS.find(([n]) => n === s)!;
      return haversineKm(lat, lng, c[1], c[2]);
    };
    return near("광주") <= near("전남") ? "광주" : "전남";
  }
  return SIDO_BY_CODE[prefix] ?? nearestSido(lat, lng);
}

/** 쿼리의 lat · lng를 검사한다(한국 범위 밖 · 숫자 아님이면 null). 통과하면 소수 2자리 좌표 */
export function parseAirQuery(
  lat: string | null,
  lng: string | null,
): { lat: number; lng: number } | null {
  if (lat === null || lng === null || !lat.trim() || !lng.trim()) return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  const b = KOREA_BOUNDS;
  if (la < b.minLat || la > b.maxLat || ln < b.minLng || ln > b.maxLng)
    return null;
  return { lat: roundCoord(la), lng: roundCoord(ln) };
}

/** 에어코리아 호출 주소(키는 서버가 넘긴다) */
export function airKoreaUrl(key: string, sido: Sido): string {
  const url = new URL(AIR_KOREA_URL);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("returnType", "json");
  url.searchParams.set("numOfRows", "200");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("sidoName", sido);
  url.searchParams.set("ver", "1.3");
  return url.toString();
}

/** 등급 1 좋음 · 2 보통 · 3 나쁨 · 4 매우나쁨. 값이 없으면 0 */
export type AirGrade = 0 | 1 | 2 | 3 | 4;

/** PM10 등급(PoC g10: 30 · 80 · 150 이하) */
export function pm10Grade(v: number | null): AirGrade {
  if (v === null) return 0;
  return v <= 30 ? 1 : v <= 80 ? 2 : v <= 150 ? 3 : 4;
}

/** PM2.5 등급(PoC g25: 15 · 35 · 75 이하) */
export function pm25Grade(v: number | null): AirGrade {
  if (v === null) return 0;
  return v <= 15 ? 1 : v <= 35 ? 2 : v <= 75 ? 3 : 4;
}

/** GET /api/air 응답 */
export type AirQuality = {
  /** 시도(에어코리아 sidoName) */
  sido: Sido;
  /** 시도 측정소 평균(㎍/㎥, 반올림). 값이 없으면 null */
  pm10: number | null;
  pm25: number | null;
  /** 두 등급 중 나쁜 쪽 */
  grade: AirGrade;
  /** 평균에 쓴 측정소 수 */
  stations: number;
  /** 측정 시각(에어코리아 dataTime, 「2026-09-29 14:00」). 없으면 "" */
  at: string;
};

/** 측정값 문자열 → 숫자. 빈 값 · 「-」 · 숫자 아님은 null */
function measure(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function average(values: (number | null)[]): number | null {
  const ok = values.filter((v): v is number => v !== null);
  return ok.length
    ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length)
    : null;
}

/**
 * 에어코리아 응답 → 시도 평균(PoC getAirQuality). 항목은 response.body.items(배열)이다(TourAPI의 items.item과 다르다).
 * resultCode가 00이 아니거나 모양이 다르면 null, 두 값이 모두 없어도 null(화면은 줄을 숨긴다)
 */
export function toAirQuality(body: unknown, sido: Sido): AirQuality | null {
  const response = (body as { response?: unknown } | null)?.response;
  if (typeof response !== "object" || response === null) return null;
  const { header, body: inner } = response as {
    header?: { resultCode?: unknown };
    body?: { items?: unknown };
  };
  const code = String(header?.resultCode ?? "");
  if (code !== "00" && code !== "0000") return null;
  const items = Array.isArray(inner?.items)
    ? (inner.items as unknown[]).filter(
        (x): x is Record<string, unknown> =>
          typeof x === "object" && x !== null,
      )
    : [];
  const pm10 = average(items.map((x) => measure(x.pm10Value)));
  const pm25 = average(items.map((x) => measure(x.pm25Value)));
  if (pm10 === null && pm25 === null) return null;
  const grade = Math.max(pm10Grade(pm10), pm25Grade(pm25)) as AirGrade;
  return {
    sido,
    pm10,
    pm25,
    grade,
    stations: items.length,
    at: String(items[0]?.dataTime ?? ""),
  };
}

/** 브라우저가 부르는 우리 주소. 플래너 장소 id가 있으면 서버가 그 장소의 시군구 코드로 시도를 정한다 */
export function airPath(lat: number, lng: number, id?: string): string {
  const base = `/api/air?lat=${roundCoord(lat)}&lng=${roundCoord(lng)}`;
  return id ? `${base}&id=${encodeURIComponent(id)}` : base;
}
