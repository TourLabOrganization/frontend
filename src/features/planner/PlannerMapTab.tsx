"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { PlaceSheet } from "@/components/ui/PlaceSheet";
import { SavePlaceButton } from "@/components/ui/SavePlaceButton";
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
import { BADGE_KEYS, type BadgeKey, hasBadge, zoneLabel } from "./badges";
import { CategoryIcon } from "./CategoryIcon";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  type PlannerPlace,
  placesInScope,
  REGION_CENTER,
  type Scope,
} from "./data";
import { extraInScope, rememberPlace, useExtraPlaces } from "./extra-places";
import { isKtoId, type KtoPlace, spotPath } from "./kto-place";
import { sortPlaces } from "./list-order";
import {
  type MapArea,
  type MapBubble,
  type MapPin,
  PlannerMap,
} from "./PlannerMap";
import { REGION_COLORS, REGION_SHAPES, regionLabel } from "./region-shapes";
import { plannerHref } from "./query";
import {
  CITY_INFO,
  cityName,
  findRegion,
  type RegionKey,
  REGIONS,
  regionName,
} from "./regions";
import { PLANNER_SOURCE } from "@/lib/local-store";
import { matchesQuery } from "@/lib/text-search";
import { isStay } from "./stays";
import { useCourseToggle } from "./use-course-toggle";
import { usePlaceDetail } from "./use-place-detail";
import { hasHangul } from "@/lib/hangul";
import { useNameTable } from "@/features/names/NamesProvider";

/** 목록에 처음 보이는 수. 스크롤이 길어지지 않게 적게 보이고 나머지는 「더 보기」로 */
const INITIAL_ROWS = 10;
/** 「더 보기」 한 번에 더 보이는 수. 전국 3,118곳을 한꺼번에 그리지 않는다 */
const PAGE_SIZE = 60;
/** 권역 화면의 카카오 지도 레벨(축척 막대 32km). 권역마다 같은 축척으로 도시 묶음을 본다 */
const REGION_LEVEL = 12;
/** 동해 먼 섬(울릉 · 독도)의 경도. 이보다 동쪽 도시는 권역 처음 화면 가운데를 잡을 때 뺀다(동쪽으로 끌면 보인다) */
const FAR_EAST_LNG = 130;

type Filter = "all" | CategoryKey;

type PlannerMapTabProps = {
  scope: Scope;
  /** ?place= 로 들어왔을 때 처음부터 열어 둘 장소 */
  initialPlace?: string;
};

