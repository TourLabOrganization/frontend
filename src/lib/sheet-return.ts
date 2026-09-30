// 다른 화면 · 다른 탭(홈 「지금 인기 관광지」 · ME 저장한 장소 · 테마 스탬프 · 영화 탭 · 플래너 코스 탭)에서 지도 탭의 장소 시트를 열었을 때,
// 시트를 닫으면 누른 자리로 돌아가게 하는 표시. 누른 탭의 sessionStorage에만 둔다.
// 주소에 넣으면 그 주소를 공유받아 연 사람이 시트를 닫을 때 앱 밖(이전 페이지)으로 나가기 때문이다
const KEY = "tn.sheetReturn";
/** 돌아간 화면이 그려지기를 기다리는 한도(ms) */
const RESTORE_MS = 2000;

type Mark = {
  /** 누른 장소 id(지도 탭의 ?place=) */
  id: string;
  /** 누른 화면 주소 */
  href: string;
  /** 누른 때의 스크롤 */
  y: number;
};

/** 링크를 누를 때: 이 장소의 시트를 닫으면 지금 화면 · 지금 스크롤로 돌아온다 */
export function markSheetReturn(placeId: string) {
  const mark: Mark = {
    id: placeId,
    href: window.location.href,
    y: Math.round(window.scrollY),
  };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(mark));
  } catch {
    // 저장소를 쓸 수 없으면 시트를 닫아도 그 화면에 머문다(지금까지와 같다)
  }
}

/**
 * 시트를 닫을 때: 처음 연 장소(?place=)를 다른 화면 · 탭에서 눌러 왔으면 back()으로 돌아가고 true.
 * 표시는 맞든 틀리든 한 번 읽고 지운다
 */
export function returnFromSheet(
  initialPlace: string | undefined,
  back: () => void,
): boolean {
  let mark: Mark | null = null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    mark = raw ? (JSON.parse(raw) as Mark) : null;
  } catch {
    return false;
  }
  if (!mark || initialPlace === undefined || mark.id !== initialPlace)
    return false;
  back();
  restoreScroll(mark);
  return true;
}

// 돌아간 화면의 내용이 브라우저 저장소에서 늦게 그려지면(코스 탭) 브라우저가 스크롤을 되돌리지 못하고 맨 위에 선다.
// 주소가 돌아오고 페이지 높이가 차면 누른 자리로 옮긴다(2초까지)
function restoreScroll({ href, y }: Mark) {
  const until = performance.now() + RESTORE_MS;
  const step = () => {
    if (performance.now() > until) return;
    const room = document.documentElement.scrollHeight - window.innerHeight;
    if (window.location.href === href && room >= y) {
      window.scrollTo(0, y);
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
