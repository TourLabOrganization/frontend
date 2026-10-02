"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { usePlannerCourse } from "./course-store";
import type { PlannerPlace } from "./data";
import { isKnownPlace } from "./place-lookup";
import { placeName } from "@/features/theme/place-meta";
import { useNameTable } from "@/features/names/NamesProvider";

/**
 * 장소를 코스에 담고 빼는 토글. 지도 탭의 목록 버튼과 장소 시트가 함께 쓴다.
 * 다른 도시 장소도 그대로 담긴다(여러 도시 코스, 2026-10-02. 그 전에는 비울지 물었다).
 * status는 담기 · 빼기 결과 한 줄(화면 읽기 프로그램의 role="status" 영역에 넣는다)
 */
export function useCourseToggle() {
  const t = useTranslations("Planner");
  const locale = useLocale();
  const names = useNameTable();
  const store = usePlannerCourse(isKnownPlace);
  const [status, setStatus] = useState("");

  const toggle = (p: PlannerPlace) => {
    if (store.has(p.id)) {
      store.remove(p.id);
      setStatus(t("map.removedStatus", { name: placeName(p, locale, names) }));
    } else {
      store.add(p.id, p.locKo);
      setStatus(t("map.addedStatus", { name: placeName(p, locale, names) }));
    }
  };

  return {
    has: store.has,
    toggle,
    status,
    clearStatus: () => setStatus(""),
  };
}
