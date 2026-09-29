// 지도 묶음 겹침 계산. 겹치면 장소가 적은 쪽을 숨긴다(PlannerMap의 hideOverlapping).
// 지도에서 잰 화면 상자 목록만 받아 계산하므로 지도 없이 테스트할 수 있다.

export type BubbleBox = {
  id: string;
  /** 장소 수. 많을수록 먼저 남긴다 */
  count: number;
  /** 지도 틀 기준 화면 좌표(px) */
  left: number;
  top: number;
  width: number;
  height: number;
};

function overlaps(a: BubbleBox, b: BubbleBox): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

/** 장소 수가 많은 순으로 두고, 이미 둔 것과 겹치는 묶음은 뺀다. 보일 묶음 id를 돌려준다 */
export function visibleBubbleIds(boxes: readonly BubbleBox[]): Set<string> {
  const order = [...boxes].sort((a, b) => b.count - a.count);
  const kept: BubbleBox[] = [];
  for (const box of order) {
    if (!kept.some((k) => overlaps(k, box))) kept.push(box);
  }
  return new Set(kept.map((b) => b.id));
}
