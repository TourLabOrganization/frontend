"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { authHref } from "./next-path";
import { useLogout, useMe } from "./use-auth";

const CARD = "rounded-card p-5 ring-1 ring-line";
/** 로그인 · 가입 뒤 ME로 돌아온다 */
const BACK_TO_ME = "/me";

// ME 맨 위 계정 카드. 로그인하지 않아도 모든 기능을 쓸 수 있어 로그인은 권하기만 한다.
// 로그인해도 저장한 플랜 · 장소는 아직 이 브라우저(localStorage)에만 있다(서버 동기화 없음).
// 불러오는 중에는 로그아웃 상태 카드와 같은 높이의 자리표시를 둬 아래 목록이 밀리지 않게 한다
export function AccountCard() {
  const t = useTranslations("Auth.account");
  const me = useMe();
  const logout = useLogout();
  const headingId = useId();

  let body: React.ReactNode;
  // 받아 둔 값이 있으면 다시 받기가 실패해도 그 값을 보인다
  if (me.data) {
    body = (
      <div className={CARD}>
        <h2 id={headingId} className="text-headline font-bold break-all">
          {t("greeting", { nickname: me.data.nickname })}
        </h2>
        <p className="mt-1 text-label break-all text-fg-muted">
          {me.data.email}
        </p>
        <Button
          variant="secondary"
          size="md"
          loading={logout.isPending}
          // 처리 중에는 글자가 도는 표시로 바뀌어 이름을 따로 준다
          aria-label={logout.isPending ? t("logout") : undefined}
          onClick={() => logout.mutate()}
          className="mt-4"
        >
          {t("logout")}
        </Button>
        <p className="mt-3 text-caption text-fg-subtle">{t("localOnly")}</p>
      </div>
    );
  } else if (me.data === null) {
    body = (
      <div className={CARD}>
        <h2 id={headingId} className="text-headline font-bold">
          {t("title")}
        </h2>
        <p className="mt-1 text-body text-fg-muted">{t("guest")}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ButtonLink href={authHref("/login", { next: BACK_TO_ME })} size="md">
            {t("login")}
          </ButtonLink>
          <ButtonLink
            href={authHref("/signup", { next: BACK_TO_ME })}
            variant="secondary"
            size="md"
          >
            {t("signup")}
          </ButtonLink>
        </div>
      </div>
    );
  } else if (me.isError) {
    body = (
      <div className={`${CARD} flex items-center gap-3`}>
        <p role="alert" className="flex-1 text-label text-fg-muted">
          {t("loadError")}
        </p>
        <Button
          variant="secondary"
          size="md"
          loading={me.isFetching}
          aria-label={me.isFetching ? t("retry") : undefined}
          onClick={() => void me.refetch()}
          className="shrink-0"
        >
          {t("retry")}
        </Button>
      </div>
    );
  } else {
    // 로그아웃 상태 카드와 같은 줄을 보이지 않게 그려 높이를 맞춘다
    body = (
      <>
        <div
          aria-hidden
          className="animate-pulse rounded-card bg-fill p-5 motion-reduce:animate-none"
        >
          <div className="invisible">
            <p className="text-headline font-bold">{t("title")}</p>
            <p className="mt-1 text-body">{t("guest")}</p>
            <div className="mt-4 h-12" />
          </div>
        </div>
        <p role="status" className="sr-only">
          {t("loading")}
        </p>
      </>
    );
  }

  return (
    <section
      aria-labelledby={me.data !== undefined ? headingId : undefined}
      className="px-5 pt-2 pb-8"
    >
      {body}
    </section>
  );
}