// 투어 플래너 지도 탭. 분류 칩 · 배지 칩(둘은 AND) → 지도(권역 · 도시 묶음 또는 분류 색 핀) → 장소 목록(60곳씩).
// 핀이나 목록을 누르면 장소 시트가 열리고(설명 · 사진은 그때 Route Handler에서 받는다), 목록 오른쪽 버튼 · 시트 버튼으로 코스에 담는다.
// 범위(도시 · 권역)가 바뀌면 쓰는 쪽이 key를 바꿔 새로 그린다(분류 · 더 보기 초기화)
export function PlannerMapTab({ scope, initialPlace }: PlannerMapTabProps) {
  const t = useTranslations("Planner.map");
  const ts = useTranslations("Planner.sheet");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const names = useNameTable();
  const router = useRouter();
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  const course = useCourseToggle();

  // 앱 장소 + 브라우저가 기억해 둔 신규 관광지(kto:, 홈 「지금 인기 관광지」에서 연 곳)
  const extras = useExtraPlaces();
  const scopePlaces = useMemo<readonly PlannerPlace[]>(
    () => [...placesInScope(scope), ...extraInScope(extras, scope)],
    [scope, extras],
  );
  const scopeIds = useMemo(
    () => new Set(scopePlaces.map((p) => p.id)),
    [scopePlaces],
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [badge, setBadge] = useState<BadgeKey | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(INITIAL_ROWS);
  // 신규 관광지는 기억해 두기 전(링크로 바로 연 때)이라도 고른다. 아래에서 받아 기억하면 시트가 열린다
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPlace &&
      (isKtoId(initialPlace) || scopePlaces.some((p) => p.id === initialPlace))
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
  const badges = BADGE_KEYS.filter((b) =>
    scopePlaces.some((p) => hasBadge(p, b)),
  );

  // 인기 먼저 + 나머지 이름순(list-order.ts). 전국은 도시 → (도시 안에서) 인기 → 이름
  const sorted = useMemo(
    () =>
      sortPlaces(scopePlaces, {
        nation,
        name: (p) => placeName(p, locale, names),
        city: (p) => cityName(p.locKo, locale, names),
      }),
    [scopePlaces, locale, names, nation],
  );
  // 순위가 있는 도시에서만 목록 위에 순서 안내를 보인다
  const rankedCity =
    !nation && scopePlaces.some((p) => p.popRank !== undefined);
  // 분류 칩 · 배지 칩 · 검색어로 거른다(지도 표시와 목록이 같이 쓴다). 검색은 장소 이름(한 · 영)과 도시 이름(한 · 영)
  const filtered = useMemo(
    () =>
      sorted.filter(
        (p) =>
          (filter === "all" || p.cat === filter) &&
          (badge === null || hasBadge(p, badge)) &&
          matchesQuery(
            [
              p.ko,
              p.en,
              p.locKo,
              cityName(p.locKo, "en"),
              placeName(p, locale, names),
              cityName(p.locKo, locale, names),
            ],
            query,
          ),
      ),
    [sorted, filter, badge, query, locale, names],
  );
  const visible = filtered.slice(0, shown);
  const selected = scopePlaces.find((p) => p.id === selectedId) ?? null;

  // 기억해 두지 않은 신규 관광지를 링크(?place=kto:…)로 열면 서버에서 받아 기억한다(키가 없거나 못 찾으면 열지 않는다)
  const missingSpot =
    initialPlace &&
    isKtoId(initialPlace) &&
    !extras.some((p) => p.id === initialPlace)
      ? initialPlace
      : null;
  useEffect(() => {
    if (!missingSpot) return;
    const ctrl = new AbortController();
    fetch(spotPath(missingSpot), { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<KtoPlace>) : null))
      .then((place) => {
        if (place) rememberPlace(place);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [missingSpot]);
  const detail = usePlaceDetail(selected?.id ?? null);

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

  /** 배지 칩. 누른 칩을 다시 누르면 끈다(한 번에 하나) */
  const toggleBadge = (b: BadgeKey) => {
    setBadge((cur) => (cur === b ? null : b));
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
  const popRank = (p: PlannerPlace) =>
    p.popRank !== undefined ? t("popRank", { rank: p.popRank }) : null;
  /** 장소 시트 배지 줄: 데이터랩 인기 · 유네스코 · 100선 · 열린관광지 · 지정구역(종류와 연도) */
  const sheetBadges = (p: PlannerPlace) => [
    ...(p.popRank !== undefined
      ? [{ label: t("popRank", { rank: p.popRank }), tone: "primary" as const }]
      : []),
    ...(["un", "k100", "bf"] as const)
      .filter((b) => hasBadge(p, b))
      .map((b) => ({ label: t(`badges.${b}`) })),
    ...(p.vz ? [{ label: zoneLabel(p.vz, locale) }] : []),
  ];

  // ── 지도 표시 ──
  let bubbles: MapBubble[] = [];
  let areas: MapArea[] = [];
  let pins: MapPin[] = [];
  const count = (key: (p: PlannerPlace) => string) => {
    const m = new Map<string, number>();
    for (const p of filtered) m.set(key(p), (m.get(key(p)) ?? 0) + 1);
    return m;
  };
  if (scope.kind === "nation" && scope.region === null) {
    // 전국 보기: 권역을 행정구역 경계 면으로 칠한다(누르면 그 권역 도시 묶음)
    const byRegion = count((p) => p.macro);
    areas = REGIONS.flatMap((r) => {
      const n = byRegion.get(r.key) ?? 0;
      if (n === 0) return [];
      const label = regionName(r, locale, names);
      const at = regionLabel(r.key, locale, REGION_CENTER[r.key]);
      return [
        {
          id: r.key,
          label,
          count: n,
          title: t("regionMarker", { region: label, count: n }),
          rings: REGION_SHAPES[r.key],
          color: REGION_COLORS[r.key],
          labelAt: at,
          labelAnchor: at.anchor,
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
      const label = cityName(c, locale, names);
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
      title: placeName(p, locale, names),
    }));
  }
  // 전국은 권역 가운데들에 맞추고, 도시는 걸러진 핀에 맞춘다.
  // 권역은 도시 가운데들(울릉 · 독도는 뺀다)의 가운데를 정해진 축척(REGION_LEVEL)으로 보인다 — 권역마다 축척이 달라지지 않게.
  // 울릉의 묶음은 그려 두어 동쪽으로 끌면 나온다
  const fitPoints =
    scope.kind === "city"
      ? filtered
      : scope.region === null
        ? Object.values(REGION_CENTER)
        : findRegion(scope.region).cities.flatMap((c) => {
            const info = CITY_INFO[c];
            return info?.lat !== undefined &&
              info.lng !== undefined &&
              info.lng < FAR_EAST_LNG
              ? [{ lat: info.lat, lng: info.lng }]
              : [];
          });
  const fitLevel =
    scope.kind === "nation" && scope.region !== null ? REGION_LEVEL : undefined;
  const fitKey = nation
    ? `nation:${scope.region ?? ""}`
    : `city:${scope.city}:${filter}:${badge ?? ""}`;

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
      <div className="flex gap-2 overflow-x-auto px-5 py-3">
        <div
          role="group"
          aria-label={t("categoriesLabel")}
          className="flex shrink-0 gap-2"
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
                {c !== "all" && <CategoryIcon cat={c} size={16} />}
                {c === "all" ? t("all") : tc(`categories.${c}`)}
              </button>
            );
          })}
        </div>
        {badges.length > 0 && (
          <div
            role="group"
            aria-label={t("badgesLabel")}
            className="flex shrink-0 gap-2 border-l border-line pl-2"
          >
            {badges.map((b) => {
              const pressed = badge === b;
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => toggleBadge(b)}
                  className={`flex min-h-11 shrink-0 items-center rounded-xl px-4 text-label whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                    pressed
                      ? "bg-primary-weak font-semibold text-primary-strong"
                      : "bg-fill font-medium text-fg-muted active:bg-line"
                  }`}
                >
                  {t(`badges.${b}`)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-[45vh] min-h-72 bg-fill">
        {apiKey ? (
          <PlannerMap
            apiKey={apiKey}
            label={t("mapLabel")}
            bubbles={bubbles}
            areas={areas}
            hideOverlapping={scope.kind === "nation" && scope.region !== null}
            pins={pins}
            fitPoints={fitPoints}
            fitKey={fitKey}
            fitLevel={fitLevel}
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
        {rankedCity && (
          <p className="mt-1 px-5 text-label text-fg-muted">{t("popNote")}</p>
        )}
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
              const name = placeName(p, locale, names);
              const added = course.has(p.id);
              return (
                <li key={p.id} className="flex items-center gap-2 pr-3">
                  <button
                    type="button"
                    data-row
                    onClick={() => openPlace(p.id)}
                    className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pl-5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
                  >
                    {/* 배지 줄이 붙어도 아이콘은 이름 첫 줄 높이에 둔다(1lh = 이름 줄 높이) */}
                    <span className="flex h-[1lh] shrink-0 items-center self-start text-body-lg">
                      <CategoryIcon cat={p.cat} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-lg font-semibold">
                        {name}
                      </span>
                      <span className="block text-caption text-fg-subtle">
                        {[category(p), stay(p)].filter(Boolean).join(" · ")}
                      </span>
                      {popRank(p) && (
                        <span className="mt-1 block">
                          <Chip tone="primary">{popRank(p)}</Chip>
                        </span>
                      )}
                    </span>
                    {nation && (
                      <span className="shrink-0 text-caption font-medium text-fg-muted">
                        {cityName(p.locKo, locale, names)}
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
            id: selected.id,
            name: placeName(selected, locale, names),
            // 체류 시간은 상세 표 「권장 체류」에만 둔다(머리줄과 겹치지 않게)
            meta: [
              cityName(selected.locKo, locale, names),
              category(selected) ?? "",
            ],
            badges: sheetBadges(selected),
            // 설명 · 운영시간 · 좌표 기준은 Route Handler가 화면 언어로 옮긴 값(view). 한국어뿐인 원문은 외국어 화면에 보이지 않는다
            description: detail.data?.view?.desc,
            photo: detail.data?.img
              ? {
                  src: placePhoto(detail.data.img),
                  credit: detail.data.imgCredit,
                }
              : null,
            // 좌표 기준 · 카카오 장소 페이지는 무거운 필드라 시트를 열 때 받은 뒤에 행이 생긴다.
            // 외국어 화면의 운영시간은 한글이 없으면 바로, 있으면 옮긴 값을 받은 뒤에 보인다
            facts: {
              hours:
                locale === "ko" || !hasHangul(selected.hrs)
                  ? selected.hrs
                  : detail.data?.view?.hours,
              // 숙박 장소는 일정에 들지 않아(stays.ts) 권장 체류를 보이지 않는다
              stay:
                selected.min > 0 && !isStay(selected)
                  ? formatDuration(tc, selected.min)
                  : undefined,
              lat: selected.lat,
              lng: selected.lng,
              source: detail.data?.view?.source,
              kakaoUrl: detail.data?.url,
            },
            directionsHref: directionsUrl(
              selected,
              placeName(selected, locale, names),
            ),
            appTranslated: detail.data?.view?.appTranslated,
          }
        }
        onClose={() => {
          setSelectedId(null);
          course.clearStatus();
        }}
        // 함께 많이 가는 관광지: 지금 범위(도시 · 권역 · 전국)에 있는 장소만 그 시트로 바꾼다
        onOpenPlace={openPlace}
        canOpenPlace={(id) => scopeIds.has(id)}
        actions={
          selected && (
            <>
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
                {/* 숙박 장소는 일정이 아니라 그날 밤 숙소로 담긴다(PoC d_courseLabel) */}
                {isStay(selected)
                  ? course.has(selected.id)
                    ? ts("unsetStay")
                    : ts("setStay")
                  : course.has(selected.id)
                    ? ts("remove")
                    : ts("add")}
              </Button>
              <SavePlaceButton
                key={selected.id}
                place={selected}
                source={PLANNER_SOURCE}
              />
            </>
          )
        }
      >
        {detail.isPending && (
          <p role="status" className="mt-4 text-label text-fg-subtle">
            {ts("detailLoading")}
          </p>
        )}
        {detail.isError && (
          <div role="alert" className="mt-4 flex items-center gap-3">
            <p className="flex-1 text-label text-fg-muted">
              {ts("detailError")}
            </p>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void detail.refetch()}
            >
              {ts("detailRetry")}
            </Button>
          </div>
        )}
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
