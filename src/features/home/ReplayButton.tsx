"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { SPLASH_COOKIE } from "./splash-cookie";

// 목업의 REPLAY 버튼. 넓은 화면에서 앱 기둥 바깥 오른쪽 위에 둔다(모바일에는 둘 자리가 없어 숨긴다).
// 누르면 시작 화면 쿠키를 지우고 홈을 새로 불러와 로고 시작 화면부터 다시 보여 준다.
// 저장한 코스 · 추천 기록 같은 사용자 데이터는 지우지 않는다
export function ReplayButton() {
  const t = useTranslations("Common");
  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `${SPLASH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
        // 라우터 이동은 화면 상태를 남겨 이미 닫힌 시작 화면이 다시 뜨지 않는다. 처음부터 다시 시작하려고 문서를 새로 불러온다
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      }}
      aria-label={t("replayLabel")}
      className="fixed top-4 right-4 z-40 hidden min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-caption font-semibold tracking-wider text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none md:flex"
    >
      <RotateCcw size={16} aria-hidden />
      {t("replay")}
    </button>
  );
}
