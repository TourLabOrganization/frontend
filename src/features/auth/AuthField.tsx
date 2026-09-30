"use client";

import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { type FieldError, LIMITS } from "./validate";

type AuthFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "onBlur"
> & {
  label: string;
  /** 오류(messages Auth.errors의 키). 칸 바로 아래에 보이고 aria-describedby로 잇는다 */
  error: FieldError | null;
  /** 칸 아래에 늘 보이는 도움말 */
  help?: string;
  /** 칸을 떠날 때. 비밀번호 칸은 보기 버튼까지 벗어나야 떠난 것이다 */
  onLeave: () => void;
};

// 모양은 SearchField와 같다(높이 48 · rounded-xl · bg-fill · focus-visible outline). 잘못된 칸은 danger 테두리
const INPUT =
  "h-12 w-full min-w-0 appearance-none rounded-xl bg-fill px-4 text-body text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright aria-invalid:ring-2 aria-invalid:ring-danger";

// 로그인 · 가입 폼의 입력칸. 눈에 보이는 라벨, 칸 바로 아래 오류(aria-invalid · aria-describedby), 도움말.
// type="password"면 보기 · 숨기기 토글(누르는 자리 44px, aria-pressed)을 둔다
export function AuthField({
  label,
  error,
  help,
  onLeave,
  type,
  className = "",
  ...input
}: AuthFieldProps) {
  const t = useTranslations("Auth");
  const id = useId();
  const [shown, setShown] = useState(false);
  const password = type === "password";
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const describedBy =
    [error ? errorId : "", help ? helpId : ""].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-label font-semibold">
        {label}
      </label>
      <div
        className="relative mt-2"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) onLeave();
        }}
      >
        <input
          {...input}
          id={id}
          type={password && shown ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${INPUT} ${password ? "pr-12" : ""}`}
        />
        {password && (
          <button
            type="button"
            aria-label={t("showPassword")}
            aria-pressed={shown}
            // 눌러도 입력칸 초점을 뺏지 않는다(모바일 키보드가 닫히거나 칸을 떠난 것으로 검사되지 않게)
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShown((v) => !v)}
            className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-bright active:bg-line motion-reduce:transition-none"
          >
            {shown ? (
              <EyeOff size={20} aria-hidden />
            ) : (
              <Eye size={20} aria-hidden />
            )}
          </button>
        )}
      </div>
      {error && (
        <p
          id={errorId}
          className="mt-2 flex items-start gap-1.5 text-label text-danger"
        >
          <CircleAlert size={16} className="mt-1 shrink-0" aria-hidden />
          {t(`errors.${error}`, LIMITS)}
        </p>
      )}
      {help && (
        <p id={helpId} className="mt-2 text-caption text-fg-subtle">
          {help}
        </p>
      )}
    </div>
  );
}
