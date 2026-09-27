"use client";

import { ExternalLink, MapPin, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { krUnits } from "@/lib/kr-units";
import {
  cityInfoCenters,
  type InfoCenter,
  kakaoMapLink,
  langsOf,
  mineCount,
  mineOf,
  telHref,
  TIC_INITIAL,
  TIC_STEP,
} from "./tic";

type InfoCentersProps = {
  /** 도시 key(한국어 이름) */
  city: string;
  /** 제목에 쓸 도시 이름(화면 언어) */
  cityLabel: string;
  /** 도시를 고르지 않아 기본 지역(서울)을 보이는 중이면 true(PoC _dflt) */
  isDefault: boolean;
  /** 그 도시의 관광안내소(원천 순서). 정렬 · 거르기는 여기서 한다 */
  centers: readonly InfoCenter[];
};

const LINK_CLASS =
  "inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-label font-semibold text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none";

// 플래너 여행 정보 탭 「{도시} 관광안내소」(PoC ticTitle · ticMeta · hot · ticFlt · ticList · ticMore · ticSrc).
// 순서: 제목 · 개수 → 1330 관광통역안내 → (외국어 화면) 내 언어 안내 가능한 곳만 토글 → 목록 → 더 보기 → 출처.
// 이름 · 주소는 원문(한국어), 운영 · 휴무는 외국어 화면에서 PoC KR_UNIT 치환(lib/kr-units.ts)만 한다
export function InfoCenters({
  city,
  cityLabel,
  isDefault,
  centers,
}: InfoCentersProps) {
  const t = useTranslations("Planner.info");
  const locale = useLocale();
  const mine = mineOf(locale);
  const [onlyMine, setOnlyMine] = useState(false);
  const [shown, setShown] = useState(TIC_INITIAL);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const list = cityInfoCenters(centers, city, mine, onlyMine);
  const visible = list.slice(0, shown);
  const nMine = mineCount(centers, city, mine);

  useEffect(() => {
    if (focusIndex === null) return;
    listRef.current
      ?.querySelectorAll<HTMLElement>("[data-card]")
      [focusIndex]?.focus();
  }, [focusIndex]);

  return (
    <section aria-labelledby="planner-tic-heading">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h3 id="planner-tic-heading" className="text-headline font-bold">
          {t("tic.title", { city: cityLabel })}
        </h3>
        <span
          aria-live="polite"
          className="shrink-0 text-caption font-semibold text-fg-subtle tabular-nums"
        >
          {isDefault && `${t("defaultRegion")} · `}
          {t("tic.meta", { count: list.length })}
        </span>
      </div>

      <a
        href="tel:1330"
        className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-card bg-primary px-5 py-4 text-white transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:scale-[0.98] motion-reduce:transition-none"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body font-bold">{t("tic.hotline")}</span>
          <span className="text-caption">{t("tic.hotlineSub")}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-headline font-bold tabular-nums">
          <Phone size={20} aria-hidden />
          1330
        </span>
      </a>

      {mine && (
        <button
          type="button"
          aria-pressed={onlyMine}
          onClick={() => {
            setOnlyMine((v) => !v);
            setShown(TIC_INITIAL);
            setFocusIndex(null);
          }}
          className={`mt-3 inline-flex min-h-11 items-center rounded-xl px-3 text-label transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright motion-reduce:transition-none ${
            onlyMine
              ? "bg-primary-weak font-semibold text-primary-strong"
              : "bg-fill font-medium text-fg-muted active:bg-line"
          }`}
        >
          <span className="tabular-nums">
            {t("tic.onlyMine", { count: nMine })}
          </span>
        </button>
      )}

      {list.length === 0 ? (
        <p className="mt-3 rounded-card bg-fill p-5 text-body text-fg-muted">
          {onlyMine && mine ? t("tic.emptyMine") : t("tic.empty")}
        </p>
      ) : (
        <ul ref={listRef} className="mt-3 flex flex-col gap-3">
          {visible.map((c, i) => {
            const langs = langsOf(c.lang);
            const has = mine !== null && langs.includes(mine);
            return (
              <li
                key={`${c.name}|${i}`}
                data-card
                tabIndex={-1}
                className="rounded-card p-4 ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-body-lg font-bold">{c.name}</h4>
                  {langs.length > 0 && (
                    <span
                      className={`mt-0.5 shrink-0 rounded-lg px-2 py-0.5 text-caption font-semibold whitespace-nowrap ${
                        has
                          ? "bg-primary-weak text-primary-strong"
                          : "bg-fill text-fg-muted"
                      }`}
                    >
                      {langs.join("·")}
                    </span>
                  )}
                </div>
                {c.addr && (
                  <p className="mt-1 text-label text-fg-muted">{c.addr}</p>
                )}
                {(c.hours || c.closed) && (
                  <dl className="mt-2 flex flex-col gap-0.5 text-caption text-fg-subtle">
                    {c.hours && (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 font-semibold">
                          {t("tic.hours")}
                        </dt>
                        <dd className="tabular-nums">
                          {krUnits(c.hours, locale)}
                        </dd>
                      </div>
                    )}
                    {c.closed && (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 font-semibold">
                          {t("tic.closed")}
                        </dt>
                        <dd>{krUnits(c.closed, locale)}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.tel && (
                    <a
                      href={telHref(c.tel)}
                      className={`${LINK_CLASS} tabular-nums`}
                    >
                      <Phone size={16} aria-hidden />
                      <span className="sr-only">{t("call")} </span>
                      {c.tel}
                    </a>
                  )}
                  <a
                    href={kakaoMapLink(c)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK_CLASS}
                  >
                    <MapPin size={16} aria-hidden />
                    {t("tic.map")}
                    <ExternalLink size={16} aria-hidden />
                    <span className="sr-only">{t("newWindow")}</span>
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {list.length > shown && (
        <Button
          variant="secondary"
          size="md"
          block
          className="mt-3"
          onClick={() => {
            setFocusIndex(visible.length);
            setShown((n) => n + TIC_STEP);
          }}
        >
          <span className="tabular-nums">
            {t("more", { shown, total: list.length })}
          </span>
        </Button>
      )}
      <p className="mt-3 px-1 text-micro text-fg-subtle">{t("tic.source")}</p>
    </section>
  );
}
