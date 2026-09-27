import { Search } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/ui/LocaleSwitch";
import { Notifications } from "@/components/Notifications";
import { CITYTOUR_SUMMARY } from "@/features/home/citytour-summary";

// 홈 · ME 머리줄 오른쪽(목업 순서: 언어 메뉴 · 검색 · 알림).
// 검색은 장소 검색이 있는 투어 플래너 지도 탭으로 간다(목업 검색 버튼은 누를 곳이 정해져 있지 않다).
// 서버 컴포넌트라서 시티투어 요약만 알림에 넘기고 노선 데이터는 클라이언트로 보내지 않는다
export async function HeaderActions() {
  const t = await getTranslations("Header");
  return (
    <div className="flex items-center">
      <LocaleSwitch />
      <Link
        href="/planner"
        aria-label={t("search")}
        className="flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
      >
        <Search size={20} aria-hidden />
      </Link>
      <Notifications citytour={CITYTOUR_SUMMARY} />
    </div>
  );
}
