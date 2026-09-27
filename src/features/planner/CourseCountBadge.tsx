"use client";

import { useTranslations } from "next-intl";
import { usePlannerCourse } from "./course-store";

// 하단 탭 「코스」 칸의 담은 장소 수 배지. 숫자는 눈으로 보는 배지, 화면 읽기에는 「담은 장소 3곳」을 읽힌다.
// 담은 장소는 localStorage라 서버 렌더와 하이드레이션 중에는 그리지 않는다
export function CourseCountBadge() {
  const t = useTranslations("Planner");
  const count = usePlannerCourse().course.placeIds.length;
  if (count === 0) return null;
  return (
    <>
      <span
        aria-hidden
        className="absolute -top-1.5 left-3 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-micro leading-none font-bold text-white tabular-nums ring-2 ring-surface"
      >
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only">{t("courseBadge", { count })}</span>
    </>
  );
}
