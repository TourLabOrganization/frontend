// 지도 「내 위치」의 위치 받기 규칙. PoC 테마 화면 locate()(Tour-Navigator-App *Route.dc.html)의 값을 그대로 쓴다.
// 위치는 화면에 점으로만 그리고 저장하지 않는다.

/** navigator.geolocation.getCurrentPosition 옵션 (PoC 값) */
export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 60000,
};

/** 정확도 원 반지름(m). 정확도가 없으면 120m, 60m ~ 3km로 자른다 (PoC meCircle.setRadius) */
export function accuracyRadius(accuracy: number | null | undefined): number {
  return Math.min(Math.max(accuracy || 120, 60), 3000);
}

/** 위치를 받지 못한 이유. insecure = HTTPS가 아니거나 브라우저에 위치 기능이 없음 */
export type LocateFailure = "insecure" | "denied" | "unavailable";

/** GeolocationPositionError.code → 이유 (1 = 권한 거부, 2 · 3 = 위치 없음 · 시간 초과) */
export function locateFailure(code: number): LocateFailure {
  return code === 1 ? "denied" : "unavailable";
}

/** 이 환경에서 위치를 물을 수 있는지 (PoC: navigator.geolocation과 window.isSecureContext) */
export function canLocate(env: {
  isSecureContext: boolean;
  hasGeolocation: boolean;
}): boolean {
  return env.isSecureContext && env.hasGeolocation;
}
