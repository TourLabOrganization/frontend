"use client";

import {
  ArrowDown,
  ArrowUp,
  BookmarkCheck,
  ChevronDown,
  CircleAlert,
  Info,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CourseDaySection } from "@/features/course/CourseDaySection";
import { formatDuration } from "@/features/course/format-duration";
import { leadRegion } from "@/features/course/scenarios";
import { isCategoryKey, placeName } from "@/features/theme/place-meta";
import {
  addPlannerPlan,
  type PlannerSavedPlan,
  parsePlannerPlans,
  SAVED_PLANS_KEY,
  useLocalValue,
} from "@/lib/local-store";
import { CATEGORY_DOT } from "./category";
import { ConfirmDialog } from "./ConfirmDialog";
import { CourseBookingLinks } from "./CourseBookingLinks";
import { CourseTransport } from "./CourseTransport";
import {
  type PlannerSettings,
  parseSettings,
  pickSettings,
  useHydrated,
  usePlannerCourse,
  useToday,
} from "./course-store";
import {
  CITY_INFO,
  cityName,
  findPlace,
  findRegion,
  isPlannerCity,
  PLANNER_ORIGINS,
  type PlannerPlace,
  placesInScope,
  regionName,
  type Scope,
} from "./data";
import { plannerHref, scopeHref } from "./query";
import {
  addDays,
  buildPlannerSchedule,
  dateError,
  MAX_TRIP_DAYS,
  recommendCourse,
  resolveWide,
  suggestOrigin,
  wideOptions,
} from "./schedule";

// 맨 위 · 맨 아래에서 옮기기 버튼은 disabled 대신 aria-disabled로 둔다. 옮긴 뒤 초점이 사라지지 않게
const ICON_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill aria-disabled:text-fg-disabled aria-disabled:active:bg-transparent motion-reduce:transition-none";

const FIELD =
  "h-12 w-full min-w-0 rounded-xl bg-fill px-4 text-body text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright aria-invalid:ring-2 aria-invalid:ring-danger";
const SELECT = `${FIELD} appearance-none pr-10`;
const LABEL = "text-label font-semibold text-fg-muted";
const CARD = "rounded-card p-4 ring-1 ring-line";
// aria-disabled 버튼(이유를 읽게 초점은 남긴다)의 모양
const ARIA_DISABLED =
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:active:scale-100";

/** 출발 시각 보기: 05:00~20:30, 30분 간격 (PoC depTimeOptions) */
const DEP_TIMES = halfHours(5, 20);
/** 여행지 출발 시각 보기: 10:00~23:30, 30분 간격 (PoC retTimeOptions) */
const RET_TIMES = halfHours(10, 23);

