// 투어 플래너 항공편 카드의 「지금 수속 소요」. 한국공항공사 공항 소요시간(B551178 airport-process-time/v1)을
// Route Handler(app/api/airport/process)가 서버 키(DATA_GO_KR_KEY)로 부르고, 카드(features/planner/FlightCard)가 그린다.
// PoC Tour Planner.dc.html getAirportProcess와 같은 규칙: STY_TCT_AVG_*는 초 → 분(반올림).
//   A 체크인→신분확인 · B 신분확인→보안검색 · C 보안검색→탑승 · D 탑승→출발 · ALL 합계. 김포 · 제주 · 김해 · 청주 · 대구만 제공된다
// 여기에는 서버 · 화면이 함께 쓰는 순수 함수만 둔다(키를 읽지 않는다). 테스트가 "@/" 경로를 풀지 못해 상대 경로만 쓴다.

/** 한국공항공사 공항 소요시간 주소 */
export const AIRPORT_PROCESS_URL =
  "https://apis.data.go.kr/B551178/airport-process-time/v1";
/** 호출 시간 제한(ms) */
export const AIRPORT_PROCESS_TIMEOUT_MS = 8000;
/** 다시 받는 간격(초). 공사가 5분 단위로 갱신한다(PoC도 5분 캐시) */
export const AIRPORT_PROCESS_REVALIDATE_SECONDS = 300;
/** 소요시간을 주는 공항 */
export const PROCESS_AIRPORTS = ["GMP", "CJU", "PUS", "CJJ", "TAE"] as const;

/** 한 공항의 지금 수속 소요(분) */
export type AirportProcess = {
  all: number;
  a: number;
  b: number;
  c: number;
  d: number;
  /** 집계 시각(PRC_HR 원문). 없으면 "" */
  at: string;
};

/** GET /api/airport/process 응답: 공항 IATA → 소요 */
export type AirportProcessResponse = Record<string, AirportProcess>;

/** 호출 주소(키는 서버가 넘긴다) */
export function airportProcessUrl(key: string): string {
  const url = new URL(AIRPORT_PROCESS_URL);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("numOfRows", "50");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("type", "json");
  return url.toString();
}

const minutes = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n / 60) : 0;
};

/**
 * 응답 → 공항별 소요(PoC getAirportProcess). 항목은 response.body.items.item(배열 · 객체 하나).
 * resultCode가 있으면 00 · 0000이어야 한다. 모양이 다르거나 알아볼 공항이 하나도 없으면 null
 */
export function toAirportProcess(body: unknown): AirportProcessResponse | null {
  const response = (body as { response?: unknown } | null)?.response;
  if (typeof response !== "object" || response === null) return null;
  const { header, body: inner } = response as {
    header?: { resultCode?: unknown };
    body?: { items?: unknown };
  };
  const code = header?.resultCode;
  if (code !== undefined && !["00", "0000"].includes(String(code))) return null;
  const items = inner?.items;
  const item =
    typeof items === "object" && items !== null
      ? (items as { item?: unknown }).item
      : undefined;
  const list = (Array.isArray(item) ? item : item ? [item] : []).filter(
    (x): x is Record<string, unknown> => typeof x === "object" && x !== null,
  );
  const out: AirportProcessResponse = {};
  for (const x of list) {
    const apt = String(x.IATA_APCD ?? "");
    if (!(PROCESS_AIRPORTS as readonly string[]).includes(apt)) continue;
    out[apt] = {
      all: minutes(x.STY_TCT_AVG_ALL),
      a: minutes(x.STY_TCT_AVG_A),
      b: minutes(x.STY_TCT_AVG_B),
      c: minutes(x.STY_TCT_AVG_C),
      d: minutes(x.STY_TCT_AVG_D),
      at: String(x.PRC_HR ?? ""),
    };
  }
  return Object.keys(out).length ? out : null;
}

/** 탑승 마감 여유(분). 공항 도착 → 탑승까지 = 수속 + 20분, 최소 30분(PoC aptLeadMin) */
export const BOARDING_BUFFER_MIN = 20;
export const MIN_AIRPORT_LEAD_MIN = 30;

/** 공항 도착 → 탑승까지 잡을 시간(분). 실측 수속 + 20분, 최소 30분 */
export function airportLeadMin(p: Pick<AirportProcess, "all">): number {
  return Math.max(MIN_AIRPORT_LEAD_MIN, p.all + BOARDING_BUFFER_MIN);
}
