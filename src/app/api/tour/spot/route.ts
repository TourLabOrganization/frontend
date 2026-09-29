import { tourSpotResponse } from "@/lib/tour-spot";

// 신규 관광지(kto:<contentid>) 한 곳. 한국관광공사 국문 관광정보 공통정보를 서버 키(DATA_GO_KR_KEY)로 부른다(AGENTS.md 3).
// 입력은 kto: id뿐이다. 규칙 · 응답은 lib/tour-spot.ts
export async function GET(request: Request) {
  return tourSpotResponse(request);
}
