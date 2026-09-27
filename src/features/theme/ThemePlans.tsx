"use client";

import { BookmarkCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { PlanStore } from "@/components/PlanStore";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/features/planner/ConfirmDialog";
import {
  addThemePlan,
  parseSavedPlans,
  SAVED_PLANS_KEY,
  type SavedPlan,
  samePlan,
  saveThemeOverwrite,
  useLocalValue,
  writeSavedPlans,
} from "@/lib/local-store";
import { themeHref } from "./tabs";

type Key = Pick<SavedPlan, "slug" | "a" | "plan">;
// course/scenarios.ts PLAN_IDS와 같다. scenarios.ts를 불러오면 테마 장소 데이터가 클라이언트 번들에 들어가서 따로 둔다
const PLAN_NAMES = ["classic", "trend", "quiet"] as const;
const isPlanName = (p: string): p is (typeof PLAN_NAMES)[number] =>
  (PLAN_NAMES as readonly string[]).includes(p);
const keyOf = (p: Key) => `${p.a}|${p.plan}`;

type ThemePlansProps = {
  slug: string;
  /** 코스 화면의 ?a= (없으면 빈 문자열) */
  a: string;
  plan: string;
};

// 테마 코스 탭의 「내 플랜」(PoC planVals): 이름(선택) · 코스 저장 · 덮어쓰기 · 저장소(불러오기 · 삭제).
// 저장 형식은 그대로(tn.savedPlans 테마 코스 { slug, a, plan, savedAt }), 이름을 적었을 때만 name을 더한다.
// 같은 코스(slug · a · plan)는 하나만 둔다(ME가 이 셋으로 나눈다). 불러오기는 그 코스 주소로 옮기는 것이고,
// 불러온 · 방금 저장한 플랜이 덮어쓰기 대상이다. 덮어쓰기 · 삭제는 확인 창으로 묻는다
export function ThemePlans({ slug, a, plan }: ThemePlansProps) {
  const t = useTranslations("Plans");
  const tc = useTranslations("Course");
  const tm = useTranslations("Me");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const all = parseSavedPlans(useLocalValue(SAVED_PLANS_KEY));
  const mine = all.filter((p) => p.slug === slug);
  const current: Key = { slug, a, plan };
  const saved = mine.some((p) => samePlan(p, current));

  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  // 덮어쓰기 대상(불러온 · 방금 저장한 플랜)의 a|plan
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: "overwrite" | "delete";
    plan: SavedPlan;
  } | null>(null);
  const summaryRef = useRef<HTMLElement>(null);

  const active = mine.find((p) => keyOf(p) === activeKey) ?? null;
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const planName = (p: string) => (isPlanName(p) ? tc(`plans.${p}.name`) : p);
  const titleOf = (p: SavedPlan) => p.name ?? planName(p.plan);

  const onSave = () => {
    if (saved) return;
    addThemePlan(current, name);
    setActiveKey(keyOf(current));
    setName("");
    setStatus(t("savedStatus"));
  };

  const items = [...mine].reverse().map((p) => ({
    id: keyOf(p),
    name: titleOf(p),
    sub: [
      planName(p.plan),
      tm("savedAt", { date: dateFormat.format(p.savedAt) }),
    ].join(" · "),
    current: samePlan(p, current),
  }));

  return (
    <div className="rounded-card p-4 ring-1 ring-line">
      <p role="status" className="sr-only">
        {status}
      </p>
      <label
        htmlFor={`${id}-name`}
        className="text-label font-semibold text-fg-muted"
      >
        {t("label")}
        <span className="sr-only"> {t("labelSuffix")}</span>
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={`${id}-name`}
          type="text"
          value={name}
          maxLength={40}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={t("placeholder")}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
          }}
          className="h-12 w-full min-w-0 flex-1 rounded-xl bg-fill px-4 text-body text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
        />
        <Button
          variant="secondary"
          size="md"
          aria-disabled={saved || undefined}
          onClick={onSave}
          className="shrink-0"
        >
          {saved && (
            <BookmarkCheck size={20} className="text-primary" aria-hidden />
          )}
          <span aria-live="polite">{saved ? tc("saved") : tc("savePlan")}</span>
        </Button>
      </div>
      {active && !samePlan(active, current) && (
        <Button
          variant="secondary"
          size="md"
          block
          onClick={() => setConfirm({ kind: "overwrite", plan: active })}
          className="mt-3"
        >
          {t("overwrite", { name: titleOf(active) })}
        </Button>
      )}
      <PlanStore
        items={items}
        summaryRef={summaryRef}
        onLoad={(key) => {
          const p = mine.find((x) => keyOf(x) === key);
          if (!p) return;
          setActiveKey(key);
          setStatus(t("loaded", { name: titleOf(p) }));
          router.push(themeHref(slug, { a: p.a, plan: p.plan }, "course"), {
            scroll: false,
          });
        }}
        onDelete={(key) => {
          const p = mine.find((x) => keyOf(x) === key);
          if (p) setConfirm({ kind: "delete", plan: p });
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === "delete"
            ? t("confirmDelete.title")
            : t("confirmOverwrite.title")
        }
        body={
          confirm
            ? confirm.kind === "delete"
              ? t("confirmDelete.body", { name: titleOf(confirm.plan) })
              : t("confirmOverwrite.body", { name: titleOf(confirm.plan) })
            : ""
        }
        cancelLabel={t("cancel")}
        confirmLabel={
          confirm?.kind === "delete"
            ? t("confirmDelete.confirm")
            : t("confirmOverwrite.confirm")
        }
        onConfirm={() => {
          if (!confirm) return;
          const target = confirm.plan;
          setConfirm(null);
          if (confirm.kind === "delete") {
            writeSavedPlans(all.filter((p) => !samePlan(p, target)));
            if (keyOf(target) === activeKey) setActiveKey(null);
            setStatus(t("deleted", { name: titleOf(target) }));
            summaryRef.current?.focus();
          } else {
            saveThemeOverwrite(target, current);
            setActiveKey(keyOf(current));
            setStatus(t("overwritten", { name: titleOf(target) }));
          }
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
