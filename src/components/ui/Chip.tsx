type ChipProps = {
  icon?: React.ReactNode;
  tone?: "neutral" | "primary";
  children: React.ReactNode;
};

// 짧은 정보 조각. 데이터랩 근거 배지, 거리·시간 같은 메타 정보에 쓴다
export function Chip({ icon, tone = "neutral", children }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-caption font-medium ${
        tone === "primary"
          ? "bg-primary-weak text-primary-strong"
          : "bg-fill text-fg-muted"
      }`}
    >
      {icon}
      {children}
    </span>
  );
}
