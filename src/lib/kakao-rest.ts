// 카카오 REST API 키(KAKAO_REST_KEY, 서버 전용). 장소 대표 사진(tour-photo.ts ⑥)과 코스 지도 도로 경로(road-route.ts)가 함께 쓴다.
// 테스트(vitest)가 "@/" 경로를 풀지 못해 쓰는 쪽은 상대 경로로 import한다.

/** 카카오 REST API 키(서버 전용). 없으면 null */
export function kakaoRestKey(): string | null {
  const key = process.env.KAKAO_REST_KEY?.trim();
  return key ? key : null;
}
