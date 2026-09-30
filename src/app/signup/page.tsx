import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { safeNext } from "@/features/auth/next-path";
import { SignupForm } from "@/features/auth/SignupForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.signup");
  return { title: t("metaTitle") };
}

// 이메일 회원가입. ?next= 가입 뒤 갈 앱 안 경로(없거나 앱 밖이면 /me).
// 토큰이 브라우저에 있어 가입 · 로그인 동작은 클라이언트(SignupForm)가 한다
export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const next = safeNext((await searchParams).next);
  const t = await getTranslations("Auth.signup");

  return (
    <Screen>
      <TopBar title={t("title")} />
      <main className="flex flex-1 flex-col px-6 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:pt-8">
        {/* 같은 화면으로 주소만 바뀌면(?next=/signup 등) 폼 상태를 새로 시작한다. 가입 뒤 「처리 중」에 머물지 않게 */}
        <SignupForm key={next} next={next} />
      </main>
    </Screen>
  );
}
