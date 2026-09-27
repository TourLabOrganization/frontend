import citiesData from "./data/cities.json";
import extrasData from "./data/extras.json";
import scenesData from "./data/scenes.json";
import type { ThemeCity } from "./place-list";

// 테마 화면(지도 · 영화 탭)의 장소 부가 정보와 장면 목록.
// data/extras.json · data/scenes.json · data/cities.json은 scripts/build-theme-extras.mjs가 PoC 테마 파일 5개
// (Tour-Navigator-App/*Route.dc.html)의 DATA · VMETA에서 만든다. 손으로 고치지 않는다.
// 설명 · 장면 제목은 장소 데이터에 딸린 문장이라 messages가 아니라 여기에 둔다(docs/i18n.md).

export type PlaceExtra = {
  /** 사진 주소 (Wikimedia) */
  img?: string;
  imgCredit?: string;
  /** 장면 id. 영화 · 드라마 테마는 scenes.json의 id, RESCENE는 유튜브 영상 id */
  scene?: string;
  /** 장소에서 찍힌 장면의 제목 (한국어) */
  sceneTitle?: string;
  /** 작품 · 채널 이름 (한국어) */
  work?: string;
  desc?: { ko?: string; en?: string };
  /** 영상 시작 시각(초). RESCENE 일부 장소 */
  ytAt?: number;
  /** 좌표 기준 (PoC srcKo · srcEn) */
  src?: { ko?: string; en?: string };
  /** 카카오맵 장소 페이지 (PoC url) */
  url?: string;
};

/** 영화 · 드라마 장면. label = "장면 01", title = 짧은 장면 제목, query = 유튜브 검색어 */
export type FilmScene = {
  id: string;
  label: string;
  title: string;
  query: string;
};
/** RESCENE 영상. id = 유튜브 영상 id, date = 게시일, views = PoC에 적힌 조회수(없으면 비운다) */
export type VideoScene = { id: string; date: string; views?: number };

const EXTRAS = extrasData as Readonly<
  Record<string, Readonly<Record<string, PlaceExtra>>>
>;
const SCENES = scenesData as Readonly<
  Record<string, readonly (FilmScene | VideoScene)[]>
>;

/** 뮤직비디오 테마(장면이 유튜브 영상). 나머지는 영화 · 드라마 테마 */
export const VIDEO_THEME = "rescene-route";

const CITIES = citiesData as Readonly<Record<string, readonly ThemeCity[]>>;

/** 테마 화면의 도시(칩 순서). 한 도시 테마는 하나, RESCENE는 거제 · 경주 */
export function getThemeCities(slug: string): readonly ThemeCity[] {
  return CITIES[slug] ?? [];
}

export function getPlaceExtras(
  slug: string,
): Readonly<Record<string, PlaceExtra>> {
  return EXTRAS[slug] ?? {};
}

export function getFilmScenes(slug: string): readonly FilmScene[] {
  return slug === VIDEO_THEME
    ? []
    : ((SCENES[slug] ?? []) as readonly FilmScene[]);
}

export function getVideoScenes(slug: string): readonly VideoScene[] {
  return slug === VIDEO_THEME
    ? ((SCENES[slug] ?? []) as readonly VideoScene[])
    : [];
}

/** "장면 01" → "01". 숫자가 없으면 라벨 그대로 */
export function sceneNumber(label: string): string {
  return label.match(/\d+/)?.[0] ?? label;
}
