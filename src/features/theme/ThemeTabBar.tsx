import {
  Clapperboard,
  Info,
  type LucideIcon,
  Map as MapIcon,
  Route,
  Stamp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { TabBar } from "@/components/ui/TabBar";
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

// 테마 화면 하단 탭(지도 · 코스 · 영화 · 스탬프 · 여행 정보). 공통 TabBar에 칸을 채운다.
// 칸은 주소의 ?tab=만 바꾸는 링크다(a · plan은 유지)
export function ThemeTabBar({ slug, query, current }: ThemeTabBarProps) {
  const t = useTranslations("Theme");

  return (
    <TabBar
      label={t("tabsLabel")}
      current={current}
      items={ITEMS.map(({ id, icon }) => ({
        id,
        icon,
        href: themeHref(slug, query, id),
        label: t(`tabs.${id}`),
      }))}
    />
  );
}
