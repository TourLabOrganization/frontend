"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BedDouble,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Headphones,
  type LucideIcon,
  Route,
  UsersRound,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import {
  type CrowdLevel,
  crowdLevel,
  foldScript,
  formatPlayTime,
  isTourEmpty,
  TOUR_CROWD_SECONDS,
  TOUR_DAY_SECONDS,
  TOUR_TIMEOUT_MS,
  type TourAudio,
  type TourCrowd,
  type TourKind,
  tourPath,
  type TourRelated,
  type TourRelatedItem,
  type TourRelatedStay,
  upcomingCrowdDays,
} from "@/lib/tour";
import { cardIndex, stepCard } from "./audio-cards";
import { useTourApi } from "./tour-api-context";

type PlaceTourProps = {
  /** 플래너 장소 id. 서버가 이 id로 이름 · 좌표 · 시군구 코드를 찾는다 */
  id: string;
  /** 「함께 많이 가는 관광지」에서 우리 장소를 누르면 그 장소 시트로 바꾼다 */
  onOpenPlace?: (id: string) => void;
  /** 이 화면에서 열 수 있는 장소인지(플래너: 지금 범위의 장소, 테마: 그 테마 장소). 아니면 글자만 */
  canOpenPlace?: (id: string) => boolean;
};

/**
 * 장소 시트의 한국관광공사 칸 셋(날씨 칸 다음): 오디오 가이드 · 함께 많이 가는 관광지 Top · 방문 집중률 예측.
 * 시트가 열리면 각 칸이 우리 Route Handler(/api/tour/*)를 부른다. 받는 동안은 자리를 잡은 스켈레톤,
 * 실패 · 키 없음 · 결과 없음이면 칸 전체를 숨긴다(빈 상자 · 오류 문구를 남기지 않는다).
 * 서버에 키가 없으면(useTourApi) 부르지 않고 숨긴다. 한국어 화면의 오디오 가이드만 스토리텔링 대체가 있어 키 없이도 부른다
 */
export function PlaceTour({ id, onOpenPlace, canOpenPlace }: PlaceTourProps) {
  return (
    <>
      <AudioGuide id={id} />
      <RelatedSpots
        id={id}
        onOpenPlace={onOpenPlace}
        canOpenPlace={canOpenPlace}
      />
      <CrowdForecast id={id} />
    </>
  );
}

/**
 * 우리 Route Handler 부르기. 키 없음(503) · 잘못된 요청(4xx) · 결과 없음은 null(칸을 숨긴다, 다시 불러도 같다).
 * 외부 실패(502) · 네트워크 오류는 던져서 한 번 다시 부르고, 그래도 안 되면 숨긴다
 */
async function fetchTour<T>(
  kind: TourKind,
  id: string,
  locale?: string,
): Promise<T | null> {
  const res = await fetch(tourPath(kind, id, locale), {
    signal: AbortSignal.timeout(TOUR_TIMEOUT_MS),
  });
  if (res.status === 503 || (res.status >= 400 && res.status < 500))
    return null;
  if (!res.ok) throw new Error(`tour ${kind} ${res.status}`);
  const body: unknown = await res.json();
  return isTourEmpty(body) ? null : (body as T);
}

function useTour<T>(
  kind: TourKind,
  id: string,
  locale: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["tour", kind, id, locale ?? null],
    queryFn: () => fetchTour<T>(kind, id, locale),
    enabled,
    // Route Handler 캐시 간격과 같게. 그 안에는 같은 장소를 다시 부르지 않는다
    staleTime:
      (kind === "crowd" ? TOUR_CROWD_SECONDS : TOUR_DAY_SECONDS) * 1000,
    retry: 1,
  });
}

