import { tourFestivalResponse } from "@/lib/tour-festival";

// 여행 정보 탭 「{도시} 축제 · 행사」 칸. 한국관광공사 축제공연행사 조회를 서버 키(DATA_GO_KR_KEY)로 서버에서 부른다(AGENTS.md 3).
// 입력은 도시 이름과 화면 언어뿐이다. 규칙 · 응답은 lib/tour-festival.ts
export async function GET(request: Request) {
  return tourFestivalResponse(request);
}
