"use client";

import { createContext, useContext } from "react";

// 서버에 공공데이터포털 키(DATA_GO_KR_KEY)가 있는지. 루트 레이아웃이 서버에서 확인해 참 · 거짓만 내려 준다(키 값은 내려 주지 않는다).
// 키가 없으면 장소 시트의 한국관광공사 칸(PlaceTour)이 Route Handler를 부르지 않는다. 503 응답이 브라우저 콘솔 오류로 남지 않고 칸이 조용히 숨는다.
// 한국어 화면의 오디오 가이드 칸만 키 없이도 부른다(한국어 스토리텔링 대체, lib/tour-audio.ts)
const TourApiContext = createContext(false);

export function TourApiProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return <TourApiContext value={enabled}>{children}</TourApiContext>;
}

/** 서버에 공공데이터포털 키가 있는지 */
export function useTourApi(): boolean {
  return useContext(TourApiContext);
}
