import { ChevronDown, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/ui/Button";
import {
  type BookingLink,
  RENT_LINKS,
  stayLinks,
  TRANSPORT_LINKS,
} from "./data/booking";

const LINK_CLASS = `${buttonClassName({ variant: "secondary", size: "md" })} w-full text-center`;

// 펼침 목록 머리. details/summary라 Enter · Space로 열고 닫고, 열림 상태를 화면 읽기 프로그램이 읽는다
const SUMMARY_CLASS = `${buttonClassName({ variant: "secondary", size: "md" })} w-full cursor-pointer list-none [&::-webkit-details-marker]:hidden`;

function NewWindowLink({ link }: { link: BookingLink }) {
  const t = useTranslations("Planner.course.booking");
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={LINK_CLASS}
    >
      {t(link.label)}
      <ExternalLink size={16} className="shrink-0" aria-hidden />
      <span className="sr-only">{t("newWindow")}</span>
    </a>
  );
}

function Dropdown({
  label,
  links,
  wide = false,
  className = "",
}: {
  label: string;
  links: readonly BookingLink[];
  /** 한 줄을 다 쓰면 링크를 두 줄로 편다 */
  wide?: boolean;
  className?: string;
}) {
  return (
    <details className={`group ${className}`}>
      <summary className={SUMMARY_CLASS}>
        {label}
        <ChevronDown
          size={16}
          aria-hidden
          className="shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <ul
        className={`mt-2 grid gap-2 rounded-2xl bg-surface p-2 ring-1 ring-line ${wide ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {links.map((link) => (
          <li key={link.label}>
            <NewWindowLink link={link} />
          </li>
        ))}
      </ul>
    </details>
  );
}

// 코스 탭 아래쪽 예매 링크(목업): KTX · SRT · 버스, 렌트카 ▾ · 숙박 ▾. 모두 새 창
export function CourseBookingLinks({ cityEn }: { cityEn: string }) {
  const t = useTranslations("Planner.course.booking");
  return (
    <section aria-labelledby="planner-booking-heading" className="px-5">
      <h2 id="planner-booking-heading" className="text-headline font-bold">
        {t("heading")}
      </h2>
      <ul className="mt-3 grid grid-cols-2 items-start gap-2">
        {TRANSPORT_LINKS.map((link) => (
          <li key={link.label}>
            <NewWindowLink link={link} />
          </li>
        ))}
        <li>
          <Dropdown label={t("rent")} links={RENT_LINKS} />
        </li>
      </ul>
      <Dropdown
        label={t("stay")}
        links={stayLinks(cityEn)}
        wide
        className="mt-2"
      />
    </section>
  );
}
