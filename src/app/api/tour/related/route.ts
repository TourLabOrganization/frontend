import { tourRelatedResponse } from "@/lib/tour-related";

// 장소 시트의 「함께 많이 가는 관광지 Top」 칸. 한국관광공사 관광지별 연관 관광지를 서버 키(DATA_GO_KR_KEY)로 서버에서 부른다(AGENTS.md 3).
// 입력은 장소 id와 화면 언어뿐이다. 규칙 · 응답은 lib/tour-related.ts(테스트가 "@/" 경로를 풀지 못해 처리를 그쪽에 둔다)
export async function GET(request: Request) {
  return tourRelatedResponse(request);
}
