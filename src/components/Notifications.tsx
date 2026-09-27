"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef } from "react";
import { usePopover } from "@/components/ui/use-popover";
import { useHydrated, usePlannerCourse } from "@/features/planner/course-store";
import { decodeAnswers } from "@/features/recommend/answers";
import { hasRequiredAnswers } from "@/features/recommend/questions";
import { classify } from "@/features/recommend/scoring";
import {
  LAST_RECOMMENDATION_KEY,
  NOTIFICATIONS_READ_KEY,
  parsePlannerPlans,
  parseReadIds,
  parseSavedPlans,
  SAVED_PLANS_KEY,
  useLocalValue,
  writeReadIds,
} from "@/lib/local-store";
import { formatDate } from "@/lib/format-date";
import {
  type AppNotification,
  buildNotifications,
  markRead,
  unreadCount,
} from "@/lib/notifications";

type NotificationsProps = {
  /** 시티투어 데이터 요약(서버에서 features/home/citytour-summary로 센다) */
  citytour: { tours: number; regions: number; date: string };
};

// 머리줄 알림(종 아이콘 + 안 읽은 수). 홈 · ME가 함께 쓴다.
// 알림은 이 브라우저에 실제로 있는 정보만(lib/notifications.ts). 누르면 그 화면으로 가고 읽음이 된다. 읽음 상태는 localStorage.
// 저장된 값을 읽으므로 하이드레이션이 끝나기 전에는 숫자를 그리지 않는다
export function Notifications({ citytour }: NotificationsProps) {
  const t = useTranslations("Notifications");
  const tc = useTranslations("Clusters");
  const locale = useLocale();
  const hydrated = useHydrated();
  const { open, setOpen, toggle, rootRef, triggerRef, onBlur } = usePopover();
  const panelId = useId();
  const headingId = useId();
  // 「모두 읽음」을 누르면 그 버튼이 사라지므로 초점을 패널 제목으로 옮긴다
  const headingRef = useRef<HTMLHeadingElement>(null);

  const lastA = useLocalValue(LAST_RECOMMENDATION_KEY);
  const answers = lastA ? decodeAnswers(lastA) : null;
  const type =
    answers && hasRequiredAnswers(answers)
      ? classify(answers, locale).clusters[0]
      : undefined;
  const savedRaw = useLocalValue(SAVED_PLANS_KEY);
  const { course } = usePlannerCourse();
  const readIds = parseReadIds(useLocalValue(NOTIFICATIONS_READ_KEY));

  const list = buildNotifications({
    recommendation:
      lastA && type ? { a: lastA, type: tc(`${type.id}.name`) } : null,
    plannerPlaceIds: course.placeIds,
    savedAt: [
      ...parseSavedPlans(savedRaw).map((p) => p.savedAt),
      ...parsePlannerPlans(savedRaw).map((p) => p.savedAt),
    ],
    citytour,
  });
  const unread = hydrated ? unreadCount(list, readIds) : 0;

  const text = (n: AppNotification) => {
    switch (n.kind) {
      case "recommend":
        return {
          title: t("recommend.title"),
          body: t("recommend.body", { type: n.type }),
        };
      case "planner":
        return {
          title: t("planner.title"),
          body: t("planner.body", { count: n.count }),
        };
      case "saved":
        return {
          title: t("saved.title"),
          body: t("saved.body", { count: n.count }),
        };
      case "citytour":
        return {
          title: t("citytour.title"),
          body: t("citytour.body", {
            tours: n.tours,
            regions: n.regions,
            date: formatDate(n.date, locale),
          }),
        };
    }
  };

  return (
    <div ref={rootRef} onBlur={onBlur} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          unread > 0 ? t("buttonUnread", { count: unread }) : t("button")
        }
        onClick={toggle}
        className="relative flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
      >
        <Bell size={20} aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute top-1.5 right-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-micro leading-5 font-bold text-white tabular-nums"
          >
            {unread}
          </span>
        )}
      </button>
      <section
        id={panelId}
        hidden={!open}
        aria-labelledby={headingId}
        className="absolute top-full right-0 z-40 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-card bg-surface p-2 ring-1 ring-line"
      >
        <div className="flex items-center justify-between gap-2 py-1 pr-1 pl-3">
          <h2
            ref={headingRef}
            id={headingId}
            tabIndex={-1}
            className="rounded-lg text-body-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
          >
            {t("heading")}
          </h2>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => {
                writeReadIds(
                  markRead(
                    list,
                    readIds,
                    list.map((n) => n.id),
                  ),
                );
                headingRef.current?.focus();
              }}
              className="min-h-11 rounded-xl px-3 text-label font-semibold text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
            >
              {t("markAll")}
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <p className="px-3 py-6 text-center text-body text-fg-muted">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col">
            {list.map((n) => {
              const isUnread = hydrated && !readIds.includes(n.id);
              const { title, body } = text(n);
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => {
                      writeReadIds(markRead(list, readIds, [n.id]));
                      setOpen(false);
                    }}
                    className="flex min-h-16 gap-3 rounded-2xl px-3 py-3 transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
                  >
                    <span
                      aria-hidden
                      className={`mt-2 size-2 shrink-0 rounded-full ${isUnread ? "bg-primary-bright" : "bg-transparent"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-label font-semibold text-fg">
                        {isUnread && (
                          <span className="sr-only">{t("unread")} </span>
                        )}
                        {title}
                      </span>
                      <span className="mt-0.5 block text-caption text-fg-subtle">
                        {body}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
