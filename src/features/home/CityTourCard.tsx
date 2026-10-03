"use client";

import { ChevronDown, ExternalLink, Phone, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ConfirmDialog } from "@/features/planner/ConfirmDialog";
import { usePlannerCourse } from "@/features/planner/course-store";
import { cityName } from "@/features/planner/regions";
import { useNameTable } from "@/features/names/NamesProvider";
import { formatDate } from "@/lib/format-date";
import { krUnits } from "@/lib/kr-units";
import type { CityTourText } from "@/features/translations/text";
import {
  type CityTour,
  routeOverflows,
  tourFare,
  tourHours,
  tourProfile,
  tourRegion,
  type TourTag,
  tourTags,
} from "./citytour";

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * 시티투어 「코스빌더에 넣기」. 홈 지역 시티투어와 플래너 여행 정보 탭이 함께 쓴다.
 * 노선의 경유지 중 플래너 장소와 맞는 곳(scripts/build-citytour.mjs가 미리 대조)을 투어 플래너 코스에 넣고 코스 탭으로 간다.
 * 담아 둔 다른 코스가 있으면 먼저 묻는다(플래너 「추천 코스로 바꾸기」와 같다). dialog는 쓰는 쪽이 그린다
 */
export function useCityTourAdd() {
  const t = useTranslations("Home.citytour");
  const router = useRouter();
  const store = usePlannerCourse();
  // 확인을 기다리는 노선과 확인 창에 보일 노선 이름(화면 언어)
  const [pending, setPending] = useState<{
    tour: CityTour;
    name: string;
  } | null>(null);

  const put = (tour: CityTour) => {
    store.replace(tour.city, tour.placeIds);
    router.push("/planner?tab=course");
  };
  const onAdd = (tour: CityTour, name: string = tour.name) => {
    const current = store.course.placeIds;
    if (current.length > 0 && !sameIds(current, tour.placeIds)) {
      setPending({ tour, name });
    } else put(tour);
  };

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={t("confirm.title")}
      body={
        pending
          ? t("confirm.body", {
              count: store.course.placeIds.length,
              name: pending.name,
              placeCount: pending.tour.placeIds.length,
            })
          : ""
      }
      cancelLabel={t("confirm.cancel")}
      confirmLabel={t("confirm.confirm")}
      onConfirm={() => {
        if (pending) put(pending.tour);
        setPending(null);
      }}
      onCancel={() => setPending(null)}
    />
  );

  return { onAdd, dialog };
}

type CityTourCardProps = {
  tour: CityTour;
  /** 외국어 화면에서 보일 글(노선명 · 경로 · 탑승지 · 요금, 서버가 번역 표로 만든다). 한국어 화면은 없다 */
  text?: CityTourText;
  /** 내 유형 추천의 순위 */
  rank?: number;
  /** 추천 결과에서 이 코스가 채운 관심사 보장 자리(citytour.ts recommendTourPicks). 없으면 칩을 보이지 않는다 */
  reservedFor?: TourTag | null;
  onAdd: () => void;
};

// 코스 카드(article, 좌우로 넘기는 카드 줄 CardCarousel의 한 장): 유형 · 분류 칩 · 노선명 · 경로 · 탑승지 · 운행 시간 · 요금 · 홈페이지(새 창) · 전화 · 「코스빌더에 넣기」.
// 한국어 화면은 원천 그대로. 외국어 화면은 서버가 옮긴 글(text: 노선명 · 경로 · 탑승지 · 요금, features/translations)을 보인다.
// 경로가 3줄을 넘으면 3줄까지만 보이고 「경로 전체 보기」로 편다
export function CityTourCard({
  tour,
  text,
  rank,
  reservedFor,
  onAdd,
}: CityTourCardProps) {
  const t = useTranslations("Home.citytour");
  const locale = useLocale();
  const names = useNameTable();
  const hintId = useId();
  const tags = tourTags(tourProfile(tour));
  const hours = tourHours(tour);
  const fare = text ? text.fare : tourFare(tour);
  const board = text ? text.board : tour.board;
  const canAdd = tour.placeIds.length > 0;

  return (
    <article className="rounded-card bg-surface p-4 ring-1 ring-line">
      <p className="text-caption font-semibold text-primary">
        {rank !== undefined &&
          `${t("rank", { rank })} · ${cityName(tourRegion(tour), locale, names)} · `}
        {t(`kind.${tour.kind}`)}
      </p>
      <h4 className="mt-1 text-body-lg font-bold">{text?.name ?? tour.name}</h4>
      {/* 운영 도시가 여행지와 다르면(서울 출발 EG투어버스) 「서울 출발 · 여행지 파주」 */}
      {!tour.visits.includes(tour.region) && (
        <p className="mt-1 text-caption text-fg-muted">
          {t("departs", {
            from: cityName(tour.region, locale, names),
            to: tour.visits.map((c) => cityName(c, locale, names)).join(" · "),
          })}
        </p>
      )}
      {(tags.length > 0 || reservedFor) && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {reservedFor && (
            <li>
              <Chip tone="primary">
                {t("reserved", { tag: t(`tags.${reservedFor}`) })}
              </Chip>
            </li>
          )}
          {tags.map((tag) => (
            <li key={tag}>
              <Chip>{t(`tags.${tag}`)}</Chip>
            </li>
          ))}
        </ul>
      )}
      <TourRoute route={text?.route ?? tour.route} />
      <dl className="mt-2 flex flex-col gap-0.5 text-caption text-fg-subtle">
        {board && (
          <div className="flex gap-1.5">
            <dt className="shrink-0 font-semibold">{t("board")}</dt>
            <dd>{board}</dd>
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
            <dd>{text ? fare : krUnits(fare, locale)}</dd>
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
        {t("date", { date: formatDate(tour.date, locale) })}
      </p>
    </article>
  );
}

/**
 * 경로(「탑승지 → … → 도착」). 처음에는 3줄까지만 보이고(line-clamp-3), 잘린 글이 있을 때만 「경로 전체 보기」 토글을 둔다.
 * 잘렸는지는 그려진 높이로 잰다(citytour.ts routeOverflows). 폭이 바뀌면 다시 잰다
 */
function TourRoute({ route }: { route: string }) {
  const t = useTranslations("Home.citytour");
  const routeId = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [foldable, setFoldable] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    // 펼친 동안에는 재지 않는다(펼치면 잘린 글이 없어 토글이 사라진다)
    if (!el || open) return;
    const measure = () =>
      setFoldable(routeOverflows(el.scrollHeight, el.clientHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, route]);

  return (
    <>
      <p
        ref={ref}
        id={routeId}
        className={`mt-2 text-label text-fg-muted ${open ? "" : "line-clamp-3"}`}
      >
        {route}
      </p>
      {foldable && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={routeId}
          onClick={() => setOpen((v) => !v)}
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-label font-semibold text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
        >
          {open ? t("routeCollapse") : t("routeExpand")}
          <ChevronDown
            size={16}
            aria-hidden
            className={`transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </>
  );
}
