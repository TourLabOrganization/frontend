import type { AppLocale } from "@/i18n/locales";
import type { ThemeSlug } from "./themes";

// 테마의 대표 영상 작품과 TMDB 이미지.
// 작품은 PoC 테마 화면의 WORKS 첫 작품이다(Tour-Navigator-App/*.dc.html).
//   제주는 폭싹 속았수다 · 우리들의 블루스 중 첫 작품. 부산은 예외(아래 주석).
//   RESCENE Route는 가수 뮤직비디오 테마라 TMDB에 작품이 없어, PoC 목업 홈 타일의 로고 이미지를 쓴다(THEME_LOCAL_IMAGE).
// 이미지 경로는 TMDB 작품 페이지(ko-KR · en-US)의 포스터 · 배경 이미지를 2026-09-27에 확인한 값이다.
// 키 없이 TMDB 이미지 서버에서 불러오고, 화면에는 TMDB 출처를 표기한다(Common.tmdbCredit)
export type Work = {
  type: "movie" | "tv";
  /** themoviedb.org/{type}/{tmdbId} */
  tmdbId: number;
  /** 언어별 포스터 (세로 2:3). 한국어 · 영어만 있고 중 · 일 · 스페인어 화면은 영어 포스터를 쓴다(posterPath) */
  poster: Record<"ko" | "en", string>;
  /** 장면 스틸 (가로) */
  backdrop: string;
};

export const THEME_WORK: Partial<Record<ThemeSlug, Work>> = {
  "kings-warden": {
    type: "movie",
    tmdbId: 1321179,
    poster: {
      ko: "/kkJB3SeUJp7Y0IXXLkv5QZHJGkH.jpg",
      en: "/3CnVA1jAA64Q3qNVAW8DekCu19b.jpg",
    },
    backdrop: "/1s1r4OOdnU8VX2inALVTA2q94uY.jpg",
  },
  "kpop-demon-hunters": {
    type: "movie",
    tmdbId: 803796,
    poster: {
      ko: "/5fqcLmrgVDicMuGLOa9PKErFP72.jpg",
      en: "/zT7Lhw3BhJbMkRqm9Zlx2YGMsY0.jpg",
    },
    backdrop: "/w3Bi0wygeFQctn6AqFTwhGNXRwL.jpg",
  },
  "jeju-k-drama": {
    type: "tv",
    tmdbId: 219246,
    poster: {
      ko: "/koMkV9qm0PEZHDmX5dRpBpMH1FY.jpg",
      en: "/1VC3sEFxYXYDqQUCAnvWfUsYg1s.jpg",
    },
    backdrop: "/a9qlroMOHewiDsUR93PYMVfpbF5.jpg",
  },
  // 부산은 PoC WORKS(해운대 · 국제시장 · 변호인) 대신 부산행(Train to Busan)으로 둔다.
  // 해외에서 훨씬 널리 알려진 작품이라서다(대표 결정 2026-09-27)
  "busan-film-trip": {
    type: "movie",
    tmdbId: 396535,
    poster: {
      ko: "/6XvEZVBFFjybvb1yQd1qfOC6F2S.jpg",
      en: "/vNVFt6dtcqnI7hqa6LFBUibuFiw.jpg",
    },
    backdrop: "/brnfCYyz8EMbBrHgmh8sCwBi5i1.jpg",
  },
};

/**
 * TMDB 작품이 없는 테마의 이미지 (public/themes).
 * RESCENE: 목업 홈 타일 이미지(Tour-Navigator-App/uploads/images (18).jpg, 225×225)를
 * 로고는 그대로 두고 분홍 바탕만 늘려 포스터(2:3) · 카드(16:10) 비율로 만든 것
 */
const THEME_LOCAL_IMAGE: Partial<
  Record<ThemeSlug, { poster: string; backdrop: string }>
> = {
  "rescene-route": {
    poster: "/themes/rescene-poster.jpg",
    backdrop: "/themes/rescene-card.jpg",
  },
};

/** 화면 언어의 포스터 경로. 한국어 말고는 영어 포스터 */
export function posterPath(work: Work, locale: AppLocale): string {
  return locale === "ko" ? work.poster.ko : work.poster.en;
}

/** TMDB 이미지 주소. 포스터는 w500, 스틸은 w780 */
export function tmdbImage(path: string, size: "w500" | "w780"): string {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** 홈 타일의 세로 이미지. 화면 언어의 작품 포스터, 없으면 테마 이미지 */
export function themePoster(
  slug: ThemeSlug,
  locale: AppLocale,
): string | undefined {
  const work = THEME_WORK[slug];
  return work
    ? tmdbImage(posterPath(work, locale), "w500")
    : THEME_LOCAL_IMAGE[slug]?.poster;
}

/** 추천 카드의 가로 이미지. 작품 장면 스틸, 없으면 테마 이미지 */
export function themeBackdrop(slug: ThemeSlug): string | undefined {
  const work = THEME_WORK[slug];
  return work
    ? tmdbImage(work.backdrop, "w780")
    : THEME_LOCAL_IMAGE[slug]?.backdrop;
}
