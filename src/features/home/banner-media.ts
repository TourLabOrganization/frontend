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
// RESCENE Route: 「거제의 딸 원이가 인정한 거제 핫플 풀코스 여행 [원이 & 미나미]」(왕구랜드 절친소 EP1) —
// PoC RESCENE 영상 목록(RESCENE Route.dc.html VMETA)의 거제 영상. 원이가 나오는 거제 영상으로 해 달라는 대표 요청(2026-09-28).
// 유튜브 「유료 광고 포함」 안내가 뜨지 않는 영상만 쓴다(그 안내는 화면 위에 계속 떠서 배너 글자를 가리고 잘라 숨길 수 없다).
// 안내 여부는 watch 페이지에 paidContentOverlay가 없는 것으로, 외부 삽입 허용은 oEmbed · playableInEmbed로 확인했다(2026-09-28).
// 380초부터 매미성 근처 바다 전망 카페 장면(자막 「[스물셋 원이]」).
// 포스터는 같은 테마의 거제 촬영지 해금강 사진(Wikimedia Commons, 홈 아래 출처 줄에 표기)
export const BANNER_VIDEO: Partial<Record<ThemeSlug, BannerVideo>> = {
  "rescene-route": {
    id: "_GKSineBozo",
    start: 380,
    poster:
      "https://commons.wikimedia.org/wiki/Special:FilePath/KOCIS_Korea_Haegeumgang_08_%2810011695603%29.jpg?width=960",
    title:
      "거제의 딸 원이가 인정한 거제 핫플 풀코스 여행 [원이 & 미나미] | 절친소 EP1",
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
