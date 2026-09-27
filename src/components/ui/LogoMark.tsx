type LogoMarkProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** 접근 이름. 없으면 장식으로 보고 화면 읽기 프로그램에서 숨긴다 */
  title?: string;
};

// 서비스 로고. 팀 목업의 종이비행기 도형을 그대로 쓰고 색만 우리 토큰(currentColor)으로 칠한다.
// 원본: Tour-Navigator-App/Tour Navigator Home.dc.html 시작 화면 SVG (24×24 격자, 선 1.4, 각진 모서리)
export function LogoMark({
  size = 24,
  strokeWidth = 1.4,
  className,
  title,
}: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d="M3 11.5 21 4l-7.5 17-2-7.5z" />
      <path d="M11.5 13.5 21 4" />
    </svg>
  );
}
