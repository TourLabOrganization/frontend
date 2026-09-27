import { Database } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { TfiBars } from "@/components/TfiBars";
import { formatDuration } from "@/features/course/format-duration";
import type { ThemeSlug } from "@/features/recommend/themes";
import {
  datalabRegionId,
  datalabRows,
  getCourses,
  getStayTime,
  getTfi,
} from "@/lib/api/datalab";
import { THEME_COURSE_ID } from "./datalab";

// 여행 정보 탭의 「데이터랩으로 본 {지역}」. 코스가 지나는 지역 중 TFI · 체류시간이 있는 지역마다
// 테마 강도(TFI) 막대와 체류시간 숫자를 보인다. 공개 API라 서버 컴포넌트에서 부르고, 실패하면 한 줄 안내만 둔다
export async function DatalabSection({ slug }: { slug: ThemeSlug }) {
  const t = await getTranslations("Theme.info");
  const tdl = await getTranslations("Datalab");
  const tcourse = await getTranslations("Course");
  const locale = await getLocale();

  // 받기와 가공(코스 찾기 · 지역 고르기 · 막대 만들기)을 모두 실패 처리 안에서 한다.
  // 응답 모양이 틀려도 이 블록만 실패 문구가 되고 탭의 나머지는 그대로 보인다
  const data = await Promise.all([getCourses(), getTfi(), getStayTime()])
    .then(([courses, tfi, stay]) => ({
      rows: datalabRows(THEME_COURSE_ID[slug], courses, tfi, stay),
      source: stay.source,
      year: stay.latestYear,
    }))
    .catch(() => null);

  if (!data || data.rows.length === 0) {
    return (
      <p role="status" className="px-1 text-caption text-fg-subtle">
        {t("datalabFailed")}
      </p>
    );
  }

  const { rows } = data;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const regionLabel = (name: string) => {
    const id = datalabRegionId(name);
    return id ? tdl(`regions.${id}`) : name;
  };

  return (
    <section aria-label={rows.map((r) => regionLabel(r.region)).join(" · ")}>
      <div className="flex flex-col gap-3">
        {rows.map(({ region, bars, stay: row }) => {
          const headingId = `datalab-${datalabRegionId(region) ?? region}`;
          return (
            <div
              key={region}
              aria-labelledby={headingId}
              role="group"
              className="rounded-card p-5 ring-1 ring-line"
            >
              <h3
                id={headingId}
                className="flex items-center gap-1.5 text-body-lg font-bold"
              >
                <Database
                  size={18}
                  className="shrink-0 text-primary"
                  aria-hidden
                />
                {t("datalabHeading", { region: regionLabel(region) })}
              </h3>
              <div className="mt-4">
                <TfiBars bars={bars} />
              </div>
              <ul className="mt-4 flex flex-col gap-1 text-body text-fg-muted">
                <li>
                  {t("stayPerVisit", {
                    duration: formatDuration(
                      (key, values) => tcourse(key, values),
                      Math.round(row.stayMinutes),
                    ),
                  })}
                </li>
                <li>{t("stayIndex", { index: number.format(row.index) })}</li>
                {row.visitsToSeeAll !== null && (
                  <li>
                    {t("visitsToSeeAll", {
                      visits: number.format(row.visitsToSeeAll),
                    })}
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-micro text-fg-subtle">
        {t("datalabSource", { source: data.source, year: data.year })}
      </p>
    </section>
  );
}
