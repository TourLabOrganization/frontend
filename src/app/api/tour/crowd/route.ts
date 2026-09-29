import { tourCrowdResponse } from "@/lib/tour-crowd";

// 장소 시트의 「방문 집중률 예측」 칸. 한국관광공사 관광지 집중률 방문자 추이 예측을 서버 키(DATA_GO_KR_KEY)로 서버에서 부른다(AGENTS.md 3).
// 입력은 장소 id뿐이다. 규칙 · 응답은 lib/tour-crowd.ts(테스트가 "@/" 경로를 풀지 못해 처리를 그쪽에 둔다)
export async function GET(request: Request) {
  return tourCrowdResponse(request);
}
