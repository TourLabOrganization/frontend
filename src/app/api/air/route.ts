import {
  AIR_REVALIDATE_SECONDS,
  AIR_TIMEOUT_MS,
  airKoreaUrl,
  parseAirQuery,
  sidoOf,
  toAirQuality,
} from "@/lib/air-quality";
import { tourPlaceSigngu } from "@/lib/tour-api";

// 장소 시트 날씨 칸의 「미세먼지」 줄. 한국환경공단 에어코리아 대기오염정보를 서버 키(DATA_GO_KR_KEY)로 서버에서 부른다(AGENTS.md 3).
// 공공데이터포털에서 「한국환경공단_에어코리아_대기오염정보」 활용신청이 필요하다. 키가 없으면 503, 외부 실패면 502 — 화면은 줄을 숨긴다.
// 입력은 좌표(와 있으면 플래너 장소 id)뿐이고, 서버가 장소의 시군구 코드 또는 가장 가까운 시도청으로 17개 시도 중 하나를 정해 부른다
// (아무 시도나 대신 불러 주는 중계가 되지 않게). 규칙은 lib/air-quality.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coord = parseAirQuery(searchParams.get("lat"), searchParams.get("lng"));
  if (!coord)
    return Response.json({ message: "invalid lat/lng" }, { status: 400 });
  const key = process.env.DATA_GO_KR_KEY?.trim();
  if (!key)
    return Response.json({ message: "not configured" }, { status: 503 });

  const id = searchParams.get("id") ?? "";
  const sido = sidoOf(tourPlaceSigngu(id), coord.lat, coord.lng);
  try {
    const res = await fetch(airKoreaUrl(key, sido), {
      signal: AbortSignal.timeout(AIR_TIMEOUT_MS),
      // 측정값은 1시간마다 바뀐다. 같은 시도는 30분 동안 다시 부르지 않는다(시도 안의 장소가 한 번의 호출을 함께 쓴다)
      next: { revalidate: AIR_REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(`air ${res.status}`);
    // 키가 틀리거나 활용신청을 하지 않았으면 returnType=json이어도 XML 오류가 온다
    const body = toAirQuality(await res.json(), sido);
    if (!body) throw new Error("air shape");
    return Response.json(body, {
      headers: {
        "Cache-Control": `public, max-age=${AIR_REVALIDATE_SECONDS}`,
      },
    });
  } catch {
    // 원래 오류에는 키가 든 주소가 섞일 수 있어 버린다
    return Response.json({ message: "air unavailable" }, { status: 502 });
  }
}
