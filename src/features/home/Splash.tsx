"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { LogoMark } from "@/components/ui/LogoMark";
import { SPLASH_COOKIE } from "./splash-cookie";

/** 막대를 다 채우는 시간(목업 값). 막대의 duration-[1900ms]와 같다 */
const DURATION_MS = 1900;
/** 사라지는 시간 */
const FADE_MS = 200;

type Phase = "running" | "fading" | "closed";

// 로고 시작 화면. 홈(/)이 쿠키를 보고 첫 방문에만 그린다(서버에서 정해서 깜빡이지 않는다).
// 1.9초 동안 막대를 채운 뒤 200ms 동안 흐려지며 사라진다. 아무 데나 누르거나 Esc를 누르면 바로 닫힌다.
// 움직임 줄이기 설정이면 막대 애니메이션 · 페이드 없이 1.9초 뒤 닫힌다
export function Splash() {
  const t = useTranslations("Splash");
  const common = useTranslations("Common");
  const [phase, setPhase] = useState<Phase>("running");
  const [filled, setFilled] = useState(false);

  const close = useCallback(() => setPhase("closed"), []);

  // 쿠키 · 막대 · 자동 닫기. 쿠키는 만료를 두지 않아(세션 쿠키) 브라우저를 닫으면 지워진다
  useEffect(() => {
    document.cookie = `${SPLASH_COOKIE}=1; path=/; SameSite=Lax`;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const raf = requestAnimationFrame(() => setFilled(true));
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => {
        if (reduced) {
          setPhase("closed");
          return;
        }
        setPhase((p) => (p === "running" ? "fading" : p));
        timers.push(window.setTimeout(() => setPhase("closed"), FADE_MS));
      }, DURATION_MS),
    );
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // 열려 있는 동안 뒤 화면 스크롤 잠금 · Esc로 닫기
  const open = phase !== "closed";
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-surface transition-opacity duration-200 motion-reduce:transition-none ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[480px] flex-col bg-surface text-fg">
        <div className="flex flex-1 items-center justify-center pt-[env(safe-area-inset-top)]">
          <LogoMark size={120} strokeWidth={1.2} className="text-primary" />
        </div>
        <div className="px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
          <p className="text-caption font-semibold tracking-[0.12em]">
            {common("brand")}
          </p>
          <div className="mt-3 border-t border-line" />
          <p className="mt-5 text-display font-bold">
            <span className="block">{t("title.first")}</span>
            <span className="block">{t("title.second")}</span>
          </p>
          <p className="mt-3 text-body text-fg-muted">{t("description")}</p>
          <div className="mt-10 h-1 w-full overflow-hidden rounded-full bg-fill">
            <div
              className={`h-full origin-left rounded-full bg-fg transition-transform duration-[1900ms] ease-linear motion-reduce:transition-none ${
                filled ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </div>
        </div>
        {/* 화면 전체를 덮는 건너뛰기 버튼. 누르면 바로 닫힌다 */}
        <button
          type="button"
          aria-label={t("skip")}
          onClick={close}
          className="absolute inset-0 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary-bright"
        />
      </div>
    </div>
  );
}
