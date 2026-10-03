"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  BedDouble,
  BookmarkCheck,
  CircleAlert,
  CloudRain,
  Info,
  Minus,
  Plus,
  RotateCcw,
  ThermometerSun,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { PlanStore } from "@/components/PlanStore";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CourseDaySection } from "@/features/course/CourseDaySection";
import { formatDuration } from "@/features/course/format-duration";
import { METRO_CITY } from "@/features/course/places";
import { leadRegion } from "@/features/course/scenarios";
import { legInfo, toMin } from "@/features/course/schedule";
import { isCategoryKey, placeName } from "@/features/theme/place-meta";
import {
  addPlannerPlan,
  overwritePlannerPlan,
  type PlannerSavedPlan,
  parsePlannerPlans,
  removePlannerPlan,
  SAVED_PLANS_KEY,
  useLocalValue,
  writePlannerPlans,
} from "@/lib/local-store";
import { markSheetReturn } from "@/lib/sheet-return";
import {
  WEATHER_REVALIDATE_SECONDS,
  WEATHER_TIMEOUT_MS,
  type WeatherResponse,
  weatherKind,
  weatherPath,
} from "@/lib/weather";
import { courseWeather, forecastRange } from "./course-weather";
import { CategoryIcon } from "./CategoryIcon";
import { ConfirmDialog } from "./ConfirmDialog";
import { CourseBookingLinks } from "./CourseBookingLinks";
import { CourseNightStay } from "./CourseNightStay";
import { CourseOrigins } from "./CourseOrigins";
import { CourseTransport } from "./CourseTransport";
import { CourseArrivalLeg, CourseWideChain } from "./CourseWideChain";
import {
  dayInsertIndex,
  parseStayOverrides,
  STAY_STEP,
  withStayOverrides,
  tidyCourse,
} from "./course-edit";
import {
  DEP_TIMES,
  type PlannerSettings,
  parseSettings,
  planContentKey,
  planSaveSettings,
  RET_TIMES,
  useHydrated,
  usePlannerCourse,
  useToday,
} from "./course-store";
import {
  isPlannerCity,
  PLANNER_PLACES,
  type PlannerPlace,
  placesInScope,
  type Scope,
} from "./data";
import { useExtraPlaces } from "./extra-places";
import { findAnyPlace, isKnownPlace } from "./place-lookup";
import {
  addLocalDays,
  stayBookingLinks,
  tripStayDates,
  wideBookingLink,
} from "./data/booking";
import { addDays, dateError, MAX_TRIP_DAYS, tripDays } from "./dates";
import { DayAddPlace } from "./DayAddPlace";
import { FerryCard } from "./FerryCard";
import { showFerryCard } from "./ferry";
import { FlightCard } from "./FlightCard";
import { jejuAirportFor, showBusanFlights, showJejuFlights } from "./flights";
import { ulleungSync } from "./island";
import { plannerHref, scopeHref } from "./query";
import {
  CITY_HUBS,
  cityName,
  findRegion,
  PLANNER_ORIGINS,
  regionName,
} from "./regions";
import { RouteChoiceDialog } from "./RouteChoiceDialog";
import { RoutingHowTo } from "./RoutingHowTo";
import {
  buildPlannerSchedule,
  type ChainSide,
  courseCities,
  railMode,
  recommendCourse,
  type RouteAskTarget,
  routeAsk,
  wideChoiceOf,
  wideLegMode,
  wideModeOf,
} from "./schedule";
import {
  isStay,
  keepStays,
  nearbyStays,
  nightAnchor,
  pickNightStay,
  STAY_SAMPLES,
  splitStays,
  toggleNightStay,
} from "./stays";
import { TripCalendar } from "./TripCalendar";
import { UlleungNotice } from "./UlleungNotice";
import {
  airTwin,
  type ChainPoint,
  chainPoints,
  chainSchedule,
  fixOriginsForWide,
  gwWideOf,
  originOptions,
  type WideChoice,
} from "./wide-chain";
import { useNameTable } from "@/features/names/NamesProvider";

// 맨 위 · 맨 아래에서 옮기기 버튼은 disabled 대신 aria-disabled로 둔다. 옮긴 뒤 초점이 사라지지 않게
const ICON_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill aria-disabled:text-fg-disabled aria-disabled:active:bg-transparent motion-reduce:transition-none";

const FIELD =
  "h-12 w-full min-w-0 rounded-xl bg-fill px-4 text-body text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright aria-invalid:ring-2 aria-invalid:ring-danger";
const LABEL = "text-label font-semibold text-fg-muted";
const CARD = "rounded-card p-4 ring-1 ring-line";
// aria-disabled 버튼(이유를 읽게 초점은 남긴다)의 모양
const ARIA_DISABLED =
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:active:scale-100";

/** 「주변 숙소」 후보가 되는 우리 숙박 장소 */
const STAY_PLACES = PLANNER_PLACES.filter(isStay);

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

type ConfirmKind = "recommend" | "clear" | "load" | "overwrite" | "delete";

type PlannerCourseTabProps = {
  scope: Scope;
  /** ME에서 연 저장된 플랜 id (?plan=) */
  planId?: string;
};

