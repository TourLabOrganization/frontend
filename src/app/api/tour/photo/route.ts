import { tourPhotoResponse } from "@/lib/tour-photo";

// 장소 시트의 대표 사진(장소 자료에 사진이 없는 곳만). 한국관광공사 관광정보 · 관광사진은 서버 키(DATA_GO_KR_KEY)로, 위키백과는 키 없이 서버에서 부른다(AGENTS.md 3).
// 입력은 장소 id뿐이다. 규칙 · 응답은 lib/tour-photo.ts(테스트가 "@/" 경로를 풀지 못해 처리를 그쪽에 둔다)
export async function GET(request: Request) {
  return tourPhotoResponse(request);
}
