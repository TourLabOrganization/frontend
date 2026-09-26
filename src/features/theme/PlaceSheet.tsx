"use client";

import {
  Bookmark,
  BookmarkCheck,
  CircleCheck,
  Clapperboard,
  Navigation,
  Stamp,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { formatDuration } from "@/features/course/format-duration";
import type { Place } from "@/features/course/places";
import {
  directionsUrl,
  isCategoryKey,
  placeName,
  placePhoto,
  SECONDARY_LINK_CLASS,
} from "./place-meta";
import { useIdList } from "./storage";
import type { PlaceExtra } from "./theme-data";

type PlaceSheetProps = {
  slug: string;
  /** 열 장소. null이면 닫힌다 */
  place: Place | null;
  extra?: PlaceExtra;
  /** 「장면 01 · 강을 건너 · 왕과 사는 남자」처럼 한 줄로 만든 장면 정보와 영화 탭 주소 */
  scene?: { text: string; href: string };
  onClose: () => void;
};

// 장소 시트. 아래에서 올라오는 모달 dialog다.
// showModal()이 바깥을 inert로 만들어 초점을 시트 안에 가두고, Esc로 닫힌다. 바깥(배경)을 눌러도 닫는다
export function PlaceSheet({
  slug,
  place,
  extra,
  scene,
  onClose,
}: PlaceSheetProps) {
  const t = useTranslations("Theme.sheet");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const bookmarks = useIdList("bookmarks", slug);
  const stamps = useIdList("stamps", slug);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (place && !dialog.open) dialog.showModal();
    if (!place && dialog.open) dialog.close();
  }, [place]);

  const name = place ? placeName(place, locale) : "";
  const category =
    place && isCategoryKey(place.cat) ? tc(`categories.${place.cat}`) : null;
  const meta = place
    ? [
        category,
        place.min > 0
          ? tc("stay", { duration: formatDuration(tc, place.min) })
          : null,
      ].filter(Boolean)
    : [];
  const desc =
    extra?.desc?.[locale === "ko" ? "ko" : "en"] ?? extra?.desc?.ko ?? null;
  const saved = place ? bookmarks.has(place.id) : false;
  const stamped = place ? stamps.has(place.id) : false;

  return (
    <dialog
      ref={ref}
      aria-labelledby="place-sheet-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="inset-x-0 mx-auto mt-auto mb-0 max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-t-card bg-surface p-0 text-fg backdrop:bg-fg/40"
    >
      {place && (
        <div className="px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex justify-end">
            <button
              type="button"
              aria-label={t("close")}
              onClick={() => ref.current?.close()}
              className="flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
            >
              <X size={24} aria-hidden />
            </button>
          </div>

          {extra?.img && (
            <figure className="mb-4">
              <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-fill">
                <Image
                  src={placePhoto(extra.img)}
                  alt={name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              {extra.imgCredit && (
                <figcaption className="mt-1.5 text-micro text-fg-subtle">
                  {t("photoCredit", { credit: extra.imgCredit })}
                </figcaption>
              )}
            </figure>
          )}

          <h2 id="place-sheet-title" className="text-headline font-bold">
            {name}
          </h2>
          {meta.length > 0 && (
            <p className="mt-1 text-label text-fg-muted">{meta.join(" · ")}</p>
          )}
          {place.hrs && (
            <p className="mt-1 text-label text-fg-subtle">
              <span className="sr-only">{t("hours")} </span>
              {place.hrs}
            </p>
          )}
          {desc && <p className="mt-4 text-body">{desc}</p>}

          {scene && (
            <Link
              href={scene.href}
              className="mt-4 flex min-h-11 items-center gap-2 rounded-2xl bg-primary-weak px-4 py-2.5 text-label font-semibold text-primary-strong transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none"
            >
              <Clapperboard size={20} className="shrink-0" aria-hidden />
              <span>{scene.text}</span>
            </Link>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={directionsUrl(place)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${SECONDARY_LINK_CLASS} flex-auto`}
            >
              <Navigation size={20} aria-hidden />
              {t("directions")}
              <span className="sr-only">{t("newWindow")}</span>
            </a>
            <Button
              variant="secondary"
              size="md"
              className="flex-auto"
              aria-pressed={saved}
              onClick={() => bookmarks.toggle(place.id)}
            >
              {saved ? (
                <BookmarkCheck size={20} className="text-primary" aria-hidden />
              ) : (
                <Bookmark size={20} aria-hidden />
              )}
              {t("save")}
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="flex-auto"
              aria-pressed={stamped}
              onClick={() => stamps.toggle(place.id)}
            >
              {stamped ? (
                <CircleCheck size={20} className="text-primary" aria-hidden />
              ) : (
                <Stamp size={20} aria-hidden />
              )}
              {t("stamp")}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
