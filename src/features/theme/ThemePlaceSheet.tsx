"use client";

import {
  Bookmark,
  BookmarkCheck,
  CircleCheck,
  Clapperboard,
  Stamp,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { PlaceSheet } from "@/components/ui/PlaceSheet";
import { formatDuration } from "@/features/course/format-duration";
import type { Place } from "@/features/course/places";
import {
  directionsUrl,
  isCategoryKey,
  placeName,
  placePhoto,
} from "./place-meta";
import { useIdList } from "./storage";
import type { PlaceExtra } from "./theme-data";
import { useNameTable } from "@/features/names/NamesProvider";

type ThemePlaceSheetProps = {
  slug: string;
  /** 열 장소. null이면 닫힌다 */
  place: Place | null;
  extra?: PlaceExtra;
  /** 「장면 01 · 강을 건너 · 왕과 사는 남자」처럼 한 줄로 만든 장면 정보와 영화 탭 주소 */
  scene?: { text: string; href: string };
  onClose: () => void;
};

// 테마 화면의 장소 시트. 공통 PlaceSheet에 장면 링크와 저장 · 스탬프 버튼을 붙인다
export function ThemePlaceSheet({
  slug,
  place,
  extra,
  scene,
  onClose,
}: ThemePlaceSheetProps) {
  const t = useTranslations("Theme.sheet");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const names = useNameTable();
  const bookmarks = useIdList("bookmarks", slug);
  const stamps = useIdList("stamps", slug);

  const saved = place ? bookmarks.has(place.id) : false;
  const stamped = place ? stamps.has(place.id) : false;

  return (
    <PlaceSheet
      place={
        place && {
          name: placeName(place, locale, names),
          meta: [
            isCategoryKey(place.cat) ? tc(`categories.${place.cat}`) : "",
            place.min > 0
              ? tc("stay", { duration: formatDuration(tc, place.min) })
              : "",
          ],
          hours: place.hrs,
          description:
            extra?.desc?.[locale === "ko" ? "ko" : "en"] ?? extra?.desc?.ko,
          photo: extra?.img
            ? { src: placePhoto(extra.img), credit: extra.imgCredit }
            : null,
          directionsHref: directionsUrl(place, placeName(place, locale, names)),
        }
      }
      onClose={onClose}
      actions={
        place && (
          <>
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
          </>
        )
      }
    >
      {scene && (
        <Link
          href={scene.href}
          className="mt-4 flex min-h-11 items-center gap-2 rounded-2xl bg-primary-weak px-4 py-2.5 text-label font-semibold text-primary-strong transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none"
        >
          <Clapperboard size={20} className="shrink-0" aria-hidden />
          <span>{scene.text}</span>
        </Link>
      )}
    </PlaceSheet>
  );
}
