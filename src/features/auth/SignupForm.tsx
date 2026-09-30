"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { AuthAlert } from "./AuthAlert";
import { AuthField } from "./AuthField";
import { authHref } from "./next-path";
import { useMe, useSignup } from "./use-auth";
import { useAuthForm } from "./use-auth-form";
import {
  EMAIL_MAX,
  LIMITS,
  NICKNAME_MAX,
  PASSWORD_MAX,
  validateSignup,
} from "./validate";

/** 로그인 화면으로 가는 글자 링크(LoginForm의 가입 링크와 같은 모양) */
const SWITCH_LINK =
  "inline-flex min-h-11 items-center rounded-xl px-2 text-label font-semibold text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary-bright active:bg-fill motion-reduce:transition-none";

// 이메일 회원가입 폼. 가입하면 같은 이메일 · 비밀번호로 로그인해 next로 간다(use-auth.ts useSignup).
// 비밀번호 칸 아래에 길이 도움말을 늘 보인다. 이미 로그인한 상태로 오면 next로 보낸다
export function SignupForm({ next }: { next: string }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const me = useMe();
  const signup = useSignup(next);
  const form = useAuthForm(
    { email: "", password: "", nickname: "" },
    validateSignup,
  );
  // 성공한 뒤 화면을 옮기는 동안에도 버튼을 「처리 중」으로 둔다
  const busy = signup.isPending || signup.isSuccess;

  // 이미 로그인한 상태. 방금 가입한 경우는 useSignup이 옮긴다
  useEffect(() => {
    if (me.data && !busy) router.replace(next);
  }, [me.data, busy, next, router]);

  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          const values = form.submit(e.currentTarget);
          if (!values) {
            signup.reset();
            return;
          }
          signup.mutate({
            email: values.email.trim(),
            password: values.password,
            nickname: values.nickname.trim(),
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
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          help={t("passwordHelp", LIMITS)}
          required
        />
        <AuthField
          {...form.field("nickname")}
          className="mt-5"
          label={t("nickname")}
          type="text"
          autoComplete="nickname"
          maxLength={NICKNAME_MAX}
          required
        />
        <div className="mt-8">
          {signup.isError && (
            <AuthAlert
              error={signup.error}
              loginHref={authHref("/login", {
                email: signup.variables?.email,
                next,
              })}
            />
          )}
          <Button
            type="submit"
            block
            loading={busy}
            // 처리 중에는 글자가 도는 표시로 바뀌어 이름을 따로 준다
            aria-label={busy ? t("signup.submit") : undefined}
          >
            {t("signup.submit")}
          </Button>
        </div>
      </form>
      <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1 text-label text-fg-muted">
        {t("signup.hasAccount")}
        <Link href={authHref("/login", { next })} className={SWITCH_LINK}>
          {t("signup.toLogin")}
        </Link>
      </p>
    </>
  );
}
