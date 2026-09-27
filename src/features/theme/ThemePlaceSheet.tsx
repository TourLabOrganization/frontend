"use client";

import { CircleCheck, Clapperboard, Stamp } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PlaceSheet } from "@/components/ui/PlaceSheet";
import { SavePlaceButton } from "@/components/ui/SavePlaceButton";
import { formatDuration } from "@/features/course/format-duration";
import type { Place } from "@/features/course/places";
import {
  directionsUrl,
  isCategoryKey,
  placeName,
  placePhoto,
} from "./place-meta";
import { workTitle } from "./work-titles";
import { useIdList } from "./storage";
import type { PlaceExtra } from "./theme-data";
import type { SceneLink } from "./MapTab";
import { useNameTable } from "@/features/names/NamesProvider";

type ThemePlaceSheetProps = {
  slug: string;
  /** 열 장소. null이면 닫힌다 */
  place: Place | null;
  extra?: PlaceExtra;
  /** 장면 한 줄 · 영화 탭 주소 · 상세 표 장면 행 · 영상 주소 */
  scene?: SceneLink;
  onClose: () => void;
};

// 테마 화면의 장소 시트. 공통 PlaceSheet에 상세 표 값 · 영상 링크 · 장면 링크와 저장 · 스탬프 버튼을 붙인다.
// 스탬프는 테마 스탬프 탭과 같은 저장소(tn.stamps.{slug})를 쓰는 토글이다. PoC 코드의 스탬프 찍기(d_toggleStamp)도
// 위치 확인 없이 토글만 해서, 위치 확인 규칙(반경 · 정확도)은 옮기지 않았다
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
  const stamps = useIdList("stamps", slug);
  const [stampStatus, setStampStatus] = useState("");

  const stamped = place ? stamps.has(place.id) : false;
  // 좌표 기준 원문은 한국어 · 영어뿐이라 한국어가 아닌 화면은 영어(PoC dp['src'+S] || dp.srcEn)
  const source =
    locale === "ko"
      ? (extra?.src?.ko ?? extra?.src?.en)
      : (extra?.src?.en ?? extra?.src?.ko);

  return (
    <PlaceSheet
      place={
        place && {
          name: placeName(place, locale, names),
          // 체류 시간은 상세 표 「권장 체류」에만 둔다(머리줄과 겹치지 않게)
          meta: [isCategoryKey(place.cat) ? tc(`categories.${place.cat}`) : ""],
          description:
            extra?.desc?.[locale === "ko" ? "ko" : "en"] ?? extra?.desc?.ko,
          photo: extra?.img
            ? { src: placePhoto(extra.img), credit: extra.imgCredit }
            : null,
          facts: {
            hours: place.hrs,
            // 숙박 장소는 일정에 들지 않아(course/schedule.ts) 권장 체류를 보이지 않는다
            stay:
              place.min > 0 && place.cat !== "stay"
                ? formatDuration(tc, place.min)
                : undefined,
            work: extra?.work && workTitle(extra.work, locale),
            scene: scene?.row,
            lat: place.lat,
            lng: place.lng,
            source,
            kakaoUrl: extra?.url,
          },
          videoHref: scene?.video,
          directionsHref: directionsUrl(place, placeName(place, locale, names)),
        }
      }
      onClose={() => {
        setStampStatus("");
        onClose();
      }}
      actions={
        place && (
          <>
            <SavePlaceButton key={place.id} place={place} source={slug} />
            <Button
              variant="secondary"
              size="md"
              className="flex-auto"
              aria-pressed={stamped}
              onClick={() => {
                stamps.toggle(place.id);
                setStampStatus(
                  stamped ? t("unstampedStatus") : t("stampedStatus"),
                );
              }}
            >
              {stamped ? (
                <CircleCheck size={20} className="text-primary" aria-hidden />
              ) : (
                <Stamp size={20} aria-hidden />
              )}
              {stamped ? t("stamped") : t("stamp")}
            </Button>
            <span role="status" className="sr-only">
              {stampStatus}
            </span>
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
