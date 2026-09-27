import { getTranslations } from "next-intl/server";
import { HeaderActions } from "@/components/HeaderActions";
import { BottomNav } from "@/components/ui/BottomNav";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { MePanel } from "@/features/me/MePanel";

// ME. 나의 여행자 유형과 저장된 플랜. 머리줄 오른쪽은 홈과 같은 언어 메뉴 · 검색 · 알림. 둘 다 이 브라우저의 localStorage에 있어서 본문은 클라이언트(MePanel)가 그린다
export default async function MePage() {
  const t = await getTranslations("Me");

  return (
    <Screen>
      <TopBar title={t("title")} right={<HeaderActions />} />
      <main className="flex flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <MePanel />
      </main>
      <BottomNav />
    </Screen>
  );
}
