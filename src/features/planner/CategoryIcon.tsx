import {
  BedDouble,
  FerrisWheel,
  Landmark,
  Leaf,
  type LucideIcon,
  Utensils,
  Waves,
} from "lucide-react";
import type { CategoryKey } from "@/features/theme/place-meta";

// 분류 아이콘. 플래너 장소 목록 · 분류 칩 · 담은 장소 · 「이 날에 장소 추가」가 모두 여기서 가져다 쓴다.
// 지도 핀은 수백 개가 겹쳐 아이콘이 오히려 읽기 어려워 색 점(category.ts categoryDot) 그대로 둔다.
// 색은 globals.css --color-cat-*(흰 바탕 4.5:1 이상). 아이콘은 장식이고 분류 이름은 글자로 따로 보인다

const CATEGORY_ICON: Readonly<Record<string, LucideIcon>> = {
  stay: BedDouble,
  herit: Landmark,
  food: Utensils,
  activity: FerrisWheel,
  sea: Waves,
  heal: Leaf,
} satisfies Record<CategoryKey, LucideIcon>;

/** 분류 글자색 클래스. Tailwind가 찾을 수 있게 클래스 이름을 통째로 적는다 */
const CATEGORY_TEXT: Readonly<Record<string, string>> = {
  herit: "text-cat-herit",
  heal: "text-cat-heal",
  activity: "text-cat-activity",
  food: "text-cat-food",
  sea: "text-cat-sea",
  stay: "text-cat-stay",
} satisfies Record<CategoryKey, string>;

type CategoryIconProps = {
  cat: string;
  /** 목록 20, 칩 안 16 (docs/ui.md 아이콘 규칙) */
  size?: 16 | 20;
  /** 분류 색 바탕 위의 흰 아이콘(지도 핀). 모르는 분류는 아이콘 없이 바탕만 */
  inverse?: boolean;
};

/** 분류 아이콘(분류 색). 모르는 분류는 회색 점 */
export function CategoryIcon({
  cat,
  size = 20,
  inverse = false,
}: CategoryIconProps) {
  const Icon = CATEGORY_ICON[cat];
  if (!Icon)
    return inverse ? null : (
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full bg-fg-subtle"
      />
    );
  return (
    <Icon
      size={size}
      aria-hidden
      className={`shrink-0 ${inverse ? "text-white" : CATEGORY_TEXT[cat]}`}
    />
  );
}
