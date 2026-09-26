"use client";

import { ArrowDown, ArrowUp, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { formatDuration } from "@/features/course/format-duration";
import { isCategoryKey, placeName } from "@/features/theme/place-meta";
import { CATEGORY_DOT } from "./category";
import { useHydrated, usePlannerCourse } from "./course-store";
import { cityName, findPlace, type PlannerPlace, type Scope } from "./data";
import { plannerHref, scopeHref } from "./query";

// 맨 위 · 맨 아래에서 옮기기 버튼은 disabled 대신 aria-disabled로 둔다. 옮긴 뒤 초점이 사라지지 않게
const ICON_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill aria-disabled:text-fg-disabled aria-disabled:active:bg-transparent motion-reduce:transition-none";

// 투어 플래너 코스 탭(간단판). 지도 탭에서 담은 장소를 담은 순서대로 보이고, 순서를 바꾸거나 뺀다.
// 날짜 · 출발지 · 일정 계산(코스 빌더)은 US-203에서 이 탭에 더한다.
// 담은 장소는 localStorage라 서버 렌더에서는 아무것도 그리지 않고, 하이드레이션 뒤에 그린다(빈 상태가 깜박이지 않게)
export function PlannerCourseTab({ scope }: { scope: Scope }) {
  const t = useTranslations("Planner.course");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const hydrated = useHydrated();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const store = usePlannerCourse();
  const { city, placeIds } = store.course;

  if (!hydrated) return null;

  // 데이터에서 없어진 id는 건너뛴다
  const places = placeIds
    .map((id) => findPlace(id))
    .filter((p): p is PlannerPlace => p !== undefined);

  if (!city || places.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 pt-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-fill text-fg-muted">
          <MapPin size={24} aria-hidden />
        </span>
        <p className="mt-4 text-body text-fg-muted">{t("empty")}</p>
        <ButtonLink
          href={scopeHref(scope, "map")}
          replace
          scroll={false}
          variant="secondary"
          size="md"
          className="mt-6"
        >
          {t("goMap")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <section aria-labelledby="planner-course-heading" className="pt-6">
      <h2
        ref={headingRef}
        id="planner-course-heading"
        tabIndex={-1}
        className="px-5 text-headline font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
      >
        {t("heading", { city: cityName(city, locale), count: places.length })}
      </h2>
      <ol className="mt-3">
        {places.map((p, i) => {
          const name = placeName(p, locale);
          const meta = [
            isCategoryKey(p.cat) ? tc(`categories.${p.cat}`) : null,
            p.min > 0
              ? tc("stay", { duration: formatDuration(tc, p.min) })
              : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={p.id} className="flex items-center gap-1 py-2 pr-3 pl-5">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fill text-caption font-bold text-fg-muted tabular-nums"
              >
                {i + 1}
              </span>
              <Link
                href={plannerHref({ city, place: p.id })}
                replace
                scroll={false}
                className="ml-2 flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
              >
                <span className="flex items-center gap-2 text-body-lg font-semibold">
                  <span
                    aria-hidden
                    className={`size-2.5 shrink-0 rounded-full ${CATEGORY_DOT[p.cat] ?? "bg-fg-subtle"}`}
                  />
                  <span className="min-w-0">{name}</span>
                </span>
                {meta && (
                  <span className="block text-caption text-fg-subtle">
                    {meta}
                  </span>
                )}
              </Link>
              <button
                type="button"
                aria-label={t("moveUp", { name })}
                aria-disabled={i === 0}
                onClick={() => store.move(i, i - 1)}
                className={ICON_BUTTON}
              >
                <ArrowUp size={20} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t("moveDown", { name })}
                aria-disabled={i === places.length - 1}
                onClick={() => store.move(i, i + 1)}
                className={ICON_BUTTON}
              >
                <ArrowDown size={20} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t("remove", { name })}
                onClick={() => {
                  store.remove(p.id);
                  // 지운 행의 버튼이 없어지므로 초점을 제목으로 옮긴다
                  headingRef.current?.focus();
                }}
                className={ICON_BUTTON}
              >
                <X size={20} aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
