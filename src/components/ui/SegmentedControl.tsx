import Link from "next/link";

export type SegmentedItem = {
  href: string;
  label: string;
  selected: boolean;
};

type SegmentedControlProps = {
  items: readonly SegmentedItem[];
  /** 화면 읽기 프로그램이 읽을 묶음 이름. 예: "코스 3안" */
  label: string;
  /** 링크 칸 뒤에 붙일 칸 (투어 플래너의 「도시 ▾」 버튼). 모양은 segmentClassName으로 맞춘다 */
  children?: React.ReactNode;
};

/** 칸 하나의 모양. children으로 넣는 버튼도 같은 모양이 되게 쓴다 */
export function segmentClassName(selected: boolean): string {
  return `flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-2 text-label transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
    selected
      ? "bg-surface font-semibold text-fg ring-1 ring-line"
      : "font-medium text-fg-muted active:bg-line"
  }`;
}

// 링크형 탭. 칸마다 주소(쿼리)가 달라서 고른 칸을 공유할 수 있다.
// 칸이 링크라서 탭 역할(role="tab") 대신 nav + aria-current로 표시한다. 탭 역할은 화살표 키 이동을 약속하는데 링크는 그 동작이 없다.
// 칸을 바꿔도 뒤로 가기 기록이 쌓이지 않게 replace로 이동하고, 스크롤 위치를 지킨다
export function SegmentedControl({
  items,
  label,
  children,
}: SegmentedControlProps) {
  return (
    <nav aria-label={label} className="flex gap-1 rounded-2xl bg-fill p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          replace
          scroll={false}
          aria-current={item.selected ? "true" : undefined}
          className={segmentClassName(item.selected)}
        >
          {item.label}
        </Link>
      ))}
      {children}
    </nav>
  );
}
