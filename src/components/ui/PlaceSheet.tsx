"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Navigation, Play, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClassName } from "./Button";
import { Chip } from "./Chip";
import { PlaceTour } from "./PlaceTour";
import { PlaceWeather } from "./PlaceWeather";
import {
  PHOTO_STALE_MS,
  PHOTO_TIMEOUT_MS,
  type PlacePhotoResponse,
} from "./place-photo";
import { breakBeforeContact, formatStayHours } from "./stay-hours";

export type PlaceSheetPlace = {
  /** 플래너 장소 id(테마 장소도 같은 id다). 있으면 날씨 칸 다음에 한국관광공사 칸(오디오 가이드 · 함께 많이 가는 관광지 · 방문 집중률)을 둔다 */
  id?: string;
  /** 제목(화면 언어의 장소 이름). 사진의 대체 글도 이 이름이다 */
  name: string;
  /** 제목 아래 한 줄. 「경주 · 문화유산·전통체험」처럼 " · "로 잇는다. 체류 시간은 상세 표(권장 체류)에만 둔다 */
  meta?: readonly string[];
  /** 제목 아래 배지 줄(플래너: 데이터랩 인기 · 유네스코 · 관광특구 등). 없으면 줄을 그리지 않는다 */
  badges?: readonly { label: string; tone?: "neutral" | "primary" }[];
  description?: string | null;
  /** 상세 표. PoC 장소 상세 순서대로 그리고, 값이 없는 행은 뺀다 */
  facts: PlaceFacts;
  /** 이 장소가 나오는 영상(YouTube) 주소. 새 창으로 연다 */
  videoHref?: string;
  /** 사진(Wikimedia 등 외부 주소는 unoptimized로 브라우저가 바로 받는다)과 출처 */
  photo?: { src: string; credit?: string } | null;
  /** 길찾기(카카오맵) 주소. 새 창으로 연다 */
  directionsHref: string;
  /** 앱이 옮긴 이름 · 설명(원천에 그 언어가 없던 값)이 보이면 true. 상세 표 아래에 안내 한 줄을 둔다 */
  appTranslated?: boolean;
};

export type PlaceFacts = {
  /** 운영시간(화면 언어로 옮긴 글. 한국어 화면은 원문) */
  hours?: string;
  /** 권장 체류 (「1시간 30분」처럼 화면 언어로 만든 글) */
  stay?: string;
  /** 작품 · 채널 이름 */
  work?: string;
  /** 장면 한 줄 */
  scene?: string;
  lat: number;
  lng: number;
  /** 좌표 기준 (화면 언어로 옮긴 글. 외국어 화면은 한국어 주소를 뺀다) */
  source?: string;
  /** 카카오맵 장소 페이지 */
  kakaoUrl?: string;
};

type PlaceSheetProps = {
  /** 열 장소. null이면 닫힌다 */
  place: PlaceSheetPlace | null;
  /** 설명 아래에 넣을 칸 (테마 화면의 장면 링크 등) */
  children?: React.ReactNode;
  /** 「길찾기」 옆 버튼들. 쓰는 화면이 정한다 (테마: 저장 · 스탬프, 플래너: 코스에 담기) */
  actions?: React.ReactNode;
  /** 「함께 많이 가는 관광지」에서 우리 장소를 누르면 그 장소로 시트를 바꾼다(쓰는 화면의 장소 열기) */
  onOpenPlace?: (id: string) => void;
  /** 이 화면에서 열 수 있는 장소인지. 아니면 그 줄은 글자만 둔다 */
  canOpenPlace?: (id: string) => boolean;
  onClose: () => void;
};

