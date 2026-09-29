import type { ThemeSlug } from "@/features/recommend/themes";

export type BannerVideo = {
  /** 유튜브 영상 id */
  id: string;
  /** 시작 지점(초) */
  start: number;
  /** 영상이 뜨기 전과 움직임 줄이기 설정일 때 보이는 썸네일 */
  poster: string;
  /** 영상 원제목(참고용. 화면에는 쓰지 않는다) */
  title: string;
  /** iframe 제목의 messages 키(Home.bannerVideo.*). 원제목은 한국어뿐이라 화면 언어 문구로 붙인다 */
  titleKey: "resceneGeoje";
};

// 배너 슬라이드 배경 영상. 영상이 없는 슬라이드는 작품 스틸(features/recommend/works.ts)을 쓴다.
// RESCENE Route: 「갸루와 거제에 왔습니다 (거제 1편)」(원이 채널 「안녕하세요원이입니다잘부탁드립니다」) —
// 599초(9:59)부터 거제 항구 부두를 함께 걷는 장면. 영상 자막 「원이의 거제 투어」로 원이 영상임을 확인했다. 대표 선택(2026-09-29).
// 이전 영상(왕구랜드 절친소 EP1, 2026-09-28)과 달리 이 영상은 유튜브 「유료 프로모션 포함」 안내가 붙는다(watch 페이지 paidContentOverlay).
// 외부 삽입 허용은 oEmbed · playableInEmbed로 확인했다(2026-09-29).
// 포스터는 같은 테마의 거제 촬영지 해금강 사진(Wikimedia Commons, 홈 아래 출처 줄에 표기)
export const BANNER_VIDEO: Partial<Record<ThemeSlug, BannerVideo>> = {
  "rescene-route": {
    id: "OrCOflk2QmQ",
    start: 599,
    poster:
      "https://commons.wikimedia.org/wiki/Special:FilePath/KOCIS_Korea_Haegeumgang_08_%2810011695603%29.jpg?width=960",
    title: "갸루와 거제에 왔습니다 (거제 1편)",
    titleKey: "resceneGeoje",
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
