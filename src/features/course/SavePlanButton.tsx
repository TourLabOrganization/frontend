"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  parseSavedPlans,
  SAVED_PLANS_KEY,
  samePlan,
  useLocalValue,
  writeSavedPlans,
} from "@/lib/local-store";

type SavePlanButtonProps = {
  slug: string;
  /** 코스 화면의 ?a= (없으면 빈 문자열) */
  a: string;
  plan: string;
};

// 지금 보고 있는 코스(테마 + 조건 + 안)를 localStorage에 저장한다. ME 화면의 「저장된 플랜」이 읽는다.
// 같은 코스가 이미 있으면 다시 저장하지 않고 「저장됨」을 보인다
export function SavePlanButton({ slug, a, plan }: SavePlanButtonProps) {
  const t = useTranslations("Course");
  const plans = parseSavedPlans(useLocalValue(SAVED_PLANS_KEY));
  const target = { slug, a, plan };
  const saved = plans.some((p) => samePlan(p, target));

  return (
    <Button
      variant="secondary"
      size="md"
      aria-disabled={saved || undefined}
      onClick={() => {
        if (saved) return;
        writeSavedPlans([...plans, { ...target, savedAt: Date.now() }]);
      }}
    >
      {saved ? (
        <BookmarkCheck size={20} className="text-primary" aria-hidden />
      ) : (
        <Bookmark size={20} aria-hidden />
      )}
      <span aria-live="polite">{saved ? t("saved") : t("savePlan")}</span>
    </Button>
  );
}
