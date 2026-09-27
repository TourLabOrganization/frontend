import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ScrollTopOnChange } from "./ScrollTopOnChange";

export type TabBarItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** 이름 옆 숫자 배지 같은 덧붙임. 화면 읽기용 글자도 함께 넣는다 (예: 투어 플래너 코스 탭의 담은 장소 수) */
  badge?: React.ReactNode;
};

type TabBarProps = {
  /** 화면 읽기 프로그램이 읽을 탭 묶음 이름 */
  label: string;
  items: readonly TabBarItem[];
  current: string;
};

// 한 화면 안의 하단 탭(테마 화면 · 투어 플래너). 모양은 BottomNav와 같다.
// 칸은 주소의 ?tab=만 바꾸는 링크다. 뒤로 가기 기록을 쌓지 않고, 탭이 바뀌면 새 탭을 맨 위부터 보인다(ScrollTopOnChange).
// 쓰는 화면의 main에 pb-[calc(5rem+env(safe-area-inset-bottom))]를 줘서 내용이 탭 뒤로 숨지 않게 한다
export function TabBar({ label, items, current }: TabBarProps) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ScrollTopOnChange value={current} />
      <ul className="grid auto-cols-fr grid-flow-col">
        {items.map(({ id, href, label: itemLabel, icon: Icon, badge }) => {
          const selected = id === current;
          return (
            <li key={id}>
              <Link
                href={href}
                replace
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-micro transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none ${
                  selected ? "font-semibold text-primary" : "text-fg-subtle"
                }`}
              >
                <span className="relative">
                  <Icon size={20} aria-hidden />
                  {badge}
                </span>
                {itemLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
