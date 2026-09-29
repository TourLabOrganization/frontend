type ProgressBarProps = {
  value: number;
  max: number;
  /** 화면 읽기 프로그램이 읽을 이름. 예: "질문 진행" */
  label: string;
};

export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-1 w-full overflow-hidden rounded-full bg-line"
    >
      <div
        className="h-full rounded-full bg-primary-bright transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
