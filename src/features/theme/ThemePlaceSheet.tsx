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
import { hasHangul } from "@/lib/hangul";

/** 화면 언어로 옮긴 장소 글. 테마 페이지(서버)가 번역 표(features/translations)로 만들어 넘긴다 */
export type ThemePlaceText = {
  /** 운영시간 */
  hours?: string;
  /** 좌표 기준(한국어 주소를 뺀 출처). 없으면 줄을 숨긴다 */
  source?: string;
  /** 앱이 옮긴 글(장면 제목)이 시트에 보이는지 */
  appTranslated?: boolean;
};

type ThemePlaceSheetProps = {
  slug: string;
  /** 열 장소. null이면 닫힌다 */
  place: Place | null;
  extra?: PlaceExtra;
  /** 장면 한 줄 · 영화 탭 주소 · 상세 표 장면 행 · 영상 주소 */
  scene?: SceneLink;
  /** 외국어 화면의 옮긴 글(운영시간 · 좌표 기준). 한국어 화면은 없다 */
  text?: ThemePlaceText;
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
  text,
  onClose,
}: ThemePlaceSheetProps) {
  const t = useTranslations("Theme.sheet");
  const tc = useTranslations("Course");
  const locale = useLocale();
  const names = useNameTable();
  const stamps = useIdList("stamps", slug);
  const [stampStatus, setStampStatus] = useState("");

  const stamped = place ? stamps.has(place.id) : false;
  const ko = locale === "ko";
  // 좌표 기준 · 운영시간: 한국어 화면은 원문, 외국어 화면은 서버가 옮긴 글(한국어 주소는 뺀다)
  const source = ko ? (extra?.src?.ko ?? extra?.src?.en) : text?.source;
  const hours =
    place && (ko || !hasHangul(place.hrs) ? place.hrs : text?.hours);

  return (
    <PlaceSheet
      place={
        place && {
          name: placeName(place, locale, names),
          // 체류 시간은 상세 표 「권장 체류」에만 둔다(머리줄과 겹치지 않게)
          meta: [isCategoryKey(place.cat) ? tc(`categories.${place.cat}`) : ""],
          // 테마 장소 설명은 한국어 · 영어가 모두 있다(PoC bKo · bEn). 외국어 화면에 한국어 원문을 대신 보이지 않는다
          description: ko
            ? (extra?.desc?.ko ?? extra?.desc?.en)
            : extra?.desc?.en,
          photo: extra?.img
            ? { src: placePhoto(extra.img), credit: extra.imgCredit }
            : null,
          facts: {
            hours: hours ?? undefined,
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
          appTranslated: text?.appTranslated,
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
