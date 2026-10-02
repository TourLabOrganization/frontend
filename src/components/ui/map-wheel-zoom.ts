// 지도의 부드러운 확대 · 축소(마우스 휠 · 트랙패드 핀치). 카카오 지도는 정수 레벨만 있어 휠 한 칸에 한 레벨씩 뛰는데,
// 휠 양을 소수 레벨로 모아 지도 그림을 커서 자리 기준으로 CSS로 늘였다 줄였다가(transform) 한 레벨이 차면 카카오 레벨을 바꾸고
// 늘임을 되돌린다. 그래서 축척 단위로 끊기지 않고 구글 지도처럼 이어진다. 확대 · 축소 버튼(+ · −)은 그대로 한 레벨씩이다.
// 손가락 핀치(모바일)는 카카오 SDK가 이미 이어서 그리므로 손대지 않는다. 여기에는 순수 계산만 둔다(MapFrame이 DOM · 지도에 붙인다)

/** 휠 한 줄(deltaMode 1)을 픽셀로 보는 값 */
const LINE_PX = 16;
/** 휠 한 쪽(deltaMode 2)을 픽셀로 보는 값 */
const PAGE_PX = 800;
/** 한 레벨을 바꾸는 휠 픽셀 양. 마우스 휠 한 칸(약 100px)이 한 레벨이 되게 */
const PX_PER_LEVEL = 100;
/** 트랙패드 핀치(ctrlKey가 붙은 휠)는 양이 작아 더 민감하게 */
const PINCH_GAIN = 3;
/** 휠이 이만큼 쉬면 한 동작이 끝난 것으로 보고 가장 가까운 레벨로 맞춘다(ms) */
export const WHEEL_SETTLE_MS = 140;

/** 휠 이벤트 한 번이 바꾸는 소수 레벨(+면 확대). deltaY가 음수(위로)면 확대 */
export function wheelLevelDelta(e: {
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
}): number {
  const px =
    e.deltaMode === 1
      ? e.deltaY * LINE_PX
      : e.deltaMode === 2
        ? e.deltaY * PAGE_PX
        : e.deltaY;
  const gain = e.ctrlKey ? PINCH_GAIN : 1;
  // 한 번에 한 레벨을 넘지 않게 자른다(휠 가속이 붙어도 튀지 않게)
  return Math.max(-1, Math.min(1, (-px * gain) / PX_PER_LEVEL));
}

/** 모은 소수 레벨 → 지도 그림을 늘일 배율(한 레벨 = 2배) */
export function zoomScale(fraction: number): number {
  return 2 ** fraction;
}

/**
 * 소수 레벨을 더해 카카오 레벨을 몇 단계 바꿀지(levelDelta, 확대면 음수 — 카카오는 숫자가 작을수록 가깝다)와
 * 남은 소수(fraction)를 돌려준다. 카카오 레벨 범위(min~max)를 넘는 쪽은 더 모으지 않는다
 */
export function accumulateZoom(
  fraction: number,
  delta: number,
  level: number,
  minLevel: number,
  maxLevel: number,
): { fraction: number; levelDelta: number } {
  let next = fraction + delta;
  if (level <= minLevel) next = Math.min(next, 0);
  if (level >= maxLevel) next = Math.max(next, 0);
  // + 0: -0이 나오지 않게
  const levelDelta = -Math.trunc(next) + 0;
  return { fraction: next - Math.trunc(next) + 0, levelDelta };
}

/** 휠이 쉰 뒤: 남은 소수를 가장 가까운 레벨로 맞춘다(0.5 이상이면 한 레벨 더, 아니면 되돌림) */
export function settleZoom(fraction: number): { levelDelta: number } {
  return { levelDelta: -Math.round(fraction) + 0 };
}
