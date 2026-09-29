type LogoMarkProps = {
  size?: number;
  /** mark: 종이비행기 선만 · badge: 앱 아이콘처럼 둥근 사각형 안의 흰 종이비행기 */
  variant?: "mark" | "badge";
  strokeWidth?: number;
  className?: string;
  /** 접근 이름. 없으면 장식으로 보고 화면 읽기 프로그램에서 숨긴다 */
  title?: string;
};

// 서비스 로고. 팀 목업의 종이비행기 도형을 그대로 쓰고 색은 우리 토큰으로 칠한다(className의 text-* = 선 또는 배지 바탕색).
// 원본: Tour-Navigator-App/Tour Navigator Home.dc.html 시작 화면 SVG (24×24 격자, 선 1.4, 각진 모서리)
// badge는 앱 아이콘(src/app/icon.svg)과 같은 도형이다: 32×32 격자, 모서리 8, 흰 선 2
export function LogoMark({
  size = 24,
  variant = "mark",
  strokeWidth,
  className,
  title,
}: LogoMarkProps) {
  const a11y = {
    role: title ? "img" : undefined,
    "aria-label": title,
    "aria-hidden": title ? undefined : true,
  } as const;
  const plane = (
    <>
      <path d="M3 11.5 21 4l-7.5 17-2-7.5z" />
      <path d="M11.5 13.5 21 4" />
    </>
  );

  if (variant === "badge") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        className={className}
        {...a11y}
      >
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <g
          transform="translate(4 4)"
          fill="none"
          strokeWidth={strokeWidth ?? 2}
          strokeLinecap="square"
          strokeLinejoin="miter"
          className="stroke-surface"
        >
          {plane}
        </g>
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? 1.4}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      {...a11y}
    >
      {plane}
    </svg>
  );
}
