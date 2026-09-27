"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PlaceSheet } from "@/components/ui/PlaceSheet";
import { SearchField } from "@/components/ui/SearchField";
import { formatDuration } from "@/features/course/format-duration";
import {
  CATEGORY_KEYS,
  type CategoryKey,
  directionsUrl,
  isCategoryKey,
  placeName,
  placePhoto,
} from "@/features/theme/place-meta";
import { categoryDot } from "./category";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  type PlannerPlace,
  placesInScope,
  REGION_CENTER,
  type Scope,
} from "./data";
import { type MapBubble, type MapPin, PlannerMap } from "./PlannerMap";
import { plannerHref } from "./query";
import {
  CITY_INFO,
  cityName,
  findRegion,
  type RegionKey,
  REGIONS,
  regionName,
} from "./regions";
import { matchesQuery } from "@/lib/text-search";
import { useCourseToggle } from "./use-course-toggle";

/** 목록에 처음 보이는 수. 스크롤이 길어지지 않게 적게 보이고 나머지는 「더 보기」로 */
const INITIAL_ROWS = 10;
/** 「더 보기」 한 번에 더 보이는 수. 전국 1,171곳을 한꺼번에 그리지 않는다 */
const PAGE_SIZE = 60;

type Filter = "all" | CategoryKey;

type PlannerMapTabProps = {
  scope: Scope;
  /** ?place= 로 들어왔을 때 처음부터 열어 둘 장소 */
  initialPlace?: string;
};

/** 코드 포인트 순서 비교. 서버와 브라우저의 Intl 차이로 하이드레이션이 어긋나지 않게 Collator를 쓰지 않는다 */
function compare(a: string, b: string) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

