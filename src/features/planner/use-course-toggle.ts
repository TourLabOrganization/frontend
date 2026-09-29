"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { needsCityChange, usePlannerCourse } from "./course-store";
import type { PlannerPlace } from "./data";
import { isKnownPlace } from "./place-lookup";
import { cityName } from "./regions";
import { placeName } from "@/features/theme/place-meta";
import { useNameTable } from "@/features/names/NamesProvider";

/**
 * 장소를 코스에 담고 빼는 토글. 지도 탭의 목록 버튼과 장소 시트가 함께 쓴다.
 * 다른 도시 장소가 담겨 있으면 바로 담지 않고 confirm을 채운다. 쓰는 쪽이 ConfirmDialog로 묻고
 * 확인하면 confirmPending(), 취소하면 cancelPending()을 부른다.
 * status는 담기 · 빼기 결과 한 줄(화면 읽기 프로그램의 role="status" 영역에 넣는다)
 */
export function useCourseToggle() {
  const t = useTranslations("Planner");
  const locale = useLocale();
  const names = useNameTable();
  const store = usePlannerCourse(isKnownPlace);
  const [pending, setPending] = useState<PlannerPlace | null>(null);
  const [status, setStatus] = useState("");

  const add = (p: PlannerPlace) => {
    store.add(p.id, p.locKo);
    setStatus(t("map.addedStatus", { name: placeName(p, locale, names) }));
  };

  const toggle = (p: PlannerPlace) => {
    if (store.has(p.id)) {
      store.remove(p.id);
      setStatus(t("map.removedStatus", { name: placeName(p, locale, names) }));
    } else if (needsCityChange(store.course, p.locKo)) {
      setPending(p);
    } else {
      add(p);
    }
  };

  const from = store.course.city;
  const confirm =
    pending && from
      ? {
          title: t("confirm.title"),
          body: t("confirm.body", {
            from: cityName(from, locale, names),
            count: store.course.placeIds.length,
            to: cityName(pending.locKo, locale, names),
          }),
          cancelLabel: t("confirm.cancel"),
          confirmLabel: t("confirm.confirm"),
        }
      : null;

  return {
    has: store.has,
    toggle,
    status,
    clearStatus: () => setStatus(""),
    confirm,
    confirmPending: () => {
      if (pending) add(pending);
      setPending(null);
    },
    cancelPending: () => setPending(null),
  };
}
