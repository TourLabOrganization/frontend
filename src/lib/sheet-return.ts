// 다른 화면(홈 「지금 인기 관광지」 · ME 저장한 장소)에서 지도 화면의 장소 시트를 열었을 때, 시트를 닫으면 누른 자리로 돌아가게 하는 표시.
// 누른 탭의 sessionStorage에만 둔다. 주소에 넣으면 그 주소를 공유받아 연 사람이 시트를 닫을 때 앱 밖(이전 페이지)으로 나가기 때문이다
const KEY = "tn.sheetReturn";

/** 링크를 누를 때: 이 장소의 시트를 닫으면 지금 화면으로 돌아온다 */
export function markSheetReturn(placeId: string) {
  try {
    window.sessionStorage.setItem(KEY, placeId);
  } catch {
    // 저장소를 쓸 수 없으면 시트를 닫아도 그 화면에 머문다(지금까지와 같다)
  }
}

/** 시트를 닫을 때: 처음 연 장소(?place=)를 다른 화면에서 눌러 왔으면 true. 표시는 맞든 틀리든 한 번 읽고 지운다 */
export function takeSheetReturn(initialPlace: string | undefined): boolean {
  try {
    const marked = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return initialPlace !== undefined && marked === initialPlace;
  } catch {
    return false;
  }
}
