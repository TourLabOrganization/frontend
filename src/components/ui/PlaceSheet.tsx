"use client";

import { Navigation, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClassName } from "./Button";

export type PlaceSheetPlace = {
  /** 제목(화면 언어의 장소 이름). 사진의 대체 글도 이 이름이다 */
  name: string;
  /** 제목 아래 한 줄. 「역사·문화 · 체류 40분」처럼 " · "로 잇는다 */
  meta?: readonly string[];
  /** 운영시간 원문 */
  hours?: string;
  description?: string | null;
  /** 사진(Wikimedia 등 외부 주소는 unoptimized로 브라우저가 바로 받는다)과 출처 */
  photo?: { src: string; credit?: string } | null;
  /** 길찾기(카카오맵) 주소. 새 창으로 연다 */
  directionsHref: string;
};

type PlaceSheetProps = {
  /** 열 장소. null이면 닫힌다 */
  place: PlaceSheetPlace | null;
  /** 설명 아래에 넣을 칸 (테마 화면의 장면 링크 등) */
  children?: React.ReactNode;
  /** 「길찾기」 옆 버튼들. 쓰는 화면이 정한다 (테마: 저장 · 스탬프, 플래너: 코스에 담기) */
  actions?: React.ReactNode;
  onClose: () => void;
};

// 장소 시트. 아래에서 올라오는 모달 dialog다. 테마 화면 지도 탭과 투어 플래너 지도 탭이 함께 쓴다.
// showModal()이 바깥을 inert로 만들어 초점을 시트 안에 가두고, Esc로 닫힌다. 바깥(배경)을 눌러도 닫는다
export function PlaceSheet({
  place,
  children,
  actions,
  onClose,
}: PlaceSheetProps) {
  const t = useTranslations("PlaceSheet");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // 받지 못한 사진 주소. 깨진 사진 칸 대신 사진 없이 보인다
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (place && !dialog.open) dialog.showModal();
    if (!place && dialog.open) dialog.close();
  }, [place]);

  const meta = place?.meta?.filter(Boolean) ?? [];

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
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

          {place.photo && place.photo.src !== failedSrc && (
            <figure className="mb-4">
              <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-fill">
                <Image
                  src={place.photo.src}
                  alt={place.name}
                  fill
                  unoptimized
                  // 시트가 열려 있을 때만 그려지므로 사진은 늘 보이는 자리다. 미루지 않는다
                  loading="eager"
                  onError={() => setFailedSrc(place.photo?.src ?? null)}
                  className="object-cover"
                />
              </div>
              {place.photo.credit && (
                <figcaption className="mt-1.5 text-micro text-fg-subtle">
                  {t("photoCredit", { credit: place.photo.credit })}
                </figcaption>
              )}
            </figure>
          )}

          <h2 id={titleId} className="text-headline font-bold">
            {place.name}
          </h2>
          {meta.length > 0 && (
            <p className="mt-1 text-label text-fg-muted">{meta.join(" · ")}</p>
          )}
          {place.hours && (
            <p className="mt-1 text-label text-fg-subtle">
              <span className="sr-only">{t("hours")} </span>
              {place.hours}
            </p>
          )}
          {place.description && (
            <p className="mt-4 text-body">{place.description}</p>
          )}

          {children}

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