/** 받는 동안의 자리. 칸 모양(머리줄 + 줄 몇 개)으로 둔다. 결과가 없으면 칸과 함께 사라진다 */
function TourSkeleton({ lines }: { lines: number }) {
  return (
    <div aria-hidden className="mt-5 rounded-card border border-line">
      <div className="flex min-h-11 items-center gap-2 px-4">
        <span className="size-5 animate-pulse rounded-lg bg-fill motion-reduce:animate-none" />
        <span className="h-4 w-32 animate-pulse rounded-lg bg-fill motion-reduce:animate-none" />
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line px-4 py-3">
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={`h-4 animate-pulse rounded-lg bg-fill motion-reduce:animate-none ${i === lines - 1 ? "w-2/3" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}

/** 칸 머리줄: 아이콘 + 제목 */
function TourHeader({
  icon: Icon,
  titleId,
  title,
}: {
  icon: LucideIcon;
  titleId: string;
  title: string;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2 px-4">
      <Icon size={20} className="shrink-0 text-primary-bright" aria-hidden />
      <h3 id={titleId} className="text-label font-bold">
        {title}
      </h3>
    </div>
  );
}

/**
 * 오디오 가이드. 해설이 하나면 제목 · 음성(주소가 있을 때) · 대본(240자 접기) · 출처를 그대로 보이고,
 * 같은 관광지의 해설이 여럿(대표 + others)이면 밑으로 늘리지 않고 좌우로 넘기는 카드로 보인다:
 * 손가락 · 트랙패드로 밀면 카드 단위로 걸리고(scroll-snap), 이전 · 다음 화살표와 「n / 전체」 표시가 있다.
 * 음성 플레이어는 보이는 카드에만 붙인다(안 보이는 해설의 음성은 받지 않는다)
 */
function AudioGuide({ id }: { id: string }) {
  const t = useTranslations("PlaceSheet.tour.audio");
  const locale = useLocale();
  const titleId = useId();
  const enabled = useTourApi() || locale === "ko";
  const query = useTour<TourAudio>("audio", id, locale, enabled);

  if (!enabled) return null;
  if (query.isPending) return <TourSkeleton lines={3} />;
  const audio = query.data;
  if (!audio || !audio.script) return null;
  const cards = [audio, ...(audio.others ?? [])];

  return (
    <section
      aria-labelledby={titleId}
      className="mt-5 rounded-card border border-line"
    >
      <TourHeader icon={Headphones} titleId={titleId} title={t("title")} />
      <div className="border-t border-line px-4 py-3">
        {cards.length === 1 ? (
          <AudioCard audio={audio} active />
        ) : (
          <AudioCards cards={cards} />
        )}
        <p className="mt-1 text-micro text-fg-subtle">
          {audio.source === "odii" ? t("sourceOdii") : t("sourceStory")}
        </p>
      </div>
    </section>
  );
}

/** 해설 여러 건을 좌우로 넘기는 카드 줄. 보이는 카드 번호는 스크롤 위치로 알고, 화살표는 그 카드로 스크롤한다 */
function AudioCards({ cards }: { cards: TourAudio[] }) {
  const t = useTranslations("PlaceSheet.tour.audio");
  const rowRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const total = cards.length;

  function onScroll() {
    const row = rowRef.current;
    if (!row) return;
    setIndex(cardIndex(row.scrollLeft, row.clientWidth, total));
  }

  function go(step: -1 | 1) {
    const row = rowRef.current;
    if (!row) return;
    const next = stepCard(index, step, total);
    row.scrollTo({ left: next * row.clientWidth, behavior: "smooth" });
    setIndex(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption font-semibold text-fg-muted">
          {t("list", { count: total })}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t("prev")}
            disabled={index === 0}
            onClick={() => go(-1)}
            className="inline-flex size-11 items-center justify-center rounded-xl text-fg-muted focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill disabled:opacity-30"
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <p
            aria-live="polite"
            className="min-w-10 text-center text-caption text-fg-muted tabular-nums"
          >
            {t("position", { index: index + 1, total })}
          </p>
          <button
            type="button"
            aria-label={t("next")}
            disabled={index === total - 1}
            onClick={() => go(1)}
            className="inline-flex size-11 items-center justify-center rounded-xl text-fg-muted focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill disabled:opacity-30"
          >
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
      </div>
      <div
        ref={rowRef}
        onScroll={onScroll}
        role="group"
        aria-roledescription="carousel"
        aria-label={t("list", { count: total })}
        className="-mx-4 mt-1 flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card, i) => (
          <div
            key={`${card.title}-${i}`}
            role="group"
            aria-roledescription="slide"
            aria-label={t("position", { index: i + 1, total })}
            className="w-full shrink-0 snap-center px-4"
          >
            <div className="rounded-card border border-line bg-fill/40 px-3 py-3">
              <AudioCard audio={card} active={i === index} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 해설 한 건: 제목 · 음성(active이고 주소가 있을 때) · 재생 시간 · 대본(240자 접기) */
function AudioCard({ audio, active }: { audio: TourAudio; active: boolean }) {
  const t = useTranslations("PlaceSheet.tour.audio");
  const scriptId = useId();
  const [open, setOpen] = useState(false);
  const folded = foldScript(audio.script);
  const long = folded !== audio.script;
  return (
    <>
      {audio.title && <p className="text-body font-semibold">{audio.title}</p>}
      {audio.audioUrl && active && (
        <audio
          controls
          preload="none"
          src={audio.audioUrl}
          aria-label={t("player", { title: audio.title || t("title") })}
          className="mt-2 w-full"
        />
      )}
      {audio.playTime !== undefined && (
        <p className="mt-1 text-caption text-fg-muted tabular-nums">
          {t("playTime", { time: formatPlayTime(audio.playTime) })}
        </p>
      )}
      <p id={scriptId} className="mt-2 text-label whitespace-pre-line">
        {open || !long ? audio.script : folded}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={scriptId}
          onClick={() => setOpen((v) => !v)}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-xl px-1 text-label font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill"
        >
          {open ? t("less") : t("more")}
          {open ? (
            <ChevronUp size={16} aria-hidden />
          ) : (
            <ChevronDown size={16} aria-hidden />
          )}
        </button>
      )}
    </>
  );
}

/** YYYYMM → 화면 언어의 「2026년 7월」 · 「July 2026」 */
function formatMonth(ym: string, locale: string): string | null {
  const m = /^(\d{4})(\d{2})$/.exec(ym);
  if (!m) return null;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
}

/**
 * 함께 많이 가는 관광지 Top: 순위 · 이름 · 분류(관광지 · 음식 최대 8, 순위는 그 안에서 다시 매긴 것).
 * 그 아래 「함께 많이 찾는 숙소」(숙박 최대 3, 순위 번호 없이 — 숙소는 순위 계산에서 뺐다). 숙소가 없으면 그 부분은 그리지 않는다.
 * 이 화면에서 열 수 있는 우리 장소는 누르면 그 장소 시트로
 */
function RelatedSpots({
  id,
  onOpenPlace,
  canOpenPlace,
}: Omit<PlaceTourProps, "id"> & { id: string }) {
  const t = useTranslations("PlaceSheet.tour.related");
  const locale = useLocale();
  const titleId = useId();
  const enabled = useTourApi();
  const query = useTour<TourRelated>("related", id, locale, enabled);

  if (!enabled) return null;
  if (query.isPending) return <TourSkeleton lines={4} />;
  const items = Array.isArray(query.data?.items) ? query.data.items : [];
  const stays = Array.isArray(query.data?.stays) ? query.data.stays : [];
  const month = query.data ? formatMonth(query.data.month, locale) : null;
  if (items.length === 0 || !month) return null;

  /** 우리 장소이고 이 화면에서 열 수 있으면 누르는 줄, 아니면 글자만 */
  const line = (placeId: string | undefined, content: React.ReactNode) => {
    const openable =
      placeId !== undefined &&
      onOpenPlace !== undefined &&
      (canOpenPlace?.(placeId) ?? false);
    return openable ? (
      <button
        type="button"
        onClick={() => onOpenPlace(placeId)}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
      >
        {content}
        <ChevronRight
          size={16}
          className="shrink-0 text-fg-subtle"
          aria-hidden
        />
      </button>
    ) : (
      <div className="flex min-h-11 items-center gap-3 px-4 py-2.5">
        {content}
      </div>
    );
  };

  return (
    <section
      aria-labelledby={titleId}
      className="mt-5 rounded-card border border-line"
    >
      <TourHeader icon={Route} titleId={titleId} title={t("title")} />
      <ol className="divide-y divide-line border-y border-line">
        {items.map((item) => (
          <li key={`${item.rank}-${item.name}`}>
            {line(item.placeId, <RelatedRow item={item} />)}
          </li>
        ))}
      </ol>
      {stays.length > 0 && (
        <div className="border-b border-line">
          <h4 className="px-4 pt-3 pb-1 text-caption font-semibold text-fg-muted">
            {t("stays")}
          </h4>
          <ul className="divide-y divide-line">
            {stays.map((stay) => (
              <li key={stay.name}>
                {line(stay.placeId, <StayRow stay={stay} />)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="px-4 py-2.5 text-micro text-fg-subtle">
        {t("source", { month })}
      </p>
    </section>
  );
}

function RelatedRow({ item }: { item: TourRelatedItem }) {
  const t = useTranslations("PlaceSheet.tour.related");
  return (
    <>
      <span
        aria-hidden
        className="w-6 shrink-0 text-label font-bold text-primary tabular-nums"
      >
        {item.rank}
      </span>
      <span className="sr-only">{t("rank", { rank: item.rank })}</span>
      <RelatedName name={item.name} category={item.category} />
    </>
  );
}

/** 숙소 한 줄: 순위 번호 자리에 침대 표시(장식) */
function StayRow({ stay }: { stay: TourRelatedStay }) {
  return (
    <>
      <span aria-hidden className="w-6 shrink-0 text-fg-subtle">
        <BedDouble size={16} />
      </span>
      <RelatedName name={stay.name} category={stay.category} />
    </>
  );
}

function RelatedName({ name, category }: { name: string; category: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-label font-semibold">{name}</span>
      {category && (
        <span className="text-caption text-fg-muted">{category}</span>
      )}
    </span>
  );
}

/** 수준별 막대 색(그래픽 3:1 이상)과 글자 색(4.5:1 이상). 색만으로 뜻을 전하지 않고 수준 이름을 함께 쓴다 */
const LEVEL_BAR: Record<CrowdLevel, string> = {
  quiet: "bg-primary-bright",
  moderate: "bg-warning",
  busy: "bg-danger",
};
const LEVEL_TEXT: Record<CrowdLevel, string> = {
  quiet: "text-primary",
  moderate: "text-warning",
  busy: "text-danger",
};

/** 방문 집중률 예측: 오늘부터 7일 — 날짜 · 막대 · 집중률 % · 수준(여유 · 보통 · 혼잡) */
function CrowdForecast({ id }: { id: string }) {
  const t = useTranslations("PlaceSheet.tour.crowd");
  const locale = useLocale();
  const titleId = useId();
  const enabled = useTourApi();
  const query = useTour<TourCrowd>("crowd", id, undefined, enabled);

  if (!enabled) return null;
  if (query.isPending) return <TourSkeleton lines={4} />;
  const crowd = query.data;
  const days =
    crowd && Array.isArray(crowd.days)
      ? upcomingCrowdDays(crowd.days, new Date(), 7)
      : [];
  if (!crowd || days.length === 0) return null;
  const dayFormat = new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });

  return (
    <section
      aria-labelledby={titleId}
      className="mt-5 rounded-card border border-line"
    >
      <TourHeader icon={UsersRound} titleId={titleId} title={t("title")} />
      <ul className="flex flex-col gap-2 border-t border-line px-4 py-3">
        {days.map((d) => {
          // 화면에는 정수 %로 반올림해 보이고, 수준(40 · 70)은 받은 값 그대로 판정한다(69.6 → 「70%」 · 보통)
          const pct = Math.round(d.rate);
          const level = crowdLevel(d.rate);
          const [y, m, day] = d.date.split("-").map(Number);
          return (
            <li
              key={d.date}
              className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 text-caption"
            >
              <span className="whitespace-nowrap text-fg-muted tabular-nums">
                {dayFormat.format(Date.UTC(y, m - 1, day))}
              </span>
              <span
                aria-hidden
                className="h-2 overflow-hidden rounded-full bg-fill"
              >
                <span
                  className={`block h-full rounded-full ${LEVEL_BAR[level]}`}
                  style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                />
              </span>
              <span className="whitespace-nowrap tabular-nums">
                <span className="font-semibold">{pct}%</span>{" "}
                <span className={`font-semibold ${LEVEL_TEXT[level]}`}>
                  {t(`levels.${level}`)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-1 px-4 pb-3">
        <p className="text-caption text-fg-muted">{t("note")}</p>
        <p className="text-micro text-fg-subtle">
          {t("source", { name: crowd.name })}
        </p>
      </div>
    </section>
  );
}
