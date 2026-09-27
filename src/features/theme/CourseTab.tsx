import { getLocale, getTranslations } from "next-intl/server";
import { Chip } from "@/components/ui/Chip";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CourseDaySection } from "@/features/course/CourseDaySection";
import { formatDuration } from "@/features/course/format-duration";
import { DEFAULT_DEP, DEFAULT_RET } from "@/features/course/params";
import {
  buildScenario,
  PLAN_IDS,
  type PlanId,
  sameCourse,
  tripFromAnswers,
} from "@/features/course/scenarios";
import { decodeAnswers, encodeAnswers } from "@/features/recommend/answers";
import type { Answers } from "@/features/recommend/questions";
import { placeName } from "./place-meta";
import { themeHref } from "./tabs";
import { ThemeMap } from "./ThemeMap";
import { ThemePlans } from "./ThemePlans";
import { loadNameTable } from "@/features/names/server";

// 코스 탭. 조건(일정 · 이동수단) → 3안 탭 → 설명 · 안내 → 내 플랜(이름 · 저장 · 덮어쓰기 · 저장소) · 요약 칩 → 코스 지도 → 일자별 일정.
// 조건은 ?a=(Q10~Q14 답)의 q11 · q12만 바꾼 링크다. 다른 답은 그대로 둔다.
// 3안 규칙과 대체 규칙(트렌드·혼잡도 데이터가 아직 없음)은 features/course/scenarios.ts 머리 주석에 있다.

/** 일정 칸 → Q11 보기 */
const DAY_OPTIONS = ["day-trip", "1-night", "2-nights-plus"] as const;
/** 이동수단 칸 → Q12 보기 */
const TRANSPORT_OPTIONS = [
  "car",
  "public-transit",
  "flight",
  "tour-bus",
] as const;
/** Q11 보기 → 일수 (scenarios.ts DAYS_BY_Q11과 같다) */
const DAYS: Record<(typeof DAY_OPTIONS)[number], number> = {
  "day-trip": 1,
  "1-night": 2,
  "2-nights-plus": 3,
};

type CourseTabProps = {
  slug: string;
  /** ?a= (없으면 undefined) */
  a?: string;
  plan: PlanId;
};

export async function CourseTab({ slug, a, plan }: CourseTabProps) {
  const answers = decodeAnswers(a);
  const trip = tripFromAnswers(answers);
  const scenario = buildScenario(slug, plan, trip);
  // 장소가 적은 테마는 조건에 따라 다른 안이 정석과 같아진다. 탭을 눌러도 코스가 그대로인 이유를 알린다
  const sameAsClassic =
    plan !== "classic" &&
    scenario.placeCount > 0 &&
    sameCourse(scenario, buildScenario(slug, "classic", trip));

  const t = await getTranslations("Course");
  const tt = await getTranslations("Theme.course");
  const tq = await getTranslations("Recommend.questions");
  const locale = await getLocale();
  const names = await loadNameTable(locale);
  const duration = (min: number) => formatDuration(t, min);

  const withAnswer = (id: "q11" | "q12", option: string) => {
    const next: Answers = { ...answers, [id]: [option] };
    return themeHref(slug, { a: encodeAnswers(next), plan }, "course");
  };
  const planHref = (id: PlanId) => themeHref(slug, { a, plan: id }, "course");

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
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  // 코스 지도: 방문 순서 번호(여행 전체에서 이어진다) · 날짜마다 선 하나
  let order = 0;
  const pins = scenario.days.flatMap((day) =>
    day.stops.map((stop) => ({
      id: `${day.day}-${stop.id}`,
      lat: stop.place.lat,
      lng: stop.place.lng,
      title: placeName(stop.place, locale, names),
      label: ++order,
    })),
  );
  const paths = scenario.days.map((day) =>
    day.stops.map((stop) => ({ lat: stop.place.lat, lng: stop.place.lng })),
  );

  return (
    <>
      <section className="flex flex-col gap-3 px-5 pt-4">
        <div>
          <p
            aria-hidden
            className="px-1 pb-1.5 text-caption font-semibold text-fg-muted"
          >
            {tt("daysLabel")}
          </p>
          <SegmentedControl
            label={tt("daysLabel")}
            items={DAY_OPTIONS.map((o) => ({
              href: withAnswer("q11", o),
              label:
                DAYS[o] === 1
                  ? t("dayTrip")
                  : t("nightsDays", { nights: DAYS[o] - 1, days: DAYS[o] }),
              selected: trip.days === DAYS[o],
            }))}
          />
        </div>
        <div>
          <p
            aria-hidden
            className="px-1 pb-1.5 text-caption font-semibold text-fg-muted"
          >
            {tt("transportLabel")}
          </p>
          <SegmentedControl
            label={tt("transportLabel")}
            items={TRANSPORT_OPTIONS.map((o) => ({
              href: withAnswer("q12", o),
              label: tq(`q12.options.${o}`),
              selected: trip.transport === o,
            }))}
          />
        </div>
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
          <p className="mt-1 text-label text-fg-muted">{t("sameAsClassic")}</p>
        )}
        <p className="mt-1 text-micro text-fg-subtle">{t("fallbackNotice")}</p>
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
            <ThemePlans slug={slug} a={a ?? ""} plan={plan} />
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
        <>
          {apiKey && (
            <div className="mt-6 h-72 overflow-hidden bg-fill">
              <ThemeMap
                apiKey={apiKey}
                label={tt("mapLabel")}
                pins={pins}
                paths={paths}
              />
            </div>
          )}
          {scenario.days.map((day) => (
            <CourseDaySection
              key={day.day}
              day={day}
              transport={trip.transport}
              names={names}
            />
          ))}
        </>
      )}
    </>
  );
}
