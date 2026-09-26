import { MapPin } from "lucide-react";
import Image from "next/image";
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
  /** 작품 장면 스틸 주소(TMDB). 없으면 토큰 색 자리표시 */
  backdrop?: string;
};

// 추천 테마 카드. 작품 장면 스틸 아래에 테마 이름 · 지역 · 근거 배지
export function ThemeCard({
  href,
  name,
  regionLabel,
  badges,
  featured = false,
  backdrop,
}: ThemeCardProps) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-card transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-bright active:scale-[0.99] motion-reduce:transition-none"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-primary-weak">
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            sizes={
              featured
                ? "(min-width: 480px) 440px, 90vw"
                : "(min-width: 480px) 214px, 45vw"
            }
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-full flex-col items-center justify-center gap-1.5 bg-fg px-3 text-center text-white"
          >
            <MapPin size={featured ? 24 : 20} className="text-primary-bright" />
            <span
              className={`font-bold ${featured ? "text-title" : "text-label"}`}
            >
              {name}
            </span>
          </div>
        )}
      </div>
      <h3
        className={`mt-3 font-bold ${featured ? "text-headline" : "text-body-lg"}`}
      >
        {name}
      </h3>
      <p className="mt-1 text-caption text-fg-subtle">{regionLabel}</p>
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
