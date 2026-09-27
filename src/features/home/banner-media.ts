import type { ThemeSlug } from "@/features/recommend/themes";

export type BannerVideo = {
  /** 유튜브 영상 id */
  id: string;
  /** 시작 지점(초) */
  start: number;
  /** 영상이 뜨기 전과 움직임 줄이기 설정일 때 보이는 썸네일 */
  poster: string;
  /** iframe 제목(영상 제목) */
  title: string;
};

// 배너 슬라이드 배경 영상. 영상이 없는 슬라이드는 작품 스틸(features/recommend/works.ts)을 쓴다.
// RESCENE Route: 「너 도와주러 온거야」(경주 한옥 골목 · 경주월드) — PoC RESCENE 영상 목록(RESCENE Route.dc.html VMETA)의
// 경주 영상 중 유튜브 「유료 광고 포함」 안내가 뜨지 않는 영상. 조회수가 더 많은 「경주에서 올라온 아이돌」 ·
// 「제나야 말 좀 해라」는 그 안내가 화면 위에 계속 떠서 배너 글자를 가리고, 광고 표시를 잘라 숨길 수는 없어 쓰지 않는다.
// 55초부터 한옥 골목 장면. 외부 삽입 허용은 oEmbed 응답으로 확인했다(2026-09-27).
// 포스터는 같은 테마의 촬영지 동궁과 월지 사진(Wikimedia Commons, 홈 아래 출처 줄에 표기)
export const BANNER_VIDEO: Partial<Record<ThemeSlug, BannerVideo>> = {
  "rescene-route": {
    id: "hqSzEdrSpno",
    start: 55,
    poster:
      "https://commons.wikimedia.org/wiki/Special:FilePath/%EB%8F%99%EA%B6%81%EA%B3%BC_%EC%9B%94%EC%A7%80.jpg?width=960",
    title: "너 도와주러 온거야",
  },
};

/** 소리 없이 자동 재생 · 반복하는 배경용 삽입 주소 */
export function bannerVideoSrc({ id, start }: BannerVideo): string {
  const q = new URLSearchParams({
    start: String(start),
    autoplay: "1",
    mute: "1",
    controls: "0",
    loop: "1",
    playlist: id,
    playsinline: "1",
    rel: "0",
    disablekb: "1",
    iv_load_policy: "3",
    fs: "0",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${q.toString()}`;
}
