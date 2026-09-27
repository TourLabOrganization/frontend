import { Database } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { TfiBars } from "@/components/TfiBars";
import { formatDuration } from "@/features/course/format-duration";
import type { ThemeSlug } from "@/features/recommend/themes";
import {
  datalabRegionId,
  datalabRegionsOfCourse,
  getCourses,
  getStayTime,
  getTfi,
  tfiBars,
} from "@/lib/api/datalab";
import { THEME_COURSE_ID } from "./datalab";

// 여행 정보 탭의 「데이터랩으로 본 {지역}」. 코스가 지나는 지역 중 TFI · 체류시간이 있는 지역마다
// 테마 강도(TFI) 막대와 체류시간 숫자를 보인다. 공개 API라 서버 컴포넌트에서 부르고, 실패하면 한 줄 안내만 둔다
export async function DatalabSection({ slug }: { slug: ThemeSlug }) {
  const t = await getTranslations("Theme.info");
  const tdl = await getTranslations("Datalab");
  const tcourse = await getTranslations("Course");
  const locale = await getLocale();

  const data = await Promise.all([getCourses(), getTfi(), getStayTime()])
    .then(([courses, tfi, stay]) => ({ courses, tfi, stay }))
    .catch(() => null);

  if (!data) {
    return (
      <p role="status" className="px-1 text-caption text-fg-subtle">
        {t("datalabFailed")}
      </p>
    );
  }

  const { courses, tfi, stay } = data;
  const course = courses.courses.find(
    (c) => c.courseId === THEME_COURSE_ID[slug],
  );
  const regions = datalabRegionsOfCourse(course, tfi, stay);
  if (regions.length === 0) {
    return (
      <p role="status" className="px-1 text-caption text-fg-subtle">
        {t("datalabFailed")}
      </p>
    );
  }

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const regionLabel = (name: string) => {
    const id = datalabRegionId(name);
    return id ? tdl(`regions.${id}`) : name;
  };

  return (
    <section aria-label={regions.map(regionLabel).join(" · ")}>
      <div className="flex flex-col gap-3">
        {regions.map((region) => {
          const bars = tfiBars(tfi, region) ?? [];
          const row = stay.regions.find((s) => s.region === region)!;
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
        {t("datalabSource", { source: stay.source, year: stay.latestYear })}
      </p>
    </section>
  );
}
