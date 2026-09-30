import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { demoAccount } from "@/features/auth/demo-account";
import { LoginForm } from "@/features/auth/LoginForm";
import { safeNext } from "@/features/auth/next-path";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.login");
  return { title: t("metaTitle") };
}

// 이메일 로그인. ?next= 로그인 뒤 갈 앱 안 경로(없거나 앱 밖이면 /me) · ?email= 채울 이메일 · ?joined=1 가입 직후 안내.
// 토큰이 브라우저에 있어 로그인 동작은 클라이언트(LoginForm)가 한다
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const query = await searchParams;
  const next = safeNext(query.next);
  const email = typeof query.email === "string" ? query.email : "";
  const joined = query.joined === "1";
  const t = await getTranslations("Auth.login");

  return (
    <Screen>
      <TopBar title={t("title")} />
      <main className="flex flex-1 flex-col px-6 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:pt-8">
        {/* 같은 화면으로 주소만 바뀌면(?next=/login 등) 폼 상태를 새로 시작한다. 로그인 뒤 「처리 중」에 머물지 않게 */}
        <LoginForm
          key={`${next}|${email}|${joined}`}
          next={next}
          email={email}
          joined={joined}
          // 공용 테스트 계정이 설정돼 있을 때만 버튼을 보인다(값은 서버에만 둔다)
          demo={demoAccount() !== null}
        />
      </main>
    </Screen>
  );
}
