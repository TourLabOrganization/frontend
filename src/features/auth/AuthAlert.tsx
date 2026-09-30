"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { authErrorKind } from "./auth-error";

/**
 * 제출 버튼 위 서버 오류 한 줄(role="alert"). 이미 가입한 이메일이면 그 이메일을 채운 로그인 링크를 붙인다(loginHref).
 * 서버에 닿지 못한 경우(unavailable)는 따로 버튼을 두지 않고 같은 제출 버튼으로 다시 시도한다
 */
export function AuthAlert({
  error,
  loginHref,
}: {
  error: unknown;
  loginHref?: string;
}) {
  const t = useTranslations("Auth");
  const kind = authErrorKind(error);

  return (
    <p
      role="alert"
      className="mb-3 flex items-start gap-1.5 text-label text-danger"
    >
      <CircleAlert size={16} className="mt-1 shrink-0" aria-hidden />
      <span>
        {t(`errors.${kind}`)}
        {kind === "emailTaken" && loginHref && (
          <>
            {" "}
            <Link
              href={loginHref}
              className="-my-2.5 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright"
            >
              {t("signup.loginInstead")}
            </Link>
          </>
        )}
      </span>
    </p>
  );
}
