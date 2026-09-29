import { tourAudioResponse } from "@/lib/tour-audio";

// 장소 시트의 오디오 가이드 칸. 브라우저는 이 주소만 부르고, 한국관광공사 오디오 가이드(오디)는 서버 키(DATA_GO_KR_KEY)로 서버에서 부른다(AGENTS.md 3).
// 입력은 장소 id와 화면 언어뿐이다. 규칙 · 응답은 lib/tour-audio.ts(테스트가 "@/" 경로를 풀지 못해 처리를 그쪽에 둔다)
export async function GET(request: Request) {
  return tourAudioResponse(request);
}