// 장소 시트. 아래에서 올라오는 모달 dialog다. 테마 화면 지도 탭과 투어 플래너 지도 탭이 함께 쓴다.
// showModal()이 바깥을 inert로 만들어 초점을 시트 안에 가두고, Esc로 닫힌다. 바깥(배경)을 눌러도 닫는다
export function PlaceSheet({
  place,
  children,
  actions,
  onOpenPlace,
  canOpenPlace,
  onClose,
}: PlaceSheetProps) {
  const t = useTranslations("PlaceSheet");
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  // 받지 못한 사진 주소. 깨진 사진 칸 대신 사진 없이 보인다
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // 장소 자료에 사진이 없으면 대표 사진을 서버에서 찾는다(한국관광공사 관광정보 · 관광사진 → 위키백과, app/api/tour/photo)
  const lookupId = place && !place.photo && place.id ? place.id : null;
  const found = useQuery({
    queryKey: ["place-photo", lookupId],
    queryFn: async (): Promise<PlacePhotoResponse> => {
      const res = await fetch(
        `/api/tour/photo?id=${encodeURIComponent(lookupId!)}`,
        { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) },
      );
      if (!res.ok) throw new Error(`photo ${res.status}`);
      return (await res.json()) as PlacePhotoResponse;
    },
    enabled: lookupId !== null,
    staleTime: PHOTO_STALE_MS,
    retry: false,
  });
  const photo =
    place?.photo ??
    (lookupId && found.data && "src" in found.data
      ? {
          src: found.data.src,
          credit: t(`photoSources.${found.data.source}`),
        }
      : null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (place && !dialog.open) dialog.showModal();
    if (!place && dialog.open) dialog.close();
  }, [place]);

  // 열린 채로 다른 장소로 바뀌면(함께 많이 가는 관광지) 맨 위로 올리고 제목으로 초점을 옮긴다(누른 줄이 사라지므로)
  const placeId = place?.id;
  const shownId = useRef(placeId);
  useEffect(() => {
    const previous = shownId.current;
    shownId.current = placeId;
    const dialog = ref.current;
    if (!dialog?.open || !previous || !placeId || previous === placeId) return;
    dialog.scrollTop = 0;
    titleRef.current?.focus();
  }, [placeId]);

  const meta = place?.meta?.filter(Boolean) ?? [];

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="inset-x-0 mx-auto mt-auto mb-0 max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-t-card bg-surface p-0 text-fg backdrop:bg-ink/40"
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

          {photo && photo.src !== failedSrc && (
            <figure className="mb-4">
              <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-fill">
                <Image
                  src={photo.src}
                  alt={place.name}
                  fill
                  unoptimized
                  // 시트가 열려 있을 때만 그려지므로 사진은 늘 보이는 자리다. 미루지 않는다
                  loading="eager"
                  onError={() => setFailedSrc(photo.src)}
                  className="object-cover"
                />
              </div>
              {photo.credit && (
                <figcaption className="mt-1.5 text-micro text-fg-subtle">
                  {t("photoCredit", { credit: photo.credit })}
                </figcaption>
              )}
            </figure>
          )}

          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="text-headline font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
          >
            {place.name}
          </h2>
          {meta.length > 0 && (
            <p className="mt-1 text-label text-fg-muted">{meta.join(" · ")}</p>
          )}
          {place.badges && place.badges.length > 0 && (
            <ul
              aria-label={t("badges")}
              className="mt-2 flex flex-wrap gap-1.5"
            >
              {place.badges.map((b) => (
                <li key={b.label}>
                  <Chip tone={b.tone}>{b.label}</Chip>
                </li>
              ))}
            </ul>
          )}
          {place.description && (
            <p className="mt-4 text-body">{place.description}</p>
          )}

          {place.videoHref && (
            <a
              href={place.videoHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex min-h-11 items-center gap-2 rounded-2xl bg-primary-weak px-4 py-2.5 text-label font-semibold text-primary-strong transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none"
            >
              <Play size={20} className="shrink-0" aria-hidden />
              <span className="flex-1">{t("video")}</span>
              <ExternalLink size={16} className="shrink-0" aria-hidden />
              <span className="sr-only">{t("newWindow")}</span>
            </a>
          )}

          {children}

          <PlaceFactsTable facts={place.facts} />
          {place.appTranslated && (
            <p className="mt-2 text-micro text-fg-subtle">
              {t("appTranslated")}
            </p>
          )}

          {/* PoC 순서: 상세 표 다음, 길찾기 앞. 장소가 바뀌면 그 좌표로 새로 부른다 */}
          <PlaceWeather
            lat={place.facts.lat}
            lng={place.facts.lng}
            id={place.id}
          />
          {/* 날씨 다음: 오디오 가이드 · 함께 많이 가는 관광지 Top · 방문 집중률 예측(/api/tour/*). 못 받으면 칸째 숨는다 */}
          {place.id && (
            <PlaceTour
              key={place.id}
              id={place.id}
              onOpenPlace={onOpenPlace}
              canOpenPlace={canOpenPlace}
            />
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={place.directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClassName({ variant: "secondary", size: "md" })} flex-auto`}
            >
              <Navigation size={20} aria-hidden />
              {t("directions")}
              <span className="sr-only">{t("newWindow")}</span>
            </a>
            {actions}
          </div>
        </div>
      )}
    </dialog>
  );
}

/** 상세 표. 운영시간 · 권장 체류 · 작품 · 장면 · 좌표 기준(아래에 위도 · 경도) · 카카오맵 (PoC 장소 상세 d_rows 순서) */
function PlaceFactsTable({ facts }: { facts: PlaceFacts }) {
  const t = useTranslations("PlaceSheet");
  const rows: { key: string; label: string; value: React.ReactNode }[] = [
    {
      key: "hours",
      label: t("hours"),
      value:
        facts.hours &&
        breakBeforeContact(
          formatStayHours(facts.hours, {
            checkIn: (time) => t("checkIn", { time }),
            checkOut: (time) => t("checkOut", { time }),
          }),
        ),
    },
    { key: "stay", label: t("stay"), value: facts.stay },
    { key: "work", label: t("work"), value: facts.work },
    { key: "scene", label: t("scene"), value: facts.scene },
    // 위도 · 경도는 따로 두 줄을 차지하지 않고 좌표 기준 아래 작은 글자로 둔다(정보는 그대로)
    {
      key: "source",
      label: t("source"),
      value: (
        <>
          {facts.source}
          <span className="block text-caption text-fg-subtle">
            {facts.lat.toFixed(6)}, {facts.lng.toFixed(6)}
          </span>
        </>
      ),
    },
    {
      key: "kakao",
      label: t("kakao"),
      value: facts.kakaoUrl && (
        <a
          href={facts.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="-my-2.5 inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
        >
          {t("kakaoOpen")}
          <ExternalLink size={16} aria-hidden />
          <span className="sr-only">{t("newWindow")}</span>
        </a>
      ),
    },
  ].filter((r) => r.value);

  return (
    <>
      <h3 className="sr-only">{t("factsLabel")}</h3>
      <dl className="mt-5 divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <div key={r.key} className="flex gap-4 py-2.5 text-label">
            <dt className="w-24 shrink-0 text-fg-subtle">{r.label}</dt>
            <dd className="min-w-0 flex-1 whitespace-pre-line tabular-nums">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