// 투어 플래너 코스 탭(코스 빌더, 목업 코스 탭 순서).
// 내 플랜(이름 · 저장 · 덮어쓰기 · 저장소) → 날짜(달력) → 출발지 · 시각 → 01 광역 교통 → 02 현지 이동 → 이동 요령 → 요약
// → 담은 장소(체류 시간 수정) → 추천 · 비우기 → 일자별 일정(구간 정보 · 가는 길 · 돌아오는 길 · 이 날에 장소 추가) → 예매.
// 일정 · 요약 숫자는 schedule.ts buildPlannerSchedule의 결과만 그린다. 담은 장소와 설정은 localStorage(course-store.ts)라
// 서버 렌더에서는 아무것도 그리지 않고, 하이드레이션 뒤에 그린다(빈 상태가 깜박이지 않게)
export function PlannerCourseTab({ scope, planId }: PlannerCourseTabProps) {
  const t = useTranslations("Planner.course");
  const tp = useTranslations("Planner");
  const tc = useTranslations("Course");
  const tm = useTranslations("Me");
  const tplans = useTranslations("Plans");
  const tw = useTranslations("Planner.course.weather");
  const tkinds = useTranslations("PlaceSheet.weather.kinds");
  const tsheet = useTranslations("PlaceSheet.weather");
  const locale = useLocale();
  const names = useNameTable();
  const router = useRouter();
  const hydrated = useHydrated();
  const today = useToday();
  const store = usePlannerCourse(isKnownPlace);
  // 코스에 담은 신규 관광지(kto:)는 브라우저가 기억해 둔 장소에서 찾는다. 바뀌면 다시 그린다
  useExtraPlaces();
  const course = store.course;
  const savedPlans = parsePlannerPlans(useLocalValue(SAVED_PLANS_KEY));
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const scheduleHeadingRef = useRef<HTMLHeadingElement>(null);
  // 빈 날의 「다시 불러오기」로 추천을 불렀는지. 그 버튼은 채운 뒤 사라지므로 초점을 일정 제목으로 옮긴다
  const refillFocus = useRef(false);

  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  // 저장소 목록에서 불러오거나 지울 플랜(확인 창이 묻는 대상)
  const [target, setTarget] = useState<PlannerSavedPlan | null>(null);
  const storeSummaryRef = useRef<HTMLElement>(null);
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
  // 「경로 변경」으로 연 경로 선택 창(PoC routeAskOpen). 없으면 스스로 열 때만 열린다
  const [routeOpen, setRouteOpen] = useState<RouteAskTarget | null>(null);

  // 데이터에서 없어진 id는 건너뛴다(신규 관광지는 기억해 둔 장소에서 찾는다). 체류 시간은 사용자가 바꾼 값(stayOv)을 넣는다(PoC courseList)
  const basePlaces = course.placeIds
    .map((pid) => findAnyPlace(pid))
    .filter((p): p is PlannerPlace => p !== undefined);
  const places = withStayOverrides(basePlaces, course.stayOv);

  // 추천 코스 후보: 고른 도시, 없으면 고른 권역의 자동 코스 후보
  const autoPool =
    scope.kind === "city" || scope.region
      ? placesInScope(scope).filter((p) => p.auto)
      : [];
  const leadCity =
    scope.kind === "city" ? scope.city : (leadRegion(autoPool) ?? null);
  const sourceName =
    scope.kind === "city"
      ? cityName(scope.city, locale, names)
      : scope.region
        ? regionName(findRegion(scope.region), locale, names)
        : null;

  // 날짜: 없으면 오늘 · 당일
  const startDate = course.startDate ?? today;
  // 일자별 날씨 경고(course-weather.ts): 여행 날짜 중 예보가 닿는 범위를 코스 첫 장소 좌표로 한 번 받는다.
  // 날짜를 고르지 않았으면(당일) 오늘 하루만. 여러 도시 코스도 첫 장소 좌표 하나로 본다(일별 예보는 광역 단위라 충분하다)
  const weatherRange = forecastRange(
    startDate,
    tripDays(course.startDate, course.endDate),
    today,
  );
  const weatherAt = places.find((p) => !isStay(p)) ?? null;
  const weatherQuery = useQuery({
    queryKey: [
      "course-weather",
      weatherAt?.lat ?? null,
      weatherAt?.lng ?? null,
      weatherRange?.from ?? null,
      weatherRange?.to ?? null,
    ],
    queryFn: async (): Promise<WeatherResponse> => {
      const res = await fetch(
        weatherPath(weatherAt!.lat, weatherAt!.lng, weatherRange!),
        { signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS) },
      );
      if (!res.ok) throw new Error(`weather ${res.status}`);
      return (await res.json()) as WeatherResponse;
    },
    enabled: hydrated && weatherAt !== null && weatherRange !== null,
    staleTime: WEATHER_REVALIDATE_SECONDS * 1000,
    retry: 1,
  });
  const endDate = course.endDate ?? startDate;
  const dError = startDate && endDate ? dateError(startDate, endDate) : null;
  const settings: PlannerSettings = { ...course, startDate, endDate };
  const plan = buildPlannerSchedule(places, settings, leadCity);

  // 저장할 값(설정 + 체류 시간). 날짜는 고른 그대로(고르지 않았으면 null, PoC planSave) 저장하고 같은 값으로 비교한다.
  // 저장된 플랜 중 이 값과 같은 것이 있으면 「저장됨」
  const saveSettings = planSaveSettings(course);
  const planSettings = { ...saveSettings, stayOv: course.stayOv };
  const contentKey = planContentKey(
    course.placeIds,
    saveSettings,
    course.stayOv,
  );
  const saved = savedPlans.some(
    (p) =>
      planContentKey(
        p.placeIds,
        planSaveSettings({ ...parseSettings(p.settings), name: p.name }),
        parseStayOverrides(p.settings.stayOv),
      ) === contentKey,
  );
  // 지금 불러와 보고 있는(또는 방금 저장한) 플랜. 「덮어쓰기」 대상(PoC planId)
  const activePlanId = course.planId;
  const activePlan = savedPlans.find((p) => p.id === activePlanId) ?? null;

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

  // 저장된 플랜을 코스 저장소에 넣고 주소에서 ?plan=을 뗀다(저장소 목록에서 불러와도 그 도시 주소로)
  const applyPlan = (p: PlannerSavedPlan) => {
    store.load({
      city: p.city,
      placeIds: p.placeIds,
      ...parseSettings(p.settings),
      stayOv: parseStayOverrides(p.settings.stayOv),
      planId: p.id,
      name: p.name,
    });
    leavePlanUrl(p.city);
  };

  // 지금 담은 코스가 없거나 같으면 묻지 않고 바로 불러온다. 다르면 아래 확인 창이 묻는다
  useEffect(() => {
    if (!hydrated || !pendingPlan || needsLoadConfirm) return;
    applyPlan(pendingPlan);
  });

  // 울릉을 고를 때 한 번(PoC syncUlleung): 안내 창을 띄우고 출발지 · 귀가지를 울릉 항로 항구로 바꾼다.
  // 이 화면에서 울릉이 아니던 여행이 울릉이 되었을 때, 또는 화면을 열 때 울릉 여행인데 저장된 출발지가 울릉 항로 항구가 아닐 때
  const ulWas = useRef<boolean | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const was = ulWas.current;
    ulWas.current = plan.ulleung;
    if (!plan.ulleung || was === true) return;
    const fix = ulleungSync(course.origin, course.originEnd);
    if (was === null && fix.origin === undefined) return;
    store.setSettings(fix);
    store.setUlNotice(true);
  });

  if (!hydrated) return null;

  const loadOpen =
    pendingPlan !== null && needsLoadConfirm && dismissedPlan !== planId;
  // 주소의 플랜이 저장 목록에 없다(ME에서 지웠거나 다른 기기의 주소)
  const planMissing = planId !== undefined && pendingPlan === null;
  const dialogKind: ConfirmKind | null = loadOpen ? "load" : confirm;
  // 불러올 플랜: 주소(?plan=)에서 온 것이 먼저, 아니면 저장소 목록에서 누른 것
  const loadPlan = loadOpen ? pendingPlan : target;

  const heading = course.city ?? (scope.kind === "city" ? scope.city : null);
  // 여러 도시 코스는 제목에 도시를 순서대로 「서울 → 경주」로
  const cities = courseCities(places);
  const headingName =
    cities.length > 1
      ? cities.map((c) => cityName(c, locale, names)).join(" → ")
      : heading
        ? cityName(heading, locale, names)
        : tp("nation");
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

  const dayDate = (offset: number) => dayLabel(addDays(startDate, offset));
  // 「9월 27일(토)」
  function dayLabel(iso: string) {
    const d = new Date(`${iso}T00:00:00Z`);
    const fmt = (o: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" }).format(d);
    return t("schedule.dayDate", {
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      weekday: fmt({ weekday: "short" }),
      monthName: fmt({ month: "short" }),
    });
  }

  const canRecommend = sourceName !== null && autoPool.length > 0;

  const firstEmptyDay = plan.days.findIndex((d) => d.stops.length === 0);

  // ── 광역 교통 먼저 → 출발지 · 귀가지 (PoC originOptions · originChange · originEndChange · wideOpts pick) ──
  const pointName = (p: ChainPoint) => (locale === "ko" ? p.ko : p.en || p.ko);
  const own = plan.local === "own";
  const picked = wideChoiceOf(course.wideMode);
  const pickedOpen =
    picked !== null &&
    plan.options.find((o) => o.choice === picked)?.block === null;
  const metroWide = picked === "metro" && pickedOpen;
  // 제주 자가용 카페리는 배의 관문(항만)만(PoC originOptions wideOriginFilter(…, 'ship'))
  const originKeys = originOptions(
    plan.hub,
    plan.carFerry ? "ship" : pickedOpen ? picked : null,
    plan.ulleung,
  );
  // 제주 자가용이면 「제주도민인가요?」(PoC jejuOwn*). 도민이면 출발지 · 귀가지를 고르지 않는다(체인이 없다)
  const jejuOwn = own && plan.island === "jeju";
  const onWide = (choice: WideChoice) => {
    // 제주에서 자가용을 고르면 카페리를 탈 항만으로 출발지를 맞춘다(PoC wideOpts pick 제주 자가용)
    const fix =
      choice === "own" && plan.island !== "jeju"
        ? {}
        : fixOriginsForWide(
            choice === "own" ? "ship" : choice,
            plan.originKey,
            course.originEnd,
          );
    store.setSettings({
      wideMode: wideModeOf(choice, fix.origin ?? plan.originKey),
      ...fix,
    });
  };
  const onOrigin = (v: string) => {
    const k = airTwin(v);
    const w = gwWideOf(k);
    const next: Partial<PlannerSettings> = { origin: k };
    if (w && course.wideMode !== "own") {
      next.wideMode = wideModeOf(w, k);
      const e = course.originEnd ? gwWideOf(course.originEnd) : null;
      if (e && e !== w) next.originEnd = null;
    }
    store.setSettings(next);
  };
  const onOriginEnd = (v: string | null) => {
    if (v === null) {
      store.setSettings({ originEnd: null });
      return;
    }
    const k = airTwin(v);
    const w = gwWideOf(k);
    store.setSettings({
      originEnd: k,
      ...(w && !course.wideMode ? { wideMode: wideModeOf(w, k) } : {}),
    });
  };
  // 지하철 호선 → 역(PoC metroOriginShow): 광역 교통이 지하철이면 출발 · 귀가역, 도착 도시가 전철권이면 출발 전철역
  const metroKind = own
    ? null
    : metroWide
      ? ("wide" as const)
      : plan.destination && METRO_CITY[plan.destination]
        ? ("city" as const)
        : null;

  // ── 광역 체인(PoC dayPlan chainIn · chainOut) ──
  const chainCard = (side: ChainSide | null, direction: "out" | "back") =>
    side ? (
      <CourseWideChain
        direction={direction}
        side={side}
        // 자가용(카페리 포함)은 예매가 없다(PoC transBtns). 배편은 배편 시간표 카드에서 예매한다
        link={own ? null : wideBookingLink(side.chain.mode)}
        onRouteChange={
          // 당일 여행에서 가는 길과 같은 도시면 돌아오는 길에는 두지 않는다(PoC chainOutAltShow)
          direction === "back" &&
          plan.dayCount === 1 &&
          side.city === plan.inbound?.city
            ? null
            : () =>
                setRouteOpen({
                  city: side.city,
                  dir: direction === "out" ? "in" : "out",
                })
        }
        gatewayName={originName}
        onGateway={(key) =>
          store.setSettings({
            gwPick: { ...course.gwPick, [side.chain.mode]: key },
          })
        }
      />
    ) : null;
  const arrivalCard = () => {
    const a = plan.arrival;
    if (!a || plan.days[0]?.stops[0]?.id !== a.place.id) return null;
    return (
      <CourseArrivalLeg leg={a} placeName={placeName(a.place, locale, names)} />
    );
  };

  // ── 경로 선택 창(PoC routeAsk*). 코스 탭에서만, 다른 확인 창이 없을 때 ──
  const ask = routeAsk(plan, course, course.routeSkip, routeOpen);
  const askView = (() => {
    if (!ask) return null;
    const { side, target } = ask;
    const out = target.dir === "out";
    const start = toMin(out ? course.retTime : course.depTime);
    const city = cityName(side.city, locale, names);
    const hm = (m: number) =>
      `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
    return {
      city: side.city,
      kicker: t(out ? "route.kickerOut" : "route.kickerIn"),
      title: t(out ? "route.titleOut" : "route.titleIn", {
        origin: pointName(side.origin),
        city,
        count: side.cands.length,
      }),
      options: side.cands.map((c) => {
        const sc = chainSchedule(c, start, out);
        const mode = t(`route.modes.${c.mode as "bus"}`);
        const xfer = c.legs.length - 1;
        return {
          mode: c.mode,
          title: xfer
            ? t("route.transfers", { mode, count: xfer })
            : t("route.direct", { mode }),
          total: duration(sc.end - start),
          path: chainPoints(c, side.origin, out).map(pointName).join(" → "),
          times: t("route.times", { dep: hm(start), arr: hm(sc.end) }),
          current: side.chain.mode === c.mode,
        };
      }),
    };
  })();

  // 구간 정보: 같은 날 앞 장소 → 이 장소. 수단 · 시간 · 거리(요약 총 거리와 같은 legInfo km).
  // 도시가 다른 광역 구간은 수단(기차 · 버스 · 광역전철)을 이름에 붙이고 그 수단의 예매 링크를 둔다(자가용은 링크 없음)
  const legLabels = (stops: (typeof plan.days)[number]["stops"]) =>
    stops.map((s, k) => {
      if (k === 0) return undefined;
      const L = legInfo(
        stops[k - 1].place,
        s.place,
        plan.local,
        CITY_HUBS,
        METRO_CITY,
      );
      const wideMode = L.wide ? wideLegMode(stops[k - 1].place, s.place) : null;
      return t("legs.leg", {
        mode:
          wideMode && !L.own
            ? t(`legs.modes.wide_${wideMode}`)
            : L.wide
              ? t("legs.modes.wide")
              : t(`legs.modes.${plan.local}`),
        duration: duration(s.move),
        km: L.km.toFixed(1),
      });
    });
  const legLinks = (stops: (typeof plan.days)[number]["stops"]) =>
    stops.map((s, k) => {
      if (k === 0 || own) return undefined;
      const mode = wideLegMode(stops[k - 1].place, s.place);
      if (!mode) return undefined;
      const link = wideBookingLink(
        mode === "rail"
          ? railMode(CITY_HUBS[s.place.locKo]?.modes ?? [])
          : mode,
      );
      return link
        ? { href: link.href, label: t(`booking.${link.label}`) }
        : undefined;
    });

  // 「이 날에 장소 추가」의 도시(PoC _dayReg): 그 날 첫 장소, 없으면 다음 날 첫 장소 · 이전 날 마지막 장소의 도시.
  // 후보는 그 날 도시 장소를 앞에, 다른 도시 장소를 뒤에 둔 전체(여러 도시 코스)
  const dayCity = (i: number): string | null => {
    const first = plan.days[i].stops[0];
    if (first) return first.place.locKo;
    for (let k = i + 1; k < plan.days.length; k++) {
      const s = plan.days[k].stops[0];
      if (s) return s.place.locKo;
    }
    for (let k = i - 1; k >= 0; k--) {
      const s = plan.days[k].stops.at(-1);
      if (s) return s.place.locKo;
    }
    return course.city;
  };
  const inCourse = new Set(course.placeIds);
  const dayWeather = courseWeather(
    plan.days,
    plan.days.map((_, i) => addDays(startDate, i)),
    weatherQuery.data?.days ?? [],
    PLANNER_PLACES,
    inCourse,
  );
  const firstWeatherDay = dayWeather.findIndex((d) => d.weather !== null);
  /** 그날 날씨 줄(예보가 있을 때만). 경고일이면 야외 장소와 실내 대안을 함께 */
  const weatherStrip = (i: number) => {
    const d = dayWeather[i];
    if (!d || !d.weather) return null;
    const w = d.weather;
    // 장소가 없는 날은 예보 줄만(경고 · 「실내 장소뿐」 문구는 담은 장소가 있을 때만)
    const alert = plan.days[i].stops.length > 0 ? d.alert : null;
    const kind = tkinds(weatherKind(w.code));
    const Icon = alert === "heat" ? ThermometerSun : CloudRain;
    const insertIdx = dayInsertIndex(
      course.placeIds,
      plan.days[i].stops.map((s) => s.id),
    );
    return (
      <div
        className={`mt-3 rounded-card px-4 py-3 ${alert ? "bg-warning/10" : "bg-fill"}`}
      >
        <p className="flex items-center gap-2 text-caption text-fg-muted">
          <span className="font-semibold text-fg">{tw("label")}</span>
          <span className="tabular-nums">
            {tw("forecast", {
              kind,
              max: w.max === null ? "–" : Math.round(w.max),
              rain: Math.round(w.rain),
            })}
          </span>
        </p>
        {alert && (
          <p
            role="note"
            className="mt-1 flex items-start gap-2 text-label font-semibold text-warning"
          >
            <Icon size={18} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              {alert === "rain"
                ? d.flagged.length > 0
                  ? tw("rain", { count: d.flagged.length })
                  : tw("rainNone")
                : d.flagged.length > 0
                  ? tw("heat", {
                      count: d.flagged.length,
                      max: w.max === null ? "–" : Math.round(w.max),
                    })
                  : tw("heatNone", {
                      max: w.max === null ? "–" : Math.round(w.max),
                    })}
            </span>
          </p>
        )}
        {alert && d.flagged.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2">
            {d.flagged.map((f) => (
              <li key={f.place.id} className="text-caption">
                <span className="font-semibold text-fg">
                  {placeName(f.place, locale, names)}
                </span>
                <span className="ml-1 text-fg-muted">{tw("outdoor")}</span>
                {f.alternatives.length > 0 && (
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-fg-muted">{tw("alternatives")}</span>
                    {f.alternatives.map((alt) => (
                      <button
                        key={alt.id}
                        type="button"
                        onClick={() => {
                          store.insertAt(alt.id, insertIdx, alt.locKo);
                          setStatus(
                            t("dayAdd.added", {
                              day: plan.days[i].day,
                              name: placeName(alt, locale, names),
                            }),
                          );
                        }}
                        aria-label={tw("add", {
                          name: placeName(alt, locale, names),
                        })}
                        className="inline-flex min-h-9 items-center gap-1 rounded-full bg-surface px-3 text-label font-medium text-primary ring-1 ring-line focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill"
                      >
                        <Plus size={14} aria-hidden />
                        {placeName(alt, locale, names)}
                      </button>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {i === firstWeatherDay && (
          <p className="mt-2 text-micro text-fg-subtle">{tsheet("credit")}</p>
        )}
      </div>
    );
  };
  const poolByCity = new Map<string, PlannerPlace[]>();
  const addPool = (city: string) => {
    let pool = poolByCity.get(city);
    if (!pool) {
      pool = PLANNER_PLACES.filter((p) => !inCourse.has(p.id)).sort(
        (a, b) => Number(b.locKo === city) - Number(a.locKo === city),
      );
      poolByCity.set(city, pool);
    }
    return pool;
  };

  // ── 숙소(PoC dayPlan 숙소 · coursePanelBookings) ──
  const { stays: courseStays } = splitStays(places);
  const onToggleNightStay = (
    p: PlannerPlace,
    anchor: PlannerPlace,
    day: number,
  ) => {
    const on = inCourse.has(p.id);
    store.replace(
      course.city ?? p.locKo,
      toggleNightStay(course.placeIds, p.id, anchor, findAnyPlace),
    );
    const name = placeName(p, locale, names);
    setStatus(
      on
        ? t("nightStay.unsetStatus", { name })
        : t("nightStay.setStatus", { day, name }),
    );
  };
  // 마지막 날을 뺀 날의 「숙박」 카드
  const nightStayCard = (i: number) => {
    if (i >= plan.days.length - 1) return null;
    const anchor = nightAnchor(plan.days, i) as PlannerPlace | null;
    const stay = pickNightStay(anchor, courseStays, STAY_SAMPLES, i);
    if (!stay) return null;
    return (
      <CourseNightStay
        dayIndex={i}
        date={addLocalDays(startDate, i)}
        stay={stay}
        anchor={anchor}
        nearby={
          anchor
            ? nearbyStays(
                anchor,
                STAY_PLACES.filter((p) => p.locKo === anchor.locKo),
                STAY_SAMPLES,
              )
            : null
        }
        courseIds={inCourse}
        onToggle={(p) => {
          if (anchor) onToggleNightStay(p, anchor, i + 1);
        }}
      />
    );
  };
  // 코스 전체 숙박 예매: 체크인 = 출발일(없으면 오늘), 체크아웃 = 귀가일(같으면 다음 날), 검색어 = 일정 첫 경유지(없으면 도시)
  const courseStayLinks = () => {
    const first = plan.days.flatMap((d) => d.stops)[0]?.place;
    const city = plan.destination ?? heading;
    const query = first
      ? placeName(first, locale, names)
      : city
        ? cityName(city, locale, names)
        : "";
    return stayBookingLinks({
      query,
      ...tripStayDates(course.startDate, course.endDate, today),
      locale,
    });
  };

  const doRecommend = () => {
    const list = recommendCourse(
      withStayOverrides(autoPool, course.stayOv),
      settings,
      leadCity,
    );
    if (list.length === 0) {
      setNotice(t("actions.recommendEmpty"));
      return;
    }
    setNotice("");
    // 지정해 둔 숙박 장소는 추천 코스 뒤에도 남긴다(PoC _keepStay)
    store.replace(
      list[0].locKo,
      keepStays(
        list.map((p) => p.id),
        course.placeIds,
        findAnyPlace,
        courseCities(list),
      ),
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
    const newId = addPlannerPlan({
      name,
      city: course.city,
      placeIds: course.placeIds,
      settings: planSettings,
    });
    store.setPlanId(newId);
    setSaveError(null);
    setSavedName(name);
  };

  // 저장소 목록의 한 줄: 「{도시} · {n박 m일} · {n}곳」(ME와 같은 모양)
  const storeItems = [...savedPlans].reverse().map((p) => {
    const ps = parseSettings(p.settings);
    const days = tripDays(ps.startDate, ps.endDate ?? ps.startDate);
    return {
      id: p.id,
      name: p.name,
      sub: tm("plannerMeta", {
        city: p.city ? cityName(p.city, locale, names) : tp("nation"),
        duration:
          days === 1
            ? t("dates.dayTrip")
            : t("dates.nights", { nights: days - 1, days }),
        count: p.placeIds.length,
      }),
      current: p.id === activePlanId,
    };
  });
  const loadFromStore = (id: string) => {
    const p = savedPlans.find((x) => x.id === id);
    if (!p) return;
    if (course.placeIds.length > 0 && !sameIds(course.placeIds, p.placeIds)) {
      setTarget(p);
      setConfirm("load");
      return;
    }
    applyPlan(p);
    setStatus(t("load.loaded", { name: p.name }));
  };

  // 확인 창 문구
  const dialogText = () => {
    if (dialogKind === "overwrite" || dialogKind === "delete") {
      const key =
        dialogKind === "overwrite" ? "confirmOverwrite" : "confirmDelete";
      const name =
        (dialogKind === "overwrite" ? activePlan?.name : target?.name) ?? "";
      return {
        title: tplans(`${key}.title`),
        body: tplans(`${key}.body`, { name }),
        cancelLabel: tplans("cancel"),
        confirmLabel: tplans(`${key}.confirm`),
      };
    }
    const key =
      dialogKind === "load"
        ? "confirmLoad"
        : dialogKind === "clear"
          ? "confirmClear"
          : "confirmRecommend";
    return {
      title: t(`${key}.title`),
      body:
        dialogKind === "load" && loadPlan
          ? t("confirmLoad.body", {
              count: places.length,
              name: loadPlan.name,
              planCount: loadPlan.placeIds.length,
            })
          : dialogKind === "clear"
            ? t("confirmClear.body", { count: places.length })
            : t("confirmRecommend.body", {
                count: places.length,
                source: sourceName ?? "",
              }),
      cancelLabel: t("cancel"),
      confirmLabel: t(`${key}.confirm`),
    };
  };

  const nameErrorId = `${id}-name-error`;
  const recommendHintId = `${id}-recommend-hint`;
  const tidyHintId = `${id}-tidy-hint`;

  return (
    <div className="flex flex-col pt-6">
      <p role="status" className="sr-only">
        {status}
      </p>

      <header className="px-5">
        <p className="text-caption font-semibold text-primary">{t("kicker")}</p>
        <h2 className="mt-1 text-title font-bold">
          {plan.dayCount === 1
            ? t("title", { city: headingName })
            : t("titleTrip", {
                city: headingName,
                nights: plan.dayCount - 1,
                days: plan.dayCount,
              })}
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
          {activePlan && (
            <Button
              variant="secondary"
              size="md"
              block
              aria-disabled={places.length === 0 || undefined}
              onClick={() => {
                if (places.length === 0) return;
                setConfirm("overwrite");
              }}
              className={`mt-3 ${ARIA_DISABLED}`}
            >
              {tplans("overwrite", { name: activePlan.name })}
            </Button>
          )}
          <PlanStore
            items={storeItems}
            summaryRef={storeSummaryRef}
            onLoad={loadFromStore}
            onDelete={(pid) => {
              const p = savedPlans.find((x) => x.id === pid);
              if (!p) return;
              setTarget(p);
              setConfirm("delete");
            }}
          />
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
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                ["start", course.startDate ?? today, t("dates.notSet")],
                ["end", course.endDate, t("dates.endPending")],
              ] as const
            ).map(([key, value, fallback]) => (
              <div key={key} className="min-w-0 rounded-xl bg-fill px-3 py-2">
                <dt className="text-caption text-fg-muted">
                  {t(`dates.${key}`)}
                </dt>
                <dd className="text-body font-semibold tabular-nums">
                  {value ? dayLabel(value) : fallback}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3">
            <TripCalendar
              range={{ start: course.startDate, end: course.endDate }}
              today={today}
              onChange={(r) =>
                store.setSettings({ startDate: r.start, endDate: r.end })
              }
            />
          </div>
          {dError && (
            <p
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
      </div>

      <div className="mt-8 px-5">
        <CourseTransport
          options={plan.options}
          choice={plan.choice}
          local={plan.local}
          originName={
            plan.inbound
              ? pointName(plan.inbound.origin)
              : originName(plan.originKey)
          }
          hubName={hubName}
          accessHub={plan.inbound ? pointName(plan.inbound.chain.hubPt) : null}
          accessDuration={
            plan.inbound
              ? duration(plan.inbound.schedule.end - toMin(course.depTime))
              : null
          }
          onWide={onWide}
          onLocal={(mode) => store.setSettings({ localMode: mode })}
          alsoOn={plan.carFerry ? "ship" : null}
          jejuOwn={
            jejuOwn
              ? {
                  resident: course.jejuResident,
                  onPick: (v) => store.setSettings({ jejuResident: v }),
                }
              : null
          }
        >
          <CourseOrigins
            originKeys={originKeys}
            origin={plan.originKey}
            originEnd={course.originEnd === null ? null : plan.originEndKey}
            originName={originName}
            onOrigin={onOrigin}
            onOriginEnd={onOriginEnd}
            showOriginSelect={!metroWide && !plan.resident}
            depTime={course.depTime}
            retTime={course.retTime}
            depTimes={DEP_TIMES}
            retTimes={RET_TIMES}
            onDepTime={(v) => store.setSettings({ depTime: v })}
            onRetTime={(v) => store.setSettings({ retTime: v })}
            metroKind={metroKind}
            metroStart={{
              line: course.metroLine,
              station: course.metroOrigin,
              onLine: (v) =>
                store.setSettings({ metroLine: v, metroOrigin: "" }),
              onStation: (v) => store.setSettings({ metroOrigin: v }),
            }}
            metroEnd={{
              line: course.metroEndLine,
              station: course.metroEnd,
              onLine: (v) =>
                store.setSettings({ metroEndLine: v, metroEnd: "" }),
              onStation: (v) => store.setSettings({ metroEnd: v }),
            }}
          />
        </CourseTransport>
        {plan.island &&
          showFerryCard({
            island: plan.island,
            own,
            choice: plan.choice,
            jejuResident: course.jejuResident,
          }) && (
            <FerryCard
              island={plan.island}
              port={course.ferryPort[plan.island]}
              onPort={(k) => store.setFerryPort(plan.island!, k)}
              startDate={course.startDate}
            />
          )}
        {showJejuFlights({
          island: plan.island,
          own,
          choice: plan.choice,
        }) && (
          // 출발지가 바뀌면 처음 고를 공항도 바뀌므로 key로 새로 그린다
          <FlightCard
            key={`jeju-${plan.originKey}`}
            kind="jeju"
            initialAirport={jejuAirportFor(plan.originKey)}
          />
        )}
        {showBusanFlights({
          destination: plan.destination,
          own,
          choice: plan.choice,
        }) && <FlightCard kind="busan" />}
        <RoutingHowTo className="mt-6" />
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
              const name = placeName(p, locale, names);
              // 체류 시간 수정(PoC stayDec · stayInc · stayReset). 숙박 장소는 관광 시간에 들지 않아 두지 않는다
              const rec = basePlaces[i].min;
              const editable = !isStay(p);
              const changed = editable && p.min !== rec;
              // 숙박 장소는 일정에 들지 않고 그날 밤 숙소로만 쓴다(PoC courseList). 번호 대신 숙소 표시
              const order = editable
                ? places.slice(0, i + 1).filter((x) => !isStay(x)).length
                : null;
              const meta = [
                isCategoryKey(p.cat) ? tc(`categories.${p.cat}`) : null,
                editable ? null : t("list.stay"),
              ]
                .filter(Boolean)
                .join(" · ");
              const setStay = (v: number | null) => {
                store.setStay(p.id, rec, v);
                const next = v === null ? rec : Math.max(15, Math.min(600, v));
                setStatus(
                  t("stay.changed", { name, duration: duration(next) }),
                );
              };
              return (
                <li key={p.id} className="py-2 pr-3 pl-5">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-bold tabular-nums ${order === null ? "bg-primary-weak text-primary-strong" : "bg-fill text-fg-muted"}`}
                    >
                      {order ?? <BedDouble size={16} />}
                    </span>
                    <Link
                      href={
                        p.pickCity
                          ? plannerHref({ city: p.pickCity, place: p.id })
                          : plannerHref({ region: p.macro, place: p.id })
                      }
                      // 탭 바꾸기(replace)와 달리 기록을 하나 쌓는다. 지도 탭의 장소 시트를 닫으면 뒤로 가기로
                      // 이 코스 탭(누른 자리)에 돌아온다(lib/sheet-return.ts)
                      onClick={() => markSheetReturn(p.id)}
                      scroll={false}
                      className="ml-1 flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
                    >
                      <span className="flex items-center gap-2 text-body-lg font-semibold">
                        <CategoryIcon cat={p.cat} />
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
                  </div>
                  {editable && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-9">
                      <div className="flex items-center rounded-full bg-fill">
                        <button
                          type="button"
                          aria-label={t("stay.dec", { name })}
                          aria-disabled={p.min <= 15 || undefined}
                          onClick={() => {
                            if (p.min <= 15) return;
                            setStay((p.min || rec) - STAY_STEP);
                          }}
                          className={ICON_BUTTON}
                        >
                          <Minus size={20} aria-hidden />
                        </button>
                        <span
                          className={`min-w-20 text-center text-label font-semibold tabular-nums ${changed ? "text-primary-strong" : "text-fg"}`}
                        >
                          {tc("stay", { duration: duration(p.min) })}
                        </span>
                        <button
                          type="button"
                          aria-label={t("stay.inc", { name })}
                          aria-disabled={p.min >= 600 || undefined}
                          onClick={() => {
                            if (p.min >= 600) return;
                            setStay((p.min || rec) + STAY_STEP);
                          }}
                          className={ICON_BUTTON}
                        >
                          <Plus size={20} aria-hidden />
                        </button>
                      </div>
                      <span className="text-caption text-fg-subtle">
                        {t("stay.rec", { duration: duration(rec) })}
                      </span>
                      {changed && (
                        <button
                          type="button"
                          aria-label={t("stay.resetLabel", { name })}
                          onClick={() => setStay(null)}
                          className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-caption font-semibold text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-primary-weak motion-reduce:transition-none"
                        >
                          <RotateCcw size={16} aria-hidden />
                          {t("stay.reset")}
                        </button>
                      )}
                    </div>
                  )}
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
          disabled={places.length < 2}
          aria-describedby={tidyHintId}
          onClick={() => {
            const ids = tidyCourse(places);
            if (ids.every((pid, k) => pid === course.placeIds[k])) {
              setStatus(t("actions.tidyAlready"));
              return;
            }
            store.replace(course.city, ids);
            setStatus(t("actions.tidied", { count: ids.length }));
          }}
          className="mt-1"
        >
          {t("actions.tidy")}
        </Button>
        <p id={tidyHintId} className="px-1 text-caption text-fg-muted">
          {t("actions.tidyHint")}
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
                  <li key={p.id}>{placeName(p, locale, names)}</li>
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
              names={names}
              key={day.day}
              day={day}
              transport={plan.local === "transit" ? "public-transit" : "car"}
              date={dayDate(i)}
              legLabels={legLabels(day.stops)}
              legLinks={legLinks(day.stops)}
              before={
                <>
                  {i === 0 && chainCard(plan.inbound, "out")}
                  {i === 0 && arrivalCard()}
                  {weatherStrip(i)}
                </>
              }
              after={
                <>
                  {nightStayCard(i)}
                  {i === plan.days.length - 1 &&
                    chainCard(plan.outbound, "back")}
                  {(() => {
                    const city = dayCity(i);
                    return city ? (
                      <DayAddPlace
                        day={day.day}
                        city={city}
                        pool={addPool(city)}
                        onAdd={(p) => {
                          store.insertAt(
                            p.id,
                            dayInsertIndex(
                              course.placeIds,
                              day.stops.map((s) => s.id),
                            ),
                            p.locKo,
                          );
                          setStatus(
                            t("dayAdd.added", {
                              day: day.day,
                              name: placeName(p, locale, names),
                            }),
                          );
                        }}
                      />
                    ) : null;
                  })()}
                </>
              }
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
        <CourseBookingLinks stayLinks={courseStayLinks()} />
      </div>

      <UlleungNotice
        open={course.ulNotice}
        onClose={() => store.setUlNotice(false)}
      />
      <RouteChoiceDialog
        open={dialogKind === null && askView !== null}
        kicker={askView?.kicker ?? ""}
        title={askView?.title ?? ""}
        options={askView?.options ?? []}
        onPick={(mode) => {
          if (!askView) return;
          setRouteOpen(null);
          store.setSettings({
            routePick: { ...course.routePick, [askView.city]: mode },
          });
          setStatus(
            t("route.picked", { mode: t(`route.modes.${mode as "bus"}`) }),
          );
        }}
        onClose={() => {
          setRouteOpen(null);
          if (askView) store.skipRoute(askView.city);
        }}
      />

      <ConfirmDialog
        open={dialogKind !== null}
        {...dialogText()}
        onConfirm={() => {
          if (dialogKind === "load" && loadPlan) {
            if (loadOpen) setDismissedPlan(planId ?? null);
            else setConfirm(null);
            setTarget(null);
            setSaveError(null);
            setSavedName("");
            setStatus(t("load.loaded", { name: loadPlan.name }));
            applyPlan(loadPlan);
          } else if (dialogKind === "overwrite" && activePlan) {
            setConfirm(null);
            writePlannerPlans(
              overwritePlannerPlan(
                savedPlans,
                activePlan.id,
                {
                  city: course.city,
                  placeIds: course.placeIds,
                  settings: planSettings,
                },
                Date.now(),
              ),
            );
            setStatus(tplans("overwritten", { name: activePlan.name }));
          } else if (dialogKind === "delete" && target) {
            setConfirm(null);
            setTarget(null);
            writePlannerPlans(removePlannerPlan(savedPlans, target.id));
            if (target.id === activePlanId) store.setPlanId(null);
            setStatus(tplans("deleted", { name: target.name }));
            // 지운 행의 버튼이 없어지므로 초점을 저장소 목록 머리로 옮긴다
            storeSummaryRef.current?.focus();
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
          if (loadOpen) {
            setDismissedPlan(planId ?? null);
            leavePlanUrl(null);
          } else {
            setConfirm(null);
            setTarget(null);
          }
        }}
      />
    </div>
  );
}
