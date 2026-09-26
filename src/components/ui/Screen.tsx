// 모든 화면의 바깥 틀. 모바일은 화면 전체를 쓰고, 넓은 화면에서는 가운데 480px 기둥으로 보인다
export function Screen({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface ${className}`}
    >
      {children}
    </div>
  );
}
