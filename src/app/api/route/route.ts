import { roadRouteResponse } from "@/lib/road-route";

// 코스 지도의 도로 경로. 카카오모빌리티 자동차 길찾기를 서버 키(KAKAO_REST_KEY)로 서버에서 부른다(AGENTS.md 3).
// 입력은 한국 안 좌표 두 개(from · to)와 by=distance뿐이다. 카카오 정책상 결과를 서버에 저장하지 않는다(private, 브라우저 1시간 · 앱은 실행 동안 메모리).
// 그래서 같은 요청도 매번 카카오를 불러, 다른 사이트 페이지의 브라우저 요청은 403, IP마다 상한을 넘으면 429로 막는다.
// 규칙 · 응답은 lib/road-route.ts(테스트가 "@/" 경로를 풀지 못해 처리를 그쪽에 둔다)
export async function GET(request: Request) {
  return roadRouteResponse(request);
}
