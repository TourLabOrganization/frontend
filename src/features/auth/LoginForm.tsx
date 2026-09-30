"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { AuthAlert } from "./AuthAlert";
import { AuthField } from "./AuthField";
import { authHref } from "./next-path";
import { useLogin, useMe } from "./use-auth";
import { useAuthForm } from "./use-auth-form";
import { EMAIL_MAX, PASSWORD_MAX, validateLogin } from "./validate";

/** 가입 화면으로 가는 글자 링크(SignupForm의 로그인 링크와 같은 모양) */
const SWITCH_LINK =
  "inline-flex min-h-11 items-center rounded-xl px-2 text-label font-semibold text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none";

type LoginFormProps = {
  /** 로그인 뒤 갈 앱 안 경로(safeNext로 거른 값) */
  next: string;
  /** 채워 둘 이메일(?email=) */
  email: string;
  /** 가입은 됐는데 자동 로그인이 실패해 왔다(?joined=1) */
  joined: boolean;
};

// 이메일 로그인 폼. 검사는 칸을 떠날 때와 제출할 때, 서버 오류는 제출 버튼 위 한 줄(AuthAlert).
// 이미 로그인한 상태로 오면 next로 보낸다
export function LoginForm({ next, email, joined }: LoginFormProps) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const me = useMe();
  const login = useLogin(next);
  const form = useAuthForm({ email, password: "" }, validateLogin);
  // 성공한 뒤 화면을 옮기는 동안에도 버튼을 「처리 중」으로 둔다
  const busy = login.isPending || login.isSuccess;

  // 이미 로그인한 상태. 방금 로그인한 경우는 useLogin이 옮긴다
  useEffect(() => {
    if (me.data && !busy) router.replace(next);
  }, [me.data, busy, next, router]);

  return (
    <>
      {joined && (
        <p className="mb-6 flex items-start gap-2 rounded-2xl bg-primary-weak px-4 py-3 text-label font-semibold text-primary-strong">
          <CircleCheck size={20} className="mt-px shrink-0" aria-hidden />
          {t("login.joined")}
        </p>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          const values = form.submit(e.currentTarget);
          if (!values) {
            login.reset();
            return;
          }
          login.mutate({
            email: values.email.trim(),
            password: values.password,
          });
        }}
      >
        <AuthField
          {...form.field("email")}
          label={t("email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={EMAIL_MAX}
          required
        />
        <AuthField
          {...form.field("password")}
          className="mt-5"
          label={t("password")}
          type="password"
          autoComplete="current-password"
          maxLength={PASSWORD_MAX}
          required
        />
        <div className="mt-8">
          {login.isError && <AuthAlert error={login.error} />}
          <Button
            type="submit"
            block
            loading={busy}
            // 처리 중에는 글자가 도는 표시로 바뀌어 이름을 따로 준다
            aria-label={busy ? t("login.submit") : undefined}
          >
            {t("login.submit")}
          </Button>
        </div>
      </form>
      <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1 text-label text-fg-muted">
        {t("login.noAccount")}
        <Link href={authHref("/signup", { next })} className={SWITCH_LINK}>
          {t("login.toSignup")}
        </Link>
      </p>
    </>
  );
}
