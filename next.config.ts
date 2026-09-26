import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // 개발 서버는 localhost 외 호스트의 개발용 스크립트 요청을 막는다.
  // 127.0.0.1로 열면 HTML만 뜨고 화면이 반응하지 않으므로 허용해 둔다.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // 작품 포스터 · 스틸 (features/recommend/works.ts)
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
    ],
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
