import type { ThemeSlug } from "./themes";

// 테마의 대표 영상 작품과 TMDB 이미지.
// 작품은 PoC 테마 화면의 WORKS 첫 작품이다(Tour-Navigator-App/*.dc.html).
//   제주는 폭싹 속았수다 · 우리들의 블루스, 부산은 해운대 · 국제시장 · 변호인 중 첫 작품.
//   RESCENE Route는 가수 뮤직비디오 테마라 TMDB에 작품이 없다.
// 이미지 경로는 TMDB 작품 페이지(ko-KR)의 포스터 · 배경 이미지를 2026-09-27에 확인한 값이다.
// 키 없이 TMDB 이미지 서버에서 불러오고, 화면에는 TMDB 출처를 표기한다(Common.tmdbCredit)
export type Work = {
  type: "movie" | "tv";
  /** themoviedb.org/{type}/{tmdbId} */
  tmdbId: number;
  /** 한국어 포스터 (세로 2:3) */
  poster: string;
  /** 장면 스틸 (가로) */
  backdrop: string;
};

export const THEME_WORK: Partial<Record<ThemeSlug, Work>> = {
  "kings-warden": {
    type: "movie",
    tmdbId: 1321179,
    poster: "/kkJB3SeUJp7Y0IXXLkv5QZHJGkH.jpg",
    backdrop: "/1s1r4OOdnU8VX2inALVTA2q94uY.jpg",
  },
  "kpop-demon-hunters": {
    type: "movie",
    tmdbId: 803796,
    poster: "/5fqcLmrgVDicMuGLOa9PKErFP72.jpg",
    backdrop: "/w3Bi0wygeFQctn6AqFTwhGNXRwL.jpg",
  },
  "jeju-k-drama": {
    type: "tv",
    tmdbId: 219246,
    poster: "/koMkV9qm0PEZHDmX5dRpBpMH1FY.jpg",
    backdrop: "/a9qlroMOHewiDsUR93PYMVfpbF5.jpg",
  },
  "busan-film-trip": {
    type: "movie",
    tmdbId: 33196,
    poster: "/AgWRG68qAT63wDybxNAebnbstts.jpg",
    backdrop: "/uAfPjNvfHjFuvdtSa8J3iuD1CkI.jpg",
  },
};

/** TMDB 이미지 주소. 포스터는 w500, 스틸은 w780 */
export function tmdbImage(path: string, size: "w500" | "w780"): string {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
