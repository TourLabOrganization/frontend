import { Bus, Car, Hourglass, TramFront } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Chip } from "@/components/ui/Chip";
import type { NameTable } from "@/features/names/names";
import { placeName } from "@/features/theme/place-meta";
import { formatDuration } from "./format-duration";
import type { CourseDay, Transport } from "./scenarios";

// 시내 구간을 다니는 수단의 아이콘. 비행기는 관문까지만 타고 현지에서는 대중교통이다
const MOVE_ICON = {
  car: Car,
  "public-transit": TramFront,
  flight: TramFront,
  "tour-bus": Bus,
} as const satisfies Record<Transport, unknown>;

// 장소 분류 중 messages에 이름이 있는 것 (Course.categories)
const CATEGORY_KEYS = [
  "herit",
  "heal",
  "activity",
  "food",
  "sea",
  "stay",
] as const;
const isCategoryKey = (cat: string): cat is (typeof CATEGORY_KEYS)[number] =>
  (CATEGORY_KEYS as readonly string[]).includes(cat);

type CourseDaySectionProps = {
  day: CourseDay;
  transport: Transport;
  /** 날짜 제목 옆에 붙일 실제 날짜(투어 플래너: 「9월 27일(토)」) */
  date?: string;
  /** 빈 날에 기본 문구(「이 날은 담을 수 있는 장소가 없어요」) 대신 그릴 내용 (투어 플래너: 아직 일정 없음 + 다시 불러오기) */
  empty?: React.ReactNode;
  /** 날짜 제목 단계. 위에 「일자별 일정」 같은 h2가 있으면 3(투어 플래너). 장소 이름은 그 아래 단계 */
  headingLevel?: 2 | 3;
  /** 화면 언어의 이름표(중 · 일 장소 공식 명칭). 서버 · 클라이언트 양쪽에서 그려져서 부모가 넘긴다 */
  names?: NameTable;
};

// 하루 일정. 장소마다 왼쪽에 도착·출발 시각, 오른쪽에 이름과 배지. 장소 사이에 이동·개장 대기
export function CourseDaySection({
  day,
  transport,
  date,
  empty,
  headingLevel = 2,
  names,
}: CourseDaySectionProps) {
  const DayHeading = headingLevel === 3 ? "h3" : "h2";
  const PlaceHeading = headingLevel === 3 ? "h4" : "h3";
  const t = useTranslations("Course");
  const locale = useLocale();
  const MoveIcon = MOVE_ICON[transport];
  const duration = (min: number) => formatDuration(t, min);
  const headingId = `day-${day.day}`;

  return (
    <section className="mt-10 px-5" aria-labelledby={headingId}>
      <DayHeading id={headingId} className="px-1 text-headline font-bold">
        {t("day", { day: day.day })}
        {date && (
          <span className="ml-2 text-body font-semibold text-fg-muted">
            {date}
          </span>
        )}
      </DayHeading>
      {day.stops.length === 0 ? (
        (empty ?? (
          <p className="mt-3 px-1 text-body text-fg-muted">{t("emptyDay")}</p>
        ))
      ) : (
        <ol className="mt-4">
          {day.stops.map((stop, k) => {
            const { place } = stop;
            const name = placeName(place, locale, names);
            const category = isCategoryKey(place.cat)
              ? t(`categories.${place.cat}`)
              : null;
            return (
              <li key={stop.id}>
                {(k > 0 || stop.wait > 0) && (
                  <div className="ml-8 flex flex-col gap-1 border-l-2 border-line py-3 pl-[calc(2.5rem-2px)] text-label text-fg-subtle">
                    {k > 0 && (
                      <span className="flex items-center gap-2">
                        <MoveIcon size={20} aria-hidden />
                        {t("move", { duration: duration(stop.move) })}
                      </span>
                    )}
                    {stop.wait > 0 && (
                      <span className="flex items-center gap-2">
                        <Hourglass size={20} aria-hidden />
                        {t("wait", { duration: duration(stop.wait) })}
                      </span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-[3.5rem_1fr] gap-3 px-1">
                  <p className="flex flex-col text-label tabular-nums">
                    <span className="font-semibold text-fg">
                      <span className="sr-only">{t("arrive")} </span>
                      {stop.arrive}
                    </span>
                    <span className="text-fg-subtle">
                      <span className="sr-only">{t("leave")} </span>
                      {stop.leave}
                    </span>
                  </p>
                  <div className="min-w-0">
                    <PlaceHeading className="text-body-lg font-semibold">
                      {name}
                    </PlaceHeading>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {place.yt && (
                        <Chip tone="primary">{t("videoBadge")}</Chip>
                      )}
                      {category && <Chip>{category}</Chip>}
                      <Chip>
                        {t("stay", { duration: duration(stop.stay) })}
                      </Chip>
                      {place.k100 && <Chip>{t("k100Badge")}</Chip>}
                      {place.un && <Chip>{t("unescoBadge")}</Chip>}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