function halfHours(from: number, to: number): string[] {
  const out: string[] = [];
  for (let h = from; h <= to; h++)
    for (const m of ["00", "30"])
      out.push(`${String(h).padStart(2, "0")}:${m}`);
  return out;
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

type ConfirmKind = "recommend" | "clear" | "load";

type PlannerCourseTabProps = {
  scope: Scope;
  /** ME에서 연 저장된 플랜 id (?plan=) */
  planId?: string;
};

// 투어 플래너 코스 탭(코스 빌더, 목업 코스 탭 순서).
// 내 플랜(이름 · 저장) → 날짜 → 출발지 · 시각 → 01 광역 교통 → 02 현지 이동 → 요약 → 담은 장소 → 추천 · 비우기 → 일자별 일정 → 예매.
// 일정 · 요약 숫자는 schedule.ts buildPlannerSchedule의 결과만 그린다. 담은 장소와 설정은 localStorage(course-store.ts)라
// 서버 렌더에서는 아무것도 그리지 않고, 하이드레이션 뒤에 그린다(빈 상태가 깜박이지 않게)
export function PlannerCourseTab({ scope, planId }: PlannerCourseTabProps) {
  const t = useTranslations("Planner.course");
  const tp = useTranslations("Planner");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useHydrated();
  const today = useToday();
  const store = usePlannerCourse();
  const course = store.course;
  const savedPlans = parsePlannerPlans(useLocalValue(SAVED_PLANS_KEY));
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const scheduleHeadingRef = useRef<HTMLHeadingElement>(null);
  // 빈 날의 「다시 불러오기」로 추천을 불렀는지. 그 버튼은 채운 뒤 사라지므로 초점을 일정 제목으로 옮긴다
  const refillFocus = useRef(false);

  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [dismissedPlan, setDismissedPlan] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<
    "nameRequired" | "emptyCourse" | null
  >(null);
  // 방금 저장한 플랜 이름(저장 안내 문구)
  const [savedName, setSavedName] = useState("");
  // 화면 읽기 프로그램에만 읽히는 결과 한 줄(담기 · 빼기 · 추천 · 불러오기)
  const [status, setStatus] = useState("");
  // 눈에도 보여야 하는 안내(추천할 장소가 없음)
  const [notice, setNotice] = useState("");

  // 데이터에서 없어진 id는 건너뛴다
  const places = course.placeIds
    .map((pid) => findPlace(pid))
    .filter((p): p is PlannerPlace => p !== undefined);

  // 추천 코스 후보: 고른 도시, 없으면 고른 권역의 자동 코스 후보
  const autoPool =
    scope.kind === "city" || scope.region
      ? placesInScope(scope).filter((p) => p.auto)
      : [];
  const leadCity =
    scope.kind === "city" ? scope.city : (leadRegion(autoPool) ?? null);
  const sourceName =
    scope.kind === "city"
      ? cityName(scope.city, locale)
      : scope.region
        ? regionName(findRegion(scope.region), locale)
        : null;

  // 날짜: 없으면 오늘 · 당일
  const startDate = course.startDate ?? today;
  const endDate = course.endDate ?? startDate;
  const dError = startDate && endDate ? dateError(startDate, endDate) : null;
  const settings: PlannerSettings = { ...course, startDate, endDate };
  const plan = buildPlannerSchedule(places, settings, leadCity);

  // 저장할 값. 저장된 플랜 중 이 값과 같은 것이 있으면 「저장됨」
  const saveSettings = pickSettings({ ...settings, name: course.name.trim() });
  const contentKey = JSON.stringify([course.placeIds, saveSettings]);
  const saved = savedPlans.some(
    (p) =>
      JSON.stringify([
        p.placeIds,
        pickSettings({ ...parseSettings(p.settings), name: p.name }),
      ]) === contentKey,
  );

  // ── ME에서 연 저장된 플랜(?plan=) ──
  const pendingPlan = planId
    ? (savedPlans.find((p) => p.id === planId) ?? null)
    : null;
  const needsLoadConfirm =
    pendingPlan !== null &&
    course.placeIds.length > 0 &&
    !sameIds(course.placeIds, pendingPlan.placeIds);

  const leavePlanUrl = (city: string | null) =>
    router.replace(
      city && isPlannerCity(city)
        ? plannerHref({ city, tab: "course" })
        : scopeHref(scope, "course"),
      { scroll: false },
    );

  // 저장된 플랜을 코스 저장소에 넣고 주소에서 ?plan=을 뗀다
  const applyPlan = (p: PlannerSavedPlan) => {
    store.load({
      city: p.city,
      placeIds: p.placeIds,
      ...parseSettings(p.settings),
      name: p.name,
    });
    leavePlanUrl(p.city);
  };

  // 지금 담은 코스가 없거나 같으면 묻지 않고 바로 불러온다. 다르면 아래 확인 창이 묻는다
  useEffect(() => {
    if (!hydrated || !pendingPlan || needsLoadConfirm) return;
    applyPlan(pendingPlan);
  });

  if (!hydrated) return null;

  const loadOpen =
    pendingPlan !== null && needsLoadConfirm && dismissedPlan !== planId;
  // 주소의 플랜이 저장 목록에 없다(ME에서 지웠거나 다른 기기의 주소)
  const planMissing = planId !== undefined && pendingPlan === null;
  const dialogKind: ConfirmKind | null = loadOpen ? "load" : confirm;

  const heading = course.city ?? (scope.kind === "city" ? scope.city : null);
  const headingName = heading ? cityName(heading, locale) : tp("nation");
  const duration = (min: number) => formatDuration(tc, min);
  const originName = (key: string) => {
    const o = PLANNER_ORIGINS[key];
    return o ? (locale === "ko" ? o.ko : o.en || o.ko) : key;
  };
  const hubName = plan.hub
    ? locale === "ko"
      ? plan.hub.ko
      : plan.hub.en || plan.hub.ko
    : null;
  const tripText =
    plan.dayCount === 1
      ? t("dates.dayTrip")
      : t("dates.nights", { nights: plan.dayCount - 1, days: plan.dayCount });

  const dayDate = (offset: number) => {
    const d = new Date(`${addDays(startDate, offset)}T00:00:00Z`);
    const fmt = (o: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" }).format(d);
    return t("schedule.dayDate", {
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      weekday: fmt({ weekday: "short" }),
      monthName: fmt({ month: "short" }),
    });
  };

  const canRecommend = sourceName !== null && autoPool.length > 0;

  // 지금 출발지에서 닿는 광역 수단이 없으면 닿는 첫 출발지를 제안한다
  const suggestedKey = !plan.wide && plan.hub ? suggestOrigin(plan.hub) : null;
  const useSuggestedOrigin = () => {
    if (!suggestedKey || !plan.hub) return;
    store.setSettings({
      origin: suggestedKey,
      wideMode: resolveWide(null, wideOptions(suggestedKey, plan.hub)),
    });
  };
  const firstEmptyDay = plan.days.findIndex((d) => d.stops.length === 0);

  const doRecommend = () => {
    const list = recommendCourse(autoPool, settings, leadCity);
    if (list.length === 0) {
      setNotice(t("actions.recommendEmpty"));
      return;
    }
    setNotice("");
    store.replace(
      list[0].locKo,
      list.map((p) => p.id),
    );
    setStatus(t("actions.recommended", { count: list.length }));
  };

  const onSave = () => {
    const name = course.name.trim();
    if (!name) {
      setSaveError("nameRequired");
      nameRef.current?.focus();
      return;
    }
    if (places.length === 0) {
      setSaveError("emptyCourse");
      return;
    }
    if (saved) return;
    addPlannerPlan({
      name,
      city: course.city,
      placeIds: course.placeIds,
      settings: saveSettings,
    });
    setSaveError(null);
    setSavedName(name);
  };

  const nameErrorId = `${id}-name-error`;
  const endErrorId = `${id}-end-error`;
  const retHintId = `${id}-ret-hint`;
  const recommendHintId = `${id}-recommend-hint`;

  return (
    <div className="flex flex-col pt-6">
      <p role="status" className="sr-only">
        {status}
      </p>

      <header className="px-5">
        <p className="text-caption font-semibold text-primary">{t("kicker")}</p>
        <h2 className="mt-1 text-title font-bold">
          {t("title", { city: headingName })}
        </h2>
      </header>
      {planMissing && (
        <p
          role="status"
          className="mx-5 mt-4 flex items-start gap-2 rounded-2xl bg-fill p-4 text-label text-fg"
        >
          <Info size={20} className="shrink-0 text-fg-muted" aria-hidden />
          {t("load.missing")}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-4 px-5">
        {/* 내 플랜 */}
        <div className={CARD}>
          <label htmlFor={`${id}-name`} className={LABEL}>
            {t("plan.label")}
            <span className="sr-only"> {t("plan.labelSuffix")}</span>
          </label>
          <div className="mt-2 flex gap-2">
            <input
              ref={nameRef}
              id={`${id}-name`}
              type="text"
              value={course.name}
              maxLength={40}
              autoComplete="off"
              enterKeyHint="done"
              placeholder={t("plan.placeholder")}
              aria-invalid={saveError === "nameRequired" || undefined}
              aria-describedby={
                saveError === "nameRequired" ? nameErrorId : undefined
              }
              onChange={(e) => {
                store.setSettings({ name: e.target.value });
                if (saveError === "nameRequired") setSaveError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
              }}
              className={`${FIELD} flex-1`}
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
              {saved ? t("plan.saved") : t("plan.save")}
            </Button>
          </div>
          {saveError && (
            <p
              id={nameErrorId}
              role="alert"
              className="mt-2 flex items-start gap-1.5 text-label text-danger"
            >
              <CircleAlert size={16} className="mt-1 shrink-0" aria-hidden />
              {t(`plan.${saveError}`)}
            </p>
          )}
          <p aria-live="polite" className="text-label text-fg-muted">
            {saved && savedName ? (
              <span className="mt-2 block">
                {t("plan.savedStatus", { name: savedName })}
              </span>
            ) : null}
          </p>
        </div>

        {/* 날짜 */}
        <fieldset className={CARD}>
          <legend className="sr-only">{t("dates.heading")}</legend>
          <div className="flex items-baseline justify-between">
            <span aria-hidden className={LABEL}>
              {t("dates.heading")}
            </span>
            <span
              aria-live="polite"
              className="rounded-lg bg-primary-weak px-2.5 py-1 text-caption font-semibold text-primary-strong tabular-nums"
            >
              <span className="sr-only">{t("dates.tripLabel")} </span>
              {tripText}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label
                htmlFor={`${id}-start`}
                className="text-caption text-fg-muted"
              >
                {t("dates.start")}
              </label>
              <input
                id={`${id}-start`}
                type="date"
                value={startDate}
                onChange={(e) =>
                  store.setSettings({ startDate: e.target.value || null })
                }
                className={`${FIELD} mt-1 px-3 focus:outline-2 focus:outline-offset-2 focus:outline-primary-bright`}
              />
            </div>
            <div className="min-w-0">
              <label
                htmlFor={`${id}-end`}
                className="text-caption text-fg-muted"
              >
                {t("dates.end")}
              </label>
              <input
                id={`${id}-end`}
                type="date"
                value={endDate}
                min={startDate}
                max={addDays(startDate, MAX_TRIP_DAYS - 1)}
                aria-invalid={dError ? true : undefined}
                aria-describedby={dError ? endErrorId : undefined}
                onChange={(e) =>
                  store.setSettings({ endDate: e.target.value || null })
                }
                className={`${FIELD} mt-1 px-3 focus:outline-2 focus:outline-offset-2 focus:outline-primary-bright`}
              />
            </div>
          </div>
          {dError && (
            <p
              id={endErrorId}
              role="alert"
              className="mt-2 flex items-start gap-1.5 text-label text-danger"
            >
              <CircleAlert size={16} className="mt-1 shrink-0" aria-hidden />
              {dError === "order"
                ? t("dates.errorOrder")
                : t("dates.errorTooLong", { max: MAX_TRIP_DAYS })}
            </p>
          )}
        </fieldset>

        {/* 출발지 · 시각 */}
        <fieldset className={CARD}>
          <legend className="sr-only">{t("trip.heading")}</legend>
          <span aria-hidden className={LABEL}>
            {t("trip.heading")}
          </span>
          <label
            htmlFor={`${id}-origin`}
            className="mt-3 block text-caption text-fg-muted"
          >
            {t("trip.origin")}
          </label>
          <div className="relative mt-1">
            <select
              id={`${id}-origin`}
              value={course.origin}
              onChange={(e) => store.setSettings({ origin: e.target.value })}
              className={SELECT}
            >
              {Object.keys(PLANNER_ORIGINS).map((key) => (
                <option key={key} value={key}>
                  {originName(key)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={20}
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                ["dep", "depTime", DEP_TIMES],
                ["ret", "retTime", RET_TIMES],
              ] as const
            ).map(([key, field, options]) => (
              <div key={key} className="min-w-0">
                <label
                  htmlFor={`${id}-${key}`}
                  className="text-caption text-fg-muted"
                >
                  {t(`trip.${field}`)}
                </label>
                <div className="relative mt-1">
                  <select
                    id={`${id}-${key}`}
                    value={course[field]}
                    aria-describedby={key === "ret" ? retHintId : undefined}
                    onChange={(e) =>
                      store.setSettings({ [field]: e.target.value })
                    }
                    className={`${SELECT} tabular-nums`}
                  >
                    {options.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={20}
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted"
                  />
                </div>
              </div>
            ))}
          </div>
          <p id={retHintId} className="mt-2 text-caption text-fg-muted">
            {t("trip.retHint")}
          </p>
        </fieldset>
      </div>

      <div className="mt-8 px-5">
        <CourseTransport
          options={plan.options}
          wide={plan.wide}
          local={plan.local}
          originName={originName(course.origin)}
          hubName={hubName}
          destinationName={
            plan.destination ? cityName(plan.destination, locale) : null
          }
          accessDuration={plan.wide ? duration(plan.accIn) : null}
          suggestedOrigin={suggestedKey ? originName(suggestedKey) : null}
          onUseOrigin={useSuggestedOrigin}
          onWide={(mode) => store.setSettings({ wideMode: mode })}
          onLocal={(mode) => store.setSettings({ localMode: mode })}
        />
      </div>

      {/* 요약 */}
      <dl
        aria-label={t("summary.label")}
        className="mx-5 mt-8 grid grid-cols-3 divide-x divide-line border-y border-line py-4"
      >
        {(
          [
            ["stops", t("summary.stopsValue", { count: plan.stops })],
            ["km", t("summary.kmValue", { km: plan.km.toFixed(1) })],
            ["time", duration(plan.minutes)],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="min-w-0 px-3 first:pl-1">
            <dt className="text-caption text-fg-subtle">
              {t(`summary.${key}`)}
            </dt>
            <dd className="mt-1 text-body-lg font-bold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {/* 담은 장소 */}
      <section aria-labelledby={`${id}-list`} className="mt-8">
        <h2
          ref={listHeadingRef}
          id={`${id}-list`}
          tabIndex={-1}
          className="px-5 text-headline font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
        >
          {t("list.heading", { count: places.length })}
        </h2>
        {places.length === 0 ? (
          <div className="mx-5 mt-3 rounded-card p-5 ring-1 ring-line">
            <p className="text-body text-fg-muted">{t("list.empty")}</p>
            <ButtonLink
              href={scopeHref(scope, "map")}
              replace
              scroll={false}
              variant="secondary"
              size="md"
              className="mt-4"
            >
              {t("goMap")}
            </ButtonLink>
          </div>
        ) : (
          <ol className="mt-3">
            {places.map((p, i) => {
              const name = placeName(p, locale);
              const meta = [
                isCategoryKey(p.cat) ? tc(`categories.${p.cat}`) : null,
                p.min > 0 ? tc("stay", { duration: duration(p.min) }) : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-1 py-2 pr-3 pl-5"
                >
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fill text-caption font-bold text-fg-muted tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <Link
                    href={
                      p.pickCity
                        ? plannerHref({ city: p.pickCity, place: p.id })
                        : plannerHref({ region: p.macro, place: p.id })
                    }
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
                      setStatus(t("removed", { name }));
                      // 지운 행의 버튼이 없어지므로 초점을 제목으로 옮긴다
                      listHeadingRef.current?.focus();
                    }}
                    className={ICON_BUTTON}
                  >
                    <X size={20} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* 추천 · 비우기 */}
      <div className="mt-6 flex flex-col gap-2 px-5">
        {notice && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-2xl bg-fill p-4 text-label text-fg"
          >
            <Info size={20} className="shrink-0 text-fg-muted" aria-hidden />
            {notice}
          </p>
        )}
        <Button
          block
          aria-disabled={!canRecommend || undefined}
          aria-describedby={recommendHintId}
          onClick={() => {
            if (!canRecommend) return;
            if (places.length > 0) setConfirm("recommend");
            else doRecommend();
          }}
          className={ARIA_DISABLED}
        >
          {t("actions.recommend")}
        </Button>
        <p id={recommendHintId} className="px-1 text-caption text-fg-muted">
          {canRecommend && sourceName
            ? t("actions.recommendHint", { source: sourceName })
            : t("actions.recommendNoScope")}
        </p>
        <Button
          variant="secondary"
          block
          disabled={places.length === 0}
          onClick={() => setConfirm("clear")}
          className="mt-1"
        >
          {t("actions.clear")}
        </Button>
      </div>

      {/* 일자별 일정 */}
      {places.length > 0 && (
        <section aria-labelledby={`${id}-schedule`} className="mt-10">
          <h2
            ref={scheduleHeadingRef}
            id={`${id}-schedule`}
            tabIndex={-1}
            className="px-5 text-headline font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
          >
            {t("schedule.heading")}
          </h2>
          {plan.dropped.length > 0 && (
            <div className="mx-5 mt-3 rounded-2xl bg-fill p-4">
              <p className="flex items-start gap-2 text-label font-semibold text-fg">
                <CircleAlert
                  size={20}
                  className="shrink-0 text-fg-muted"
                  aria-hidden
                />
                {t("schedule.dropped", { count: plan.dropped.length })}
              </p>
              <ul className="mt-2 ml-7 list-disc text-label text-fg-muted">
                {plan.dropped.map((p) => (
                  <li key={p.id}>{placeName(p, locale)}</li>
                ))}
              </ul>
              <p className="mt-2 ml-7 text-caption text-fg-muted">
                {t("schedule.droppedHint")}
              </p>
            </div>
          )}
          {plan.days.map((day, i) => (
            <CourseDaySection
              headingLevel={3}
              key={day.day}
              day={day}
              transport={plan.local === "transit" ? "public-transit" : "car"}
              date={dayDate(i)}
              empty={
                // 담은 장소보다 날이 많을 때. 담을 수 없는 게 아니라 아직 안 담은 날이다
                <div className="mt-3 px-1">
                  <p className="text-body text-fg-muted">
                    {t("schedule.emptyDay")}
                  </p>
                  {i === firstEmptyDay && canRecommend && (
                    <Button
                      variant="secondary"
                      size="md"
                      className="mt-3"
                      onClick={() => {
                        refillFocus.current = true;
                        setConfirm("recommend");
                      }}
                    >
                      {t("schedule.refill", { days: plan.dayCount })}
                    </Button>
                  )}
                </div>
              }
            />
          ))}
        </section>
      )}

      <div className="mt-10 pb-4">
        <CourseBookingLinks
          cityEn={
            plan.destination ? (CITY_INFO[plan.destination]?.en ?? "") : ""
          }
        />
      </div>

      <ConfirmDialog
        open={dialogKind !== null}
        title={
          dialogKind === "load"
            ? t("confirmLoad.title")
            : dialogKind === "clear"
              ? t("confirmClear.title")
              : t("confirmRecommend.title")
        }
        body={
          dialogKind === "load" && pendingPlan
            ? t("confirmLoad.body", {
                count: places.length,
                name: pendingPlan.name,
                planCount: pendingPlan.placeIds.length,
              })
            : dialogKind === "clear"
              ? t("confirmClear.body", { count: places.length })
              : t("confirmRecommend.body", {
                  count: places.length,
                  source: sourceName ?? "",
                })
        }
        cancelLabel={t("cancel")}
        confirmLabel={
          dialogKind === "load"
            ? t("confirmLoad.confirm")
            : dialogKind === "clear"
              ? t("confirmClear.confirm")
              : t("confirmRecommend.confirm")
        }
        onConfirm={() => {
          if (dialogKind === "load" && pendingPlan) {
            setDismissedPlan(planId ?? null);
            setSaveError(null);
            setSavedName("");
            setStatus(t("load.loaded", { name: pendingPlan.name }));
            applyPlan(pendingPlan);
          } else if (dialogKind === "clear") {
            setConfirm(null);
            store.clear();
            setStatus(t("actions.cleared"));
            listHeadingRef.current?.focus();
          } else {
            setConfirm(null);
            doRecommend();
            if (refillFocus.current) {
              refillFocus.current = false;
              scheduleHeadingRef.current?.focus();
            }
          }
        }}
        onCancel={() => {
          refillFocus.current = false;
          if (dialogKind === "load") {
            setDismissedPlan(planId ?? null);
            leavePlanUrl(null);
          } else setConfirm(null);
        }}
      />
    </div>
  );
}
