// 좌우로 넘기는 카드 줄(CardCarousel)의 순수 계산. 화면(CardCarousel.tsx)이 DOM에 붙인다

/** 가로로 스크롤한 양(scrollLeft)과 카드 한 장 너비로 지금 보이는 카드 번호(0부터). 끝을 넘지 않게 자른다 */
export function cardIndex(
  scrollLeft: number,
  cardWidth: number,
  total: number,
): number {
  if (total <= 0 || cardWidth <= 0) return 0;
  const i = Math.round(scrollLeft / cardWidth);
  return Math.max(0, Math.min(total - 1, i));
}

/** 이전 · 다음으로 옮길 카드 번호. 끝에서는 그대로(돌아가지 않는다) */
export function stepCard(index: number, step: -1 | 1, total: number): number {
  return Math.max(0, Math.min(total - 1, index + step));
}
