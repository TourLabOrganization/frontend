"use client";

import { ExternalLink, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SearchField } from "@/components/ui/SearchField";
import { hasViews, type SceneSort, searchCards, sortCards } from "./place-list";
import { SECONDARY_LINK_CLASS } from "./place-meta";

export type ScenePlace = { id: string; label: string; href: string };

/** 영화 · 드라마 장면 카드 */
export type FilmCard = {
  kind: "film";
  id: string;
  /** "장면 01"의 숫자. 라벨에 숫자가 없으면 라벨 그대로 */
  number: string;
  title: string;
  query: string;
  sceneTitle?: string;
  work?: string;
  places: ScenePlace[];
  /** 검색 대상(장면 제목 · 장소 이름 한 · 영) */
  texts: string[];
};

/** RESCENE 뮤직비디오 · 영상 카드 */
export type VideoCard = {
  kind: "video";
  /** 유튜브 영상 id */
  id: string;
  date: string;
  /** PoC에 적힌 조회수. 없으면 비운다 */
  views?: number;
  sceneTitle?: string;
  /** 시작 시각(초) */
  start?: number;
  places: ScenePlace[];
  texts: string[];
};

type FilmTabProps = {
  cards: readonly (FilmCard | VideoCard)[];
  /** RESCENE(뮤직비디오)면 true */
  video: boolean;
};

// 영화 탭. 정렬(영화 · 드라마: 장면순 · 역순, RESCENE: 인기순 · 최신순)과 검색(장면 제목 · 장소 이름).
// RESCENE 인기순은 PoC에 적힌 조회수로 줄 세운다. 조회수가 하나도 없으면 인기순 · 최신순 칩을 두지 않는다(게시일순).
// 카드 id는 장면 id라 지도 시트 · 지도 목록의 #장면 링크가 여기로 온다
export function FilmTab({ cards, video }: FilmTabProps) {
  const t = useTranslations("Theme.film");
  const sorts: readonly SceneSort[] = video
    ? hasViews(cards)
      ? ["popular", "latest"]
      : []
    : ["asc", "desc"];
  const [sort, setSort] = useState<SceneSort>(
    sorts[0] ?? (video ? "latest" : "asc"),
  );
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);

  const shown = sortCards(searchCards(cards, query), sort);
  const sortLabel: Record<SceneSort, string> = {
    asc: t("sortAsc"),
    desc: t("sortDesc"),
    popular: t("sortPopular"),
    latest: t("sortLatest"),
  };

  return (
    <>
      <section className="px-6 pt-6">
        <p className="text-caption font-semibold text-primary">
          {video ? t("kickerVideo") : t("kicker")}
        </p>
        <h2 className="mt-1 text-title font-bold">
          {video ? t("titleVideo") : t("title")}
        </h2>
      </section>

      <div className="mt-4 flex flex-col gap-3 px-5">
        {sorts.length > 0 && (
          <div
            role="group"
            aria-label={t("sortLabel")}
            className="flex gap-1 rounded-2xl bg-fill p-1"
          >
            {sorts.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-label transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
                  sort === key
                    ? "bg-surface font-semibold text-fg ring-1 ring-line"
                    : "font-medium text-fg-muted active:bg-line"
                }`}
              >
                {sortLabel[key]}
              </button>
            ))}
          </div>
        )}
        <SearchField
          value={query}
          onChange={setQuery}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          clearLabel={t("searchClear")}
        />
        <p role="status" className="sr-only">
          {query.trim() ? t("searchStatus", { count: shown.length }) : ""}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="mt-10 px-6 text-center text-body text-fg-muted">
          {t("empty")}
        </p>
      ) : (
        <ol className="mt-6 flex flex-col gap-4 px-5">
          {shown.map((card, index) => (
            <li
              key={card.id}
              id={card.id}
              className="scroll-mt-16 overflow-hidden rounded-card ring-1 ring-line"
            >
              {card.kind === "video" ? (
                <VideoMedia
                  card={card}
                  eager={index === 0}
                  playing={playing === card.id}
                  onPlay={() => setPlaying(card.id)}
                />
              ) : null}
              <div className="p-5">
                {card.kind === "film" ? (
                  <p className="flex flex-wrap items-baseline gap-x-3">
                    <span className="text-display font-bold tabular-nums">
                      {t("sceneLabel", { number: card.number })}
                    </span>
                    <span className="text-body-lg font-semibold text-fg-muted">
                      {card.title}
                    </span>
                  </p>
                ) : (
                  <p className="flex flex-wrap gap-x-3 text-label font-semibold text-fg-muted tabular-nums">
                    {card.views !== undefined && (
                      <span className="text-primary-strong">
                        {t("views", { count: card.views })}
                      </span>
                    )}
                    <span>{card.date}</span>
                  </p>
                )}
                {card.sceneTitle && (
                  <h3 className="mt-2 text-body-lg font-semibold">
                    {card.sceneTitle}
                  </h3>
                )}
                {card.kind === "film" && card.work && (
                  <p className="mt-1 text-label text-fg-muted">{card.work}</p>
                )}
                {card.places.length > 0 && (
                  <>
                    <p className="mt-4 text-caption font-semibold text-fg-subtle">
                      {t("places")}
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {card.places.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={p.href}
                            className="inline-flex min-h-11 items-center rounded-lg bg-primary-weak px-3 text-label font-medium text-primary-strong transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none"
                          >
                            {p.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {card.kind === "film" && (
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(card.query)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${SECONDARY_LINK_CLASS} mt-4 w-full`}
                  >
                    {t("watch")}
                    <ExternalLink size={16} aria-hidden />
                    <span className="sr-only">{t("newWindow")}</span>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** 영상 썸네일. 재생 버튼을 누르면 그 자리에서 youtube-nocookie 플레이어로 바꾼다 */
function VideoMedia({
  card,
  eager,
  playing,
  onPlay,
}: {
  card: VideoCard;
  /** 첫 카드는 화면 위쪽이라 바로 불러온다 */
  eager: boolean;
  playing: boolean;
  onPlay: () => void;
}) {
  const t = useTranslations("Theme.film");
  const name = card.sceneTitle ?? card.date;

  if (playing) {
    const params = new URLSearchParams({ autoplay: "1" });
    if (card.start) params.set("start", String(card.start));
    return (
      <div className="aspect-video bg-fg">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${card.id}?${params.toString()}`}
          title={t("videoTitle", { title: name })}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          className="size-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      className="group relative block aspect-video w-full bg-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright"
    >
      <Image
        src={`https://i.ytimg.com/vi/${card.id}/hqdefault.jpg`}
        alt=""
        fill
        loading={eager ? "eager" : undefined}
        sizes="(min-width: 480px) 440px, 100vw"
        className="object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-fg/70 text-white transition-transform duration-150 group-active:scale-95 motion-reduce:transition-none">
          <Play size={24} className="translate-x-0.5" aria-hidden />
        </span>
      </span>
      <span className="sr-only">{t("play", { title: name })}</span>
    </button>
  );
}
