import { Check } from "lucide-react";

type OptionItemProps = {
  label: string;
  description?: string;
  selected: boolean;
  /** true면 여러 개 고르는 체크박스, false면 하나만 고르는 라디오 */
  multiple?: boolean;
  onSelect: () => void;
};

// 문항의 보기 한 줄. 여러 개를 묶을 때는 부모에 role="radiogroup" 또는 role="group"을 준다
export function OptionItem({
  label,
  description,
  selected,
  multiple = false,
  onSelect,
}: OptionItemProps) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onSelect}
      className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl px-5 py-3 text-left text-body-lg font-medium transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright active:scale-[0.99] motion-reduce:transition-none ${
        selected
          ? "bg-primary-weak text-primary-strong ring-2 ring-primary-bright ring-inset"
          : "bg-fill text-fg active:bg-line"
      }`}
    >
      <span className="flex flex-col">
        <span>{label}</span>
        {description && (
          <span className="text-caption font-normal text-fg-muted">
            {description}
          </span>
        )}
      </span>
      {selected && (
        <Check
          size={20}
          strokeWidth={3}
          className="shrink-0 text-primary-bright"
          aria-hidden
        />
      )}
    </button>
  );
}
