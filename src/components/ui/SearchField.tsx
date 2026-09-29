"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** 화면 읽기 프로그램이 읽을 이름. 눈에는 placeholder가 보인다 */
  label: string;
  placeholder: string;
  /** 지우기 버튼의 접근 이름 */
  clearLabel: string;
  className?: string;
  /** 열리자마자 입력칸에 초점을 둔다(코스 탭 「장소 추가」처럼 눌러서 여는 검색) */
  autoFocus?: boolean;
  /** 입력칸 설명 문구의 id */
  describedBy?: string;
};

// 목록 검색 입력. 왼쪽 돋보기, 글자가 있으면 오른쪽에 지우기 버튼(누르는 자리 44px). 지우면 입력칸으로 초점을 돌린다
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  clearLabel,
  className = "",
  autoFocus,
  describedBy,
}: SearchFieldProps) {
  const id = useId();
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        size={20}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-muted"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
        aria-describedby={describedBy}
        className="h-12 w-full min-w-0 appearance-none rounded-xl bg-fill pr-12 pl-11 text-body text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={(e) => {
            onChange("");
            (
              e.currentTarget.parentElement?.querySelector(
                "input",
              ) as HTMLInputElement | null
            )?.focus();
          }}
          className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-line motion-reduce:transition-none"
        >
          <X size={20} aria-hidden />
        </button>
      )}
    </div>
  );
}