// 투어 플래너 지도 탭. 분류 칩 → 지도(권역 · 도시 묶음 또는 분류 색 핀) → 장소 목록(60곳씩).
// 핀이나 목록을 누르면 장소 시트가 열리고, 목록 오른쪽 버튼 · 시트 버튼으로 코스에 담는다.
// 범위(도시 · 권역)가 바뀌면 쓰는 쪽이 key를 바꿔 새로 그린다(분류 · 더 보기 초기화)
export function PlannerMapTab({ scope, initialPlace }: PlannerMapTabProps) {
  const t = useTranslations("Planner.map");
  const ts = useTranslations("Planner.sheet");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const router = useRouter();
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  const course = useCourseToggle();

  const scopePlaces = useMemo(() => placesInScope(scope), [scope]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(INITIAL_ROWS);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPlace && scopePlaces.some((p) => p.id === initialPlace)
      ? initialPlace
      : null,
  );
  // 「더 보기」 뒤 초점을 옮길 첫 새 행
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const nation = scope.kind === "nation";
  const categories = CATEGORY_KEYS.filter((c) =>
    scopePlaces.some((p) => p.cat === c),
  );

  // 전국은 도시 → 이름 순, 도시는 이름 순 (목업과 같다)
  const sorted = useMemo(() => {
    const name = (p: PlannerPlace) => placeName(p, locale);
    return [...scopePlaces].sort((a, b) =>
      nation
        ? compare(cityName(a.locKo, locale), cityName(b.locKo, locale)) ||
          compare(name(a), name(b))
        : compare(name(a), name(b)),
    );
  }, [scopePlaces, locale, nation]);
  // 분류 칩과 검색어로 거른다(지도 표시와 목록이 같이 쓴다). 검색은 장소 이름(한 · 영)과 도시 이름(한 · 영)
  const filtered = useMemo(
    () =>
      sorted.filter(
        (p) =>
          (filter === "all" || p.cat === filter) &&
          matchesQuery([p.ko, p.en, p.locKo, cityName(p.locKo, "en")], query),
      ),
    [sorted, filter, query],
  );
  const visible = filtered.slice(0, shown);
  const selected = scopePlaces.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (focusIndex === null) return;
    listRef.current
      ?.querySelectorAll<HTMLButtonElement>("[data-row]")
      [focusIndex]?.focus();
  }, [focusIndex]);

  const openPlace = (id: string) => {
    course.clearStatus();
    setSelectedId(id);
  };

  const changeFilter = (c: Filter) => {
    setFilter(c);
    setShown(INITIAL_ROWS);
    setFocusIndex(null);
  };

  const changeQuery = (q: string) => {
    setQuery(q);
    setShown(INITIAL_ROWS);
    setFocusIndex(null);
  };

  const stay = (p: PlannerPlace) =>
    p.min > 0 ? tc("stay", { duration: formatDuration(tc, p.min) }) : null;
  const category = (p: PlannerPlace) =>
    isCategoryKey(p.cat) ? tc(`categories.${p.cat}`) : null;

  // ── 지도 표시 ──
  let bubbles: MapBubble[] = [];
  let pins: MapPin[] = [];
  const count = (key: (p: PlannerPlace) => string) => {
    const m = new Map<string, number>();
    for (const p of filtered) m.set(key(p), (m.get(key(p)) ?? 0) + 1);
    return m;
  };
  if (scope.kind === "nation" && scope.region === null) {
    const byRegion = count((p) => p.macro);
    bubbles = REGIONS.flatMap((r) => {
      const n = byRegion.get(r.key) ?? 0;
      if (n === 0) return [];
      const label = regionName(r, locale);
      return [
        {
          id: r.key,
          ...REGION_CENTER[r.key],
          label,
          count: n,
          title: t("regionMarker", { region: label, count: n }),
          // 아주 긴 이름(수도권 영어 이름)은 서해 쪽으로 펴서 강원 · 충청 표시를 가리지 않게 한다
          offset:
            label.length > 16 && REGION_CENTER[r.key].lng < 127.8
              ? ("northwest" as const)
              : undefined,
        },
      ];
    });
  } else if (scope.kind === "nation" && scope.region !== null) {
    const byCity = count((p) => p.pickCity ?? "");
    bubbles = findRegion(scope.region).cities.flatMap((c) => {
      const n = byCity.get(c) ?? 0;
      const info = CITY_INFO[c];
      if (n === 0 || info?.lat === undefined || info.lng === undefined)
        return [];
      const label = cityName(c, locale);
      return [
        {
          id: c,
          lat: info.lat,
          lng: info.lng,
          label,
          count: n,
          title: t("cityMarker", { city: label, count: n }),
        },
      ];
    });
  } else {
    pins = filtered.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      cat: p.cat,
      title: placeName(p, locale),
    }));
  }
  // 전국은 권역 가운데들, 권역은 그 권역 도시 가운데들, 도시는 걸러진 핀에 맞춘다.
  // (장소 전체에 맞추면 울릉 · 독도 때문에 지나치게 멀어진다)
  const fitPoints =
    scope.kind === "city"
      ? filtered
      : scope.region === null
        ? Object.values(REGION_CENTER)
        : findRegion(scope.region).cities.flatMap((c) => {
            const info = CITY_INFO[c];
            return info?.lat !== undefined && info.lng !== undefined
              ? [{ lat: info.lat, lng: info.lng }]
              : [];
          });
  const fitKey = nation
    ? `nation:${scope.region ?? ""}`
    : `city:${scope.city}:${filter}`;

  const onBubble = (id: string) => {
    router.replace(
      scope.kind === "nation" && scope.region === null
        ? plannerHref({ region: id as RegionKey })
        : plannerHref({ city: id }),
      { scroll: false },
    );
  };

  const remaining = filtered.length - visible.length;

  return (
    <>
      <div
        role="group"
        aria-label={t("categoriesLabel")}
        className="flex gap-2 overflow-x-auto px-5 py-3"
      >
        {(["all", ...categories] as const).map((c) => {
          const pressed = filter === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={pressed}
              onClick={() => changeFilter(c)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-label whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                pressed
                  ? "bg-primary-weak font-semibold text-primary-strong"
                  : "bg-fill font-medium text-fg-muted active:bg-line"
              }`}
            >
              {c !== "all" && (
                <span
                  aria-hidden
                  className={`size-2.5 shrink-0 rounded-full ${categoryDot(c)}`}
                />
              )}
              {c === "all" ? t("all") : tc(`categories.${c}`)}
            </button>
          );
        })}
      </div>

      <div className="h-[45vh] min-h-72 bg-fill">
        {apiKey ? (
          <PlannerMap
            apiKey={apiKey}
            label={t("mapLabel")}
            bubbles={bubbles}
            hideOverlapping={scope.kind === "nation" && scope.region !== null}
            pins={pins}
            fitPoints={fitPoints}
            fitKey={fitKey}
            selectedId={selectedId}
            onBubble={onBubble}
            onPin={openPlace}
          />
        ) : (
          <p
            role="note"
            className="flex h-full items-center justify-center px-6 text-center text-label text-fg-muted"
          >
            {t("noKey")}
          </p>
        )}
      </div>

      <section aria-labelledby="planner-list-heading" className="pt-5">
        <h2
          id="planner-list-heading"
          className="px-5 text-headline font-bold tabular-nums"
        >
          {t("listHeading", { count: filtered.length })}
        </h2>
        <SearchField
          value={query}
          onChange={changeQuery}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          clearLabel={t("searchClear")}
          className="mx-5 mt-3"
        />
        <p role="status" className="sr-only">
          {query.trim() ? t("searchStatus", { count: filtered.length }) : ""}
        </p>

        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-body text-fg-muted">
            {query.trim()
              ? t("searchEmpty", { query: query.trim() })
              : t("empty")}
          </p>
        ) : (
          <ul ref={listRef} className="mt-2">
            {visible.map((p) => {
              const name = placeName(p, locale);
              const added = course.has(p.id);
              return (
                <li key={p.id} className="flex items-center gap-2 pr-3">
                  <button
                    type="button"
                    data-row
                    onClick={() => openPlace(p.id)}
                    className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pl-5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
                  >
                    <span
                      aria-hidden
                      className={`size-2.5 shrink-0 rounded-full ${categoryDot(p.cat)}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-lg font-semibold">
                        {name}
                      </span>
                      <span className="block text-caption text-fg-subtle">
                        {[category(p), stay(p)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {nation && (
                      <span className="shrink-0 text-caption font-medium text-fg-muted">
                        {cityName(p.locKo, locale)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={t("add", { name })}
                    aria-pressed={added}
                    onClick={() => course.toggle(p)}
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                      added
                        ? "bg-primary text-white active:bg-primary-strong"
                        : "bg-fill text-fg-muted active:bg-line"
                    }`}
                  >
                    {added ? (
                      <Check size={20} aria-hidden />
                    ) : (
                      <Plus size={20} aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {remaining > 0 && (
          <div className="px-5 pt-2">
            <Button
              variant="secondary"
              size="md"
              block
              onClick={() => {
                setFocusIndex(visible.length);
                setShown((n) => n + PAGE_SIZE);
              }}
            >
              <span className="tabular-nums">
                {t("more", { count: remaining })}
              </span>
            </Button>
          </div>
        )}
      </section>

      {/* 담기 · 빼기 결과. 시트가 열려 있으면 바깥은 inert라 시트 안의 영역이 읽힌다 */}
      <p role="status" className="sr-only">
        {selected ? "" : course.status}
      </p>

      <PlaceSheet
        place={
          selected && {
            name: placeName(selected, locale),
            meta: [
              cityName(selected.locKo, locale),
              category(selected) ?? "",
              stay(selected) ?? "",
            ],
            hours: selected.hrs,
            description:
              selected.desc?.[locale === "ko" ? "ko" : "en"] ??
              selected.desc?.ko,
            photo: selected.img
              ? { src: placePhoto(selected.img), credit: selected.imgCredit }
              : null,
            directionsHref: directionsUrl(
              selected,
              placeName(selected, locale),
            ),
          }
        }
        onClose={() => {
          setSelectedId(null);
          course.clearStatus();
        }}
        actions={
          selected && (
            <Button
              variant={course.has(selected.id) ? "secondary" : "primary"}
              size="md"
              className="flex-auto"
              onClick={() => course.toggle(selected)}
            >
              {course.has(selected.id) ? (
                <Check size={20} className="text-primary" aria-hidden />
              ) : (
                <Plus size={20} aria-hidden />
              )}
              {course.has(selected.id) ? ts("remove") : ts("add")}
            </Button>
          )
        }
      >
        <p role="status" className="sr-only">
          {course.status}
        </p>
      </PlaceSheet>

      <ConfirmDialog
        open={course.confirm !== null}
        title={course.confirm?.title ?? ""}
        body={course.confirm?.body ?? ""}
        cancelLabel={course.confirm?.cancelLabel ?? ""}
        confirmLabel={course.confirm?.confirmLabel ?? ""}
        onConfirm={course.confirmPending}
        onCancel={course.cancelPending}
      />
    </>
  );
}
