import {
  Clapperboard,
  Crown,
  type LucideIcon,
  MicVocal,
  Route,
  TreePalm,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ThemeSlug } from "@/features/recommend/themes";

// 포스터가 없을 때(작품이 없는 RESCENE 등) 자리표시에 넣는 아이콘
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
  /** "장소 n곳" */
  places: string;
  /** "영상 속 장소 m곳" */
  videos: string;
  /** 작품 포스터 주소(TMDB). 없으면 토큰 색 자리표시 */
  poster?: string;
};

// 홈의 테마 타일. 작품 포스터(세로 2:3) 아래에 테마 이름과 지역 · 장소 수.
// 포스터가 없으면 어두운 바탕에 제목을 얹어 포스터처럼 보이게 한다
export function ThemeTile({
  slug,
  href,
  name,
  regionLabel,
  places,
  videos,
  poster,
}: ThemeTileProps) {
  const Icon = THEME_ICON[slug];
  return (
    <Link
      href={href}
      className="flex flex-col rounded-card transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-bright active:scale-[0.99] motion-reduce:transition-none"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-card bg-primary-weak">
        {poster ? (
          <Image
            src={poster}
            alt=""
            fill
            sizes="(min-width: 480px) 214px, 45vw"
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-full flex-col items-center justify-center gap-2 bg-fg px-3 text-center text-white"
          >
            <Icon size={24} className="text-primary-bright" />
            <span className="text-headline font-bold">{name}</span>
            <span className="text-caption text-white/70">{regionLabel}</span>
          </div>
        )}
      </div>
      <h3 className="mt-3 text-body-lg font-bold">{name}</h3>
      <p className="mt-1 text-caption text-fg-subtle">
        {regionLabel} · {places}
        <br />
        {videos}
      </p>
    </Link>
  );
}
