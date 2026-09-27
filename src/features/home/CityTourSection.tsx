"use client";

import { ArrowRight, ExternalLink, Phone, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { SearchField } from "@/components/ui/SearchField";
import { ConfirmDialog } from "@/features/planner/ConfirmDialog";
import { usePlannerCourse } from "@/features/planner/course-store";
import { cityName } from "@/features/planner/regions";
import { decodeAnswers } from "@/features/recommend/answers";
import { LAST_RECOMMENDATION_KEY, useLocalValue } from "@/lib/local-store";
import { matchesQuery } from "@/lib/text-search";
import {
  type CityTour,
  recommendTours,
  regionCounts,
  tourFare,
  tourHours,
  tourProfile,
  tourTags,
  typeProfile,
} from "./citytour";
import toursData from "./data/citytour.json";

const TOURS = toursData as CityTour[];
const COUNTS = regionCounts(TOURS);
/** 처음 고른 지역(목업과 같다) */
const DEFAULT_REGION = "서울";
/** 목록에 처음 보이는 수. 나머지는 「더 보기」로 */
const INITIAL_ROWS = 3;
/** 「더 보기」 한 번에 더 보이는 수 */
const PAGE_SIZE = 10;

type Mode = "rec" | "region";

/** 코드 포인트 순서 비교. 서버와 브라우저의 Intl 차이로 하이드레이션이 어긋나지 않게 Collator를 쓰지 않는다 */
function compare(a: string, b: string) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

// 홈 「지역 시티투어」(목업: 배너 다음). 탭 두 칸 「내 유형 추천」 · 「지역별 검색」.
// 내 유형 추천은 마지막 테마 추천(tn.lastRecommendation)의 유형으로 목업 규칙(citytour.ts recommendTours)을 돌린다.
// 추천 기록이 있으면 내 유형 추천이, 없으면 지역별 검색(서울)이 먼저 열린다(목업과 같다).
// 「코스빌더에 넣기」는 노선의 경유지 중 플래너 장소와 맞는 곳(scripts/build-citytour.mjs가 미리 대조)을
// 투어 플래너 코스에 넣고 코스 탭으로 간다. 담아 둔 다른 코스가 있으면 먼저 묻는다(플래너 「추천 코스로 바꾸기」와 같다)
export function CityTourSection() {
  const t = useTranslations("Home.citytour");
  const tc = useTranslations("Clusters");
  const locale = useLocale();
  const router = useRouter();
  const store = usePlannerCourse();
  const id = useId();

  const lastA = useLocalValue(LAST_RECOMMENDATION_KEY);
  const type = useMemo(
    () => (lastA ? typeProfile(decodeAnswers(lastA), locale) : null),
    [lastA, locale],
  );
  const rec = useMemo(() => (type ? recommendTours(TOURS, type) : []), [type]);

  const [chosenMode, setChosenMode] = useState<Mode | null>(null);
  const mode: Mode = chosenMode ?? (rec.length > 0 ? "rec" : "region");
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(INITIAL_ROWS);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [pending, setPending] = useState<CityTour | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const recRegions = new Set(rec.map((r) => r.region));
  const regions = useMemo(
    () =>
      [...COUNTS.keys()]
        .filter((r) => matchesQuery([r, cityName(r, "en")], query))
        .sort((a, b) => compare(cityName(a, locale), cityName(b, locale))),
    [query, locale],
  );
  const list =
    mode === "rec" ? rec : TOURS.filter((tour) => tour.region === region);
  const visible = list.slice(0, shown);
  const remaining = list.length - visible.length;

  // 처음 고른 지역(서울)이 칩 상자 안에 보이게 상자만 스크롤한다(화면은 움직이지 않는다)
  useEffect(() => {
    const box = chipsRef.current;
    const chip = box?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (box && chip) box.scrollTop = chip.offsetTop - box.offsetTop - 8;
  }, [mode]);

  useEffect(() => {
    if (focusIndex === null) return;
    listRef.current
      ?.querySelectorAll<HTMLElement>("[data-card]")
      [focusIndex]?.focus();
  }, [focusIndex]);

  const changeMode = (next: Mode) => {
    setChosenMode(next);
    setShown(INITIAL_ROWS);
    setFocusIndex(null);
  };
  const pickRegion = (r: string) => {
    setRegion(r);
    setShown(INITIAL_ROWS);
    setFocusIndex(null);
  };

  const put = (tour: CityTour) => {
    store.replace(tour.city, tour.placeIds);
    router.push("/planner?tab=course");
  };
  const onAdd = (tour: CityTour) => {
    const current = store.course.placeIds;
    if (current.length > 0 && !sameIds(current, tour.placeIds)) {
      setPending(tour);
    } else put(tour);
  };

  const modes: { key: Mode; label: string }[] = [
    {
      key: "rec",
      label:
        rec.length > 0 ? t("tabRecCount", { count: rec.length }) : t("tabRec"),
    },
    { key: "region", label: t("tabRegion") },
  ];
  const tabId = (m: Mode) => `${id}-tab-${m}`;
  const panelId = `${id}-panel`;

  return (
    <section
      id="home-citytour"
      className="mt-8 scroll-mt-4 px-5"
      aria-labelledby="home-citytour-heading"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-citytour-heading" className="text-headline font-bold">
          {t("heading")}
        </h2>
        <span className="text-caption font-semibold text-fg-subtle tabular-nums">
          {t("meta", { regions: COUNTS.size, tours: TOURS.length })}
        </span>
      </div>

      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="mt-4 flex gap-1 rounded-2xl bg-fill p-1"
      >
        {modes.map((m, i) => {
          const selected = mode === m.key;
          return (
            <button
              key={m.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={tabId(m.key)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => changeMode(m.key)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                const next = modes[(i + 1) % modes.length];
                changeMode(next.key);
                tabRefs.current[(i + 1) % modes.length]?.focus();
              }}
              className={`flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-2 text-label transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                selected
                  ? "bg-surface font-semibold text-fg ring-1 ring-line"
                  : "font-medium text-fg-muted active:bg-line"
              }`}
            >
              <span className="tabular-nums">{m.label}</span>
            </button>
          );
        })}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={tabId(mode)}>
        {mode === "region" && (
          <div className="mt-4">
            <SearchField
              value={query}
              onChange={setQuery}
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              clearLabel={t("searchClear")}
            />
            <div
              ref={chipsRef}
              role="group"
              aria-label={t("regionsLabel")}
              className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto"
            >
              {regions.length === 0 ? (
                <p className="py-2 text-label text-fg-muted">{t("noRegion")}</p>
              ) : (
                regions.map((r) => {
                  const pressed = r === region;
                  const count = COUNTS.get(r) ?? 0;
                  const name = cityName(r, locale);
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={pressed}
                      aria-label={t("regionChip", { region: name, count })}
                      onClick={() => pickRegion(r)}
                      className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-label whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                        pressed
                          ? "bg-primary-weak font-semibold text-primary-strong"
                          : "bg-fill font-medium text-fg-muted active:bg-line"
                      }`}
                    >
                      {name}
                      <span className="text-caption tabular-nums">{count}</span>
                      {recRegions.has(r) && (
                        <span
                          aria-hidden
                          className="size-1.5 rounded-full bg-primary-bright"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
            <p role="status" className="sr-only">
              {query.trim() ? t("searchStatus", { count: regions.length }) : ""}
            </p>
            <h3 className="mt-5 text-body-lg font-bold tabular-nums">
              {t("regionHeading", {
                region: cityName(region, locale),
                count: COUNTS.get(region) ?? 0,
              })}
            </h3>
          </div>
        )}

        {mode === "rec" &&
          (type && rec.length > 0 ? (
            <h3 className="mt-5 text-body-lg font-bold">
              {t("recHeading", {
                type: tc(`${type.primary}.name`),
                count: rec.length,
              })}
            </h3>
          ) : (
            <div className="mt-4 rounded-card bg-fill p-5">
              <p className="text-body text-fg-muted">{t("recEmpty")}</p>
              <ButtonLink href="/recommend" size="md" className="mt-4">
                {t("recEmptyAction")}
                <ArrowRight size={20} aria-hidden />
              </ButtonLink>
            </div>
          ))}

        {list.length > 0 && (
          <ul ref={listRef} className="mt-3 flex flex-col gap-3">
            {visible.map((tour, i) => (
              <CityTourCard
                key={`${tour.region}|${tour.name}|${i}`}
                tour={tour}
                rank={mode === "rec" ? i + 1 : undefined}
                onAdd={() => onAdd(tour)}
              />
            ))}
          </ul>
        )}

        {remaining > 0 && (
          <Button
            variant="secondary"
            size="md"
            block
            className="mt-3"
            onClick={() => {
              setFocusIndex(visible.length);
              setShown((n) => n + PAGE_SIZE);
            }}
          >
            <span className="tabular-nums">
              {t("more", { count: remaining })}
            </span>
          </Button>
        )}
      </div>
      <p className="mt-4 text-micro text-fg-subtle">{t("dataNote")}</p>

      <ConfirmDialog
        open={pending !== null}
        title={t("confirm.title")}
        body={
          pending
            ? t("confirm.body", {
                count: store.course.placeIds.length,
                name: pending.name,
                placeCount: pending.placeIds.length,
              })
            : ""
        }
        cancelLabel={t("confirm.cancel")}
        confirmLabel={t("confirm.confirm")}
        onConfirm={() => {
          if (pending) put(pending);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}

type CityTourCardProps = {
  tour: CityTour;
  /** 내 유형 추천의 순위 */
  rank?: number;
  onAdd: () => void;
};

// 코스 카드: 유형 · 분류 칩 · 노선명 · 경로 · 탑승지 · 운행 시간 · 요금 · 홈페이지(새 창) · 전화 · 「코스빌더에 넣기」.
// 노선명 · 경로 · 요금은 원천(한국어) 그대로다
function CityTourCard({ tour, rank, onAdd }: CityTourCardProps) {
  const t = useTranslations("Home.citytour");
  const locale = useLocale();
  const hintId = useId();
  const tags = tourTags(tourProfile(tour));
  const hours = tourHours(tour);
  const fare = tourFare(tour);
  const canAdd = tour.placeIds.length > 0;

  return (
    <li
      data-card
      tabIndex={-1}
      className="rounded-card p-4 ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
    >
      <p className="text-caption font-semibold text-primary">
        {rank !== undefined &&
          `${t("rank", { rank })} · ${cityName(tour.region, locale)} · `}
        {t(`kind.${tour.kind}`)}
      </p>
      <h4 className="mt-1 text-body-lg font-bold">{tour.name}</h4>
      {tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <Chip>{t(`tags.${tag}`)}</Chip>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-label text-fg-muted">{tour.route}</p>
      <dl className="mt-2 flex flex-col gap-0.5 text-caption text-fg-subtle">
        {tour.board && (
          <div className="flex gap-1.5">
            <dt className="shrink-0 font-semibold">{t("board")}</dt>
            <dd>{tour.board}</dd>
          </div>
        )}
        {hours && (
          <div className="flex gap-1.5">
            <dt className="shrink-0 font-semibold">{t("hours")}</dt>
            <dd className="tabular-nums">{hours}</dd>
          </div>
        )}
        {fare && (
          <div className="flex gap-1.5">
            <dt className="shrink-0 font-semibold">{t("fare")}</dt>
            <dd>{fare}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {tour.url && (
          <a
            href={tour.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-label font-semibold text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
          >
            {t("homepage")}
            <ExternalLink size={16} aria-hidden />
            <span className="sr-only">{t("newWindow")}</span>
          </a>
        )}
        {tour.tel && (
          <a
            href={`tel:${tour.tel.replace(/[^\d+]/g, "")}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-label font-semibold text-primary tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
          >
            <Phone size={16} aria-hidden />
            <span className="sr-only">{t("call")} </span>
            {tour.tel}
          </a>
        )}
      </div>
      <Button
        size="md"
        block
        className="mt-2"
        disabled={!canAdd}
        aria-describedby={hintId}
        onClick={onAdd}
      >
        <Plus size={20} aria-hidden />
        {t("add")}
      </Button>
      <p id={hintId} className="mt-2 text-caption text-fg-subtle">
        {canAdd
          ? t("addHint", { count: tour.placeIds.length })
          : t("addDisabled")}
      </p>
      <p className="mt-1 text-micro text-fg-subtle tabular-nums">
        {t("date", { date: tour.date })}
      </p>
    </li>
  );
}
