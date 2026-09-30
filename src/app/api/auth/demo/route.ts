import { api, type AuthTokens } from "@/lib/api/client";
import { demoAccount } from "@/features/auth/demo-account";

const NO_STORE = { "Cache-Control": "no-store" };

// 로그인 화면 「테스트 계정으로 로그인」. 공용 테스트 계정으로 백엔드에 로그인해 토큰만 돌려준다(비밀번호는 서버에만 있다).
// 환경변수가 없으면 404(화면은 버튼을 숨긴다), 백엔드 실패 · 시간 초과는 502
export async function POST() {
  const account = demoAccount();
  if (!account)
    return Response.json(
      { message: "not configured" },
      { status: 404, headers: NO_STORE },
    );
  try {
    const tokens = await api<AuthTokens>("/api/v1/auth/login", {
      method: "POST",
      body: account,
      auth: false,
      signal: AbortSignal.timeout(8000),
    });
    return Response.json(tokens, { headers: NO_STORE });
  } catch {
    return Response.json(
      { message: "demo login unavailable" },
      { status: 502, headers: NO_STORE },
    );
  }
}
