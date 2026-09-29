import {
  AIRPORT_PROCESS_REVALIDATE_SECONDS,
  AIRPORT_PROCESS_TIMEOUT_MS,
  airportProcessUrl,
  toAirportProcess,
} from "@/lib/airport-process";

// 플래너 항공편 카드의 「지금 수속 소요」. 한국공항공사 공항 소요시간을 서버 키(DATA_GO_KR_KEY)로 서버에서 부른다(AGENTS.md 3).
// 공공데이터포털에서 「한국공항공사_공항 소요시간 정보」 활용신청이 필요하다. 키가 없으면 503, 외부 실패면 502 — 카드는 그 칸을 숨긴다.
// 입력이 없다(5개 공항을 한 번에 받는다). 규칙은 lib/airport-process.ts
export async function GET() {
  const key = process.env.DATA_GO_KR_KEY?.trim();
  if (!key)
    return Response.json({ message: "not configured" }, { status: 503 });
  try {
    const res = await fetch(airportProcessUrl(key), {
      signal: AbortSignal.timeout(AIRPORT_PROCESS_TIMEOUT_MS),
      // 공사가 5분마다 갱신한다. 그 안에는 모든 사용자가 한 번의 호출을 함께 쓴다
      next: { revalidate: AIRPORT_PROCESS_REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(`airport ${res.status}`);
    const body = toAirportProcess(await res.json());
    if (!body) throw new Error("airport shape");
    return Response.json(body, {
      headers: {
        "Cache-Control": `public, max-age=${AIRPORT_PROCESS_REVALIDATE_SECONDS}`,
      },
    });
  } catch {
    // 원래 오류에는 키가 든 주소가 섞일 수 있어 버린다
    return Response.json({ message: "airport unavailable" }, { status: 502 });
  }
}
