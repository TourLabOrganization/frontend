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
  /** 작품 포스터 주소(TMDB). 없으면 토큰 색 자리표시 */
  poster?: string;
  /** 첫 화면에 보이는 첫 줄 타일이면 true. 포스터를 미루지 않고 바로 받는다(LCP) */
  eager?: boolean;
};

// 홈 「나의 테마」 3열 격자의 타일. 작품 포스터(세로 2:3) 아래에 테마 이름만(두 줄까지).
// 포스터가 없으면 어두운 바탕에 아이콘과 이름을 얹어 포스터처럼 보이게 한다
export function ThemeTile({
  slug,
  href,
  name,
  poster,
  eager = false,
}: ThemeTileProps) {
  const Icon = THEME_ICON[slug];
  return (
    <Link
      href={href}
      className="flex flex-col rounded-2xl transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-bright active:scale-[0.98] motion-reduce:transition-none"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-primary-weak">
        {poster ? (
          <Image
            src={poster}
            alt=""
            fill
            sizes="(min-width: 480px) 140px, 30vw"
            loading={eager ? "eager" : "lazy"}
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-full flex-col items-center justify-center gap-2 bg-ink px-2 text-center text-white"
          >
            <Icon size={24} className="text-primary-bright" />
            <span className="text-label font-bold">{name}</span>
          </div>
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-label font-bold">{name}</h3>
    </Link>
  );
}
