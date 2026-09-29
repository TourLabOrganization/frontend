"use client";

import { House, type LucideIcon, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type NavItem = {
  href: string;
  key: "home" | "recommend" | "me";
  icon: LucideIcon;
};

const ITEMS: readonly NavItem[] = [
  { href: "/", key: "home", icon: House },
  { href: "/recommend", key: "recommend", icon: Sparkles },
  { href: "/me", key: "me", icon: UserRound },
];

function isCurrent(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

// 하단 탭(홈 · 내 코스 고르기 · ME). 홈과 ME 화면에만 둔다.
// 질문 · 결과 · 테마 화면은 자기 하단 버튼(BottomBar)이 있어서 쓰지 않는다.
// 탭이 내용을 가리지 않게 쓰는 화면의 main에 pb-[calc(5rem+env(safe-area-inset-bottom))]를 준다
export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-3">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-micro transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none ${
                  current ? "font-semibold text-primary" : "text-fg-subtle"
                }`}
              >
                <Icon size={20} aria-hidden />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
