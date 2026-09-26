import {
  Clapperboard,
  Info,
  type LucideIcon,
  Map as MapIcon,
  Route,
  Stamp,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type TabId, themeHref, type ThemeQuery } from "./tabs";

const ITEMS: readonly { id: TabId; icon: LucideIcon }[] = [
  { id: "map", icon: MapIcon },
  { id: "course", icon: Route },
  { id: "film", icon: Clapperboard },
  { id: "stamp", icon: Stamp },
  { id: "info", icon: Info },
];

type ThemeTabBarProps = {
  slug: string;
  query: ThemeQuery;
  current: TabId;
};

// 테마 화면 하단 탭(지도 · 코스 · 영화 · 스탬프 · 여행 정보). 모양은 BottomNav와 같다.
// 칸은 주소의 ?tab=만 바꾸는 링크다(a · plan은 유지). 뒤로 가기 기록을 쌓지 않고 스크롤 위치를 지킨다.
// 쓰는 화면의 main에 pb-[calc(5rem+env(safe-area-inset-bottom))]를 줘서 내용이 탭 뒤로 숨지 않게 한다
export function ThemeTabBar({ slug, query, current }: ThemeTabBarProps) {
  const t = useTranslations("Theme");

  return (
    <nav
      aria-label={t("tabsLabel")}
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ id, icon: Icon }) => {
          const selected = id === current;
          return (
            <li key={id}>
              <Link
                href={themeHref(slug, query, id)}
                replace
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-micro transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none ${
                  selected ? "font-semibold text-primary" : "text-fg-subtle"
                }`}
              >
                <Icon size={20} aria-hidden />
                {t(`tabs.${id}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
