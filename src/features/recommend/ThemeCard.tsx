import { MapPin } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/ui/Chip";

type ThemeCardProps = {
  href: string;
  name: string;
  regionLabel: string;
  /** 근거 배지 문구. 첫 번째는 강조 배지로 보인다 */
  badges: string[];
  /** 1위 테마는 큰 카드 */
  featured?: boolean;
};

// 추천 테마 카드. 사진 자리에는 토큰 색 자리표시를 둔다
export function ThemeCard({
  href,
  name,
  regionLabel,
  badges,
  featured = false,
}: ThemeCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-card transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-bright active:scale-[0.99] motion-reduce:transition-none"
    >
      {/* TODO: TourAPI 사진으로 교체. 영화·드라마 포스터는 저작권 때문에 쓰지 않는다 */}
      <div
        aria-hidden
        className="flex aspect-[16/10] flex-col items-center justify-center gap-1.5 rounded-card bg-primary-weak text-primary-strong"
      >
        <MapPin size={featured ? 24 : 20} className="text-primary-bright" />
        <span
          className={`font-semibold ${featured ? "text-body" : "text-caption"}`}
        >
          {regionLabel}
        </span>
      </div>
      <h3
        className={`mt-3 font-bold ${featured ? "text-headline" : "text-body-lg"}`}
      >
        {name}
      </h3>
      <p className="sr-only">{regionLabel}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {badges.map((badge, i) => (
          <Chip key={badge} tone={i === 0 ? "primary" : "neutral"}>
            {badge}
          </Chip>
        ))}
      </div>
    </Link>
  );
}
