import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Chip } from "@/components/ui/Chip";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LocaleSwitch } from "@/components/ui/LocaleSwitch";
import { TopBar } from "@/components/ui/TopBar";
import { CourseDaySection } from "@/features/course/CourseDaySection";
import { formatDuration } from "@/features/course/format-duration";
import { SavePlanButton } from "@/features/course/SavePlanButton";
import { DEFAULT_DEP, DEFAULT_RET } from "@/features/course/params";
import {
  buildScenario,
  isPlanId,
  PLAN_IDS,
  type PlanId,
  sameCourse,
  tripFromAnswers,
} from "@/features/course/scenarios";
import { decodeAnswers } from "@/features/recommend/answers";
import { findTheme } from "@/features/recommend/themes";

// 테마 코스 3안 비교. 결과 화면이 넘긴 필터(?a=, Q10~Q14)로 일수·이동수단·무장애를 정하고,
// ?plan=(classic · trend · quiet)으로 안을 고른다. 탭은 ?plan=만 바꾸는 링크라 주소를 그대로 공유할 수 있다.
// 3안 규칙과 대체 규칙(트렌드·혼잡도 데이터가 아직 없음)은 features/course/scenarios.ts 머리 주석에 있다.
export default async function ThemePage({
  params,
  searchParams,
}: PageProps<"/themes/[themeId]">) {
  const { themeId } = await params;
  const theme = findTheme(themeId);
  if (!theme) notFound();

  const query = await searchParams;
  const a = typeof query.a === "string" ? query.a : undefined;
  const plan: PlanId = isPlanId(query.plan) ? query.plan : "classic";
  const trip = tripFromAnswers(decodeAnswers(a));
  const scenario = buildScenario(theme.slug, plan, trip);
  // 장소가 적은 테마는 조건에 따라 다른 안이 정석과 같아진다. 탭을 눌러도 코스가 그대로인 이유를 알린다
  const sameAsClassic =
    plan !== "classic" &&
    scenario.placeCount > 0 &&
    sameCourse(scenario, buildScenario(theme.slug, "classic", trip));

  const t = await getTranslations("Course");
  const tt = await getTranslations("Themes");
  const tr = await getTranslations("Regions");
  const tq = await getTranslations("Recommend.questions");
  const duration = (min: number) => formatDuration(t, min);

  const planHref = (id: PlanId) => {
    const qs = new URLSearchParams();
    if (a) qs.set("a", a);
    qs.set("plan", id);
    return `/themes/${theme.slug}?${qs.toString()}`;
  };

  const meta = [
    theme.regions.map((r) => tr(r)).join(" · "),
    trip.days === 1
      ? t("dayTrip")
      : t("nightsDays", { nights: trip.days - 1, days: trip.days }),
    tq(`q12.options.${trip.transport}`),
  ].join(" · ");

  // 골랐지만 데이터가 없어 코스에 넣지 못한 조건 (Q10 · Q13 · Q14 반려동물 · 실내)
  const unapplied = [
    trip.when &&
      t("condition", {
        name: t("conditionNames.when"),
        value: tq(`q10.options.${trip.when}`),
      }),
    trip.walk &&
      t("condition", {
        name: t("conditionNames.walk"),
        value: tq(`q13.options.${trip.walk}`),
      }),
    ...trip.ignored.map((o) => tq(`q14.options.${o}`)),
  ].filter((c): c is string => Boolean(c));

  const empty = scenario.placeCount === 0;

  return (
    <Screen>
      <TopBar right={<LocaleSwitch />} />
      <main className="flex flex-1 flex-col pb-16">
        <section className="px-6 pt-2">
          <h1 className="text-title font-bold">{tt(`${theme.slug}.name`)}</h1>
          <p className="mt-1 text-label text-fg-muted">{meta}</p>
        </section>

        <div className="mt-6 px-5">
          <SegmentedControl
            label={t("planTabsLabel")}
            items={PLAN_IDS.map((id) => ({
              href: planHref(id),
              label: t(`plans.${id}.name`),
              selected: id === plan,
            }))}
          />
        </div>

        <section className="mt-4 px-6">
          <p className="text-label text-fg-muted">
            {t(`plans.${plan}.description`)}
          </p>
          {sameAsClassic && (
            <p className="mt-1 text-label text-fg-muted">
              {t("sameAsClassic")}
            </p>
          )}
          <p className="mt-1 text-micro text-fg-subtle">
            {t("fallbackNotice")}
          </p>
          <p className="mt-1 text-micro text-fg-subtle">
            {t("tripBasis", { depTime: DEFAULT_DEP, retTime: DEFAULT_RET })}
          </p>
          {trip.accessible && (
            <p className="mt-1 text-micro text-fg-subtle">
              {t("accessibleNotice")}
            </p>
          )}
          {unapplied.length > 0 && (
            <p className="mt-1 text-micro text-fg-subtle">
              {t("unappliedNotice", { conditions: unapplied.join(" · ") })}
            </p>
          )}
          {!empty && (
            <div className="mt-4">
              <SavePlanButton slug={theme.slug} a={a ?? ""} plan={plan} />
            </div>
          )}
          {!empty && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Chip>{t("placeCount", { count: scenario.placeCount })}</Chip>
              <Chip>
                {t("stayTotal", { duration: duration(scenario.stayTotal) })}
              </Chip>
              <Chip>
                {t("moveTotal", { duration: duration(scenario.moveTotal) })}
              </Chip>
            </div>
          )}
        </section>

        {empty ? (
          <section className="mt-10 px-6">
            <p className="text-body-lg font-semibold">{t("empty")}</p>
            <p className="mt-1 text-body text-fg-muted">{t("emptyHelp")}</p>
          </section>
        ) : (
          scenario.days.map((day) => (
            <CourseDaySection
              key={day.day}
              day={day}
              transport={trip.transport}
            />
          ))
        )}
      </main>
    </Screen>
  );
}
