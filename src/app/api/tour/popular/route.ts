import { loadNameTable } from "@/features/names/server";
import { tourPopularResponse } from "@/lib/tour-popular";

// 홈 「지금 인기 관광지」. 한국관광공사 관광지 집중률 방문자 추이 예측을 서버 키(DATA_GO_KR_KEY)로 시군구 단위로 부른다(AGENTS.md 3).
// 입력은 도시(홈 칩 10곳 중 하나)와 화면 언어뿐이다. 규칙 · 응답은 lib/tour-popular.ts(테스트가 "@/" 경로를 풀지 못해 처리를 그쪽에 둔다)
export async function GET(request: Request) {
  return tourPopularResponse(request, loadNameTable);
}
