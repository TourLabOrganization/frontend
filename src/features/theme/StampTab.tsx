"use client";

import { MapPin, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui/Chip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { pad2 } from "./place-meta";
import { useIdList } from "./storage";

export type StampPlace = {
  id: string;
  n: number | null;
  name: string;
  /** 지도 탭에서 이 장소 시트를 여는 주소 */
  mapHref: string;
};

type StampTabProps = {
  slug: string;
  /** 제목 앞 이름. 테마 장소가 한 도시면 도시(「영월 · 스탬프 북」), 여러 도시면 지역(「경북 · 경남 · 스탬프 북」) */
  region: string;
  /** 핵심 장소. 스탬프 북의 칸 */
  core: readonly StampPlace[];
  /** 모든 장소. 저장한 장소(북마크) 이름을 찾는다 */
  all: readonly StampPlace[];
};

// 스탬프 탭. 핵심 장소 체크인(사용자가 직접 누르는 토글, 위치 확인 없음)과 저장한 장소(북마크) 목록
export function StampTab({ slug, region, core, all }: StampTabProps) {
  const t = useTranslations("Theme.stamp");
  const stamps = useIdList("stamps", slug);
  const bookmarks = useIdList("bookmarks", slug);

  const total = core.length;
  const count = core.filter((p) => stamps.has(p.id)).length;
  const percent = total === 0 ? 0 : Math.round((count / total) * 100);
  const saved = bookmarks.ids.flatMap((id) => {
    const place = all.find((p) => p.id === id);
    return place ? [place] : [];
  });

  return (
    <>
      <section className="px-6 pt-6">
        <p className="text-caption font-semibold text-primary">{t("kicker")}</p>
        <h2 className="mt-1 text-title font-bold">{t("title", { region })}</h2>
        <div className="mt-4">
          <ProgressBar value={count} max={total} label={t("progressLabel")} />
          <p className="mt-2 text-label text-fg-muted tabular-nums">
            {t("progress", { count, total, percent })}
          </p>
        </div>
      </section>

      <ul className="mt-5 grid grid-cols-2 gap-2 px-5">
        {core.map((p) => {
          const done = stamps.has(p.id);
          return (
            <li key={p.id} className="relative">
              <button
                type="button"
                aria-pressed={done}
                onClick={() => stamps.toggle(p.id)}
                className={`flex h-full min-h-32 w-full flex-col items-start rounded-2xl p-4 pr-12 text-left transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${
                  done
                    ? "ring-2 ring-primary-bright ring-inset"
                    : "ring-1 ring-line ring-inset active:bg-fill"
                }`}
              >
                <span className="text-caption font-semibold text-fg-muted tabular-nums">
                  {pad2(p.n)}
                </span>
                <span className="mt-1 text-body-lg font-semibold">
                  {p.name}
                </span>
                <span className="mt-auto pt-3">
                  {done ? (
                    <Chip tone="primary">{t("done")}</Chip>
                  ) : (
                    <Chip>{t("notDone")}</Chip>
                  )}
                </span>
              </button>
              <Link
                href={p.mapHref}
                aria-label={t("openMap", { name: p.name })}
                className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-line motion-reduce:transition-none"
              >
                <MapPin size={20} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="saved-heading" className="mt-10 px-5">
        <h2
          id="saved-heading"
          className="px-1 text-headline font-bold tabular-nums"
        >
          {t("savedHeading", { count: saved.length })}
        </h2>
        {saved.length === 0 ? (
          <p className="mt-3 px-1 text-body text-fg-muted">{t("savedEmpty")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {saved.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-card ring-1 ring-line"
              >
                <Link
                  href={p.mapHref}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-card px-4 py-3 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
                >
                  <MapPin
                    size={20}
                    className="shrink-0 text-primary"
                    aria-hidden
                  />
                  <span className="text-body-lg font-semibold">{p.name}</span>
                </Link>
                <button
                  type="button"
                  aria-label={t("remove", { name: p.name })}
                  onClick={() => bookmarks.remove(p.id)}
                  className="mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none"
                >
                  <Trash2 size={20} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
