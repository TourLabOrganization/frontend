import {
  Clapperboard,
  Crown,
  type LucideIcon,
  MicVocal,
  Route,
  TreePalm,
} from "lucide-react";
import Link from "next/link";
import type { ThemeSlug } from "@/features/recommend/themes";

// 테마마다 자리표시에 넣는 아이콘. 포스터는 저작권 때문에 쓰지 않는다
const THEME_ICON: Record<ThemeSlug, LucideIcon> = {
  "kings-warden": Crown,
  "kpop-demon-hunters": MicVocal,
  "rescene-route": Route,
  "jeju-k-drama": TreePalm,
  "busan-film-trip": Clapperboard,
};

type ThemeTileProps = {
  slug: ThemeSlug;
  href: string;
  name: string;
  regionLabel: string;
  /** "장소 n곳 · 영상 속 장소 m곳" */
  stats: string;
};

// 홈의 테마 타일. 사진 자리에는 토큰 색 면 + 아이콘 + 지역을 둔다
export function ThemeTile({
  slug,
  href,
  name,
  regionLabel,
  stats,
}: ThemeTileProps) {
  const Icon = THEME_ICON[slug];
  return (
    <Link
      href={href}
      className="flex flex-col rounded-card transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-bright active:scale-[0.99] motion-reduce:transition-none"
    >
      {/* TODO: TourAPI 사진으로 교체. 영화·드라마 포스터는 저작권 때문에 쓰지 않는다 */}
      <div
        aria-hidden
        className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-card bg-primary-weak text-primary-strong"
      >
        <Icon size={24} className="text-primary-bright" />
        <span className="text-caption font-semibold">{regionLabel}</span>
      </div>
      <h3 className="mt-3 text-body-lg font-bold">{name}</h3>
      <p className="sr-only">{regionLabel}</p>
      <p className="mt-1 text-caption text-fg-subtle">{stats}</p>
    </Link>
  );
}
