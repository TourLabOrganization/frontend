import { cookies } from "next/headers";
import { DisplayModeSwitch } from "@/components/ui/DisplayModeSwitch";
import { LocaleSwitch } from "@/components/ui/LocaleSwitch";
import { Notifications } from "@/components/Notifications";
import { CITYTOUR_SUMMARY } from "@/features/home/citytour-summary";
import { DISPLAY_MODE_COOKIE, isDisplayMode } from "@/lib/display-mode";

// 홈 · ME 머리줄 오른쪽: 언어 메뉴 · 화면 모드 · 알림.
// 목업의 검색(돋보기)은 투어 플래너로 가는 버튼일 뿐이라(홈 탭에 투어 플래너가 이미 있다) 빼고 그 자리에 화면 모드 메뉴를 둔다(대표 요청 2026-09-29).
// 서버 컴포넌트라서 시티투어 요약만 알림에 넘기고 노선 데이터는 클라이언트로 보내지 않는다
export async function HeaderActions() {
  const saved = (await cookies()).get(DISPLAY_MODE_COOKIE)?.value;
  return (
    <div className="flex items-center">
      <LocaleSwitch />
      <DisplayModeSwitch initial={isDisplayMode(saved) ? saved : "light"} />
      <Notifications citytour={CITYTOUR_SUMMARY} />
    </div>
  );
}
