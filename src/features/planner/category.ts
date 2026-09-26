import type { CategoryKey } from "@/features/theme/place-meta";

/** 분류 색 점 클래스 (globals.css --color-cat-*). Tailwind가 찾을 수 있게 클래스 이름을 통째로 적는다 */
export const CATEGORY_DOT: Readonly<Record<string, string>> = {
  herit: "bg-cat-herit",
  heal: "bg-cat-heal",
  activity: "bg-cat-activity",
  food: "bg-cat-food",
  sea: "bg-cat-sea",
  stay: "bg-cat-stay",
} satisfies Record<CategoryKey, string>;
