import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // 개발 서버는 localhost 외 호스트의 개발용 스크립트 요청을 막는다.
  // 127.0.0.1로 열면 HTML만 뜨고 화면이 반응하지 않으므로 허용해 둔다.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      // 작품 포스터 · 스틸 (features/recommend/works.ts)
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
      // 장소 사진 (features/theme/data/extras.json). PoC의 img는 Special:FilePath 주소라 upload로 넘겨준다
      { protocol: "https", hostname: "commons.wikimedia.org" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      // 장소 대표 사진 (app/api/tour/photo). 한국관광공사 관광정보 · 관광사진
      { protocol: "https", hostname: "tong.visitkorea.or.kr" },
      // RESCENE 영상 썸네일 (features/theme/FilmTab.tsx)
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
    ],
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
