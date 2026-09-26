import type { CategoryKey } from "@/features/theme/place-meta";

/** 분류 색 점 클래스 (globals.css --color-cat-*). Tailwind가 찾을 수 있게 클래스 이름을 통째로 적는다 */
const CATEGORY_DOT: Readonly<Record<string, string>> = {
  herit: "bg-cat-herit",
  heal: "bg-cat-heal",
  activity: "bg-cat-activity",
  food: "bg-cat-food",
  sea: "bg-cat-sea",
  stay: "bg-cat-stay",
} satisfies Record<CategoryKey, string>;

/** 분류 색 점 클래스. 모르는 분류는 회색 */
export function categoryDot(cat: string): string {
  return CATEGORY_DOT[cat] ?? "bg-fg-subtle";
}
