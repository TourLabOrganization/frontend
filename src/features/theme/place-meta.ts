import type { Place } from "@/features/course/places";

// 탭들이 함께 쓰는 장소 표시 규칙. 데이터 파일을 import하지 않아 클라이언트 컴포넌트에서도 가볍게 쓴다.

/** 장소 분류 중 messages에 이름이 있는 것 (Course.categories) */
export const CATEGORY_KEYS = [
  "herit",
  "heal",
  "activity",
  "food",
  "sea",
  "stay",
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export function isCategoryKey(cat: string): cat is CategoryKey {
  return (CATEGORY_KEYS as readonly string[]).includes(cat);
}

/** 화면 언어의 장소 이름. 영어 이름이 없으면 한국어 */
export function placeName(place: Pick<Place, "ko" | "en">, locale: string) {
  return locale === "ko" ? place.ko : place.en || place.ko;
}

/** 핵심 장소(목록 안, off가 아닌 곳)를 순번 순서로 */
export function corePlaces<T extends Pick<Place, "off" | "n">>(
  places: readonly T[],
): T[] {
  return places
    .filter((p) => !p.off)
    .sort((a, b) => (a.n ?? Infinity) - (b.n ?? Infinity));
}

/** 순번 두 자리. 1 → "01" */
export function pad2(n: number | null): string {
  return n === null ? "·" : String(n).padStart(2, "0");
}

/** 장소 좌표의 구글 지도 길찾기(검색) 주소 */
export function directionsUrl(place: Pick<Place, "lat" | "lng">): string {
  return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
}

/** Button variant="secondary" size="md"와 같은 모양의 외부 링크 (새 창 링크는 ButtonLink를 쓸 수 없다) */
export const SECONDARY_LINK_CLASS =
  "inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-fill px-4 text-label font-semibold text-fg transition duration-150 select-none touch-manipulation active:scale-[0.98] active:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none motion-reduce:active:scale-100";

/**
 * 장소 사진(Wikimedia) 주소를 폭 width로. extras.json의 img는 폭 960 주소다
 * (Special:FilePath?width=960 또는 …/thumb/…/960px-파일, scripts/build-theme-extras.mjs).
 * 사진은 next/image 최적화를 거치지 않고(unoptimized) 브라우저가 Wikimedia에서 바로 받는다.
 * Wikimedia가 서버 쪽 대량 요청(이미지 최적화 서버)에 429를 돌려주기 때문이다(2026-09 확인)
 */
export function placePhoto(url: string, width: 120 | 960 = 960): string {
  return url
    .replace(/([?&]width=)960\b/, `$1${width}`)
    .replace(/\/960px-/, `/${width}px-`);
}
