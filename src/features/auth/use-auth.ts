import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type AuthTokens, saveTokens } from "@/lib/api/client";
import {
  type AuthLoginRequest,
  type AuthSignupRequest,
  fetchMe,
  login,
  logout,
  signup,
} from "./auth-api";
import { authHref } from "./next-path";

/** 내 정보 queryKey. URL 경로를 쪼갠 배열이다(docs/api.md) */
export const ME_QUERY_KEY = ["users", "me"] as const;

// 기기가 오프라인이어도 멈추지 않고 부른다(TanStack 기본 online은 오프라인이면 끝없이 기다린다).
// 그래야 실패 문구 · 다시 시도가 보이고, 로그아웃은 서버 호출이 실패해도 이어지며, 토큰이 없는 내 정보는 네트워크 없이 null이 된다
const NETWORK_MODE = "always";

/**
 * 로그인한 사용자(UserMeResponse). 로그아웃 상태면 data가 null이다.
 * 토큰은 브라우저(localStorage)에만 있어 queryFn에서만 읽는다. 서버 렌더와 첫 클라이언트 렌더는 둘 다
 * 「불러오는 중」이라 수화가 어긋나지 않는다. 401은 null로 끝나 다시 시도하지 않고, 그 밖의 실패만 한 번 더 부른다
 */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    retry: 1,
    networkMode: NETWORK_MODE,
  });
}

/** 토큰 저장 → 내 정보 다시 받기 → next로. 다시 받은 뒤 옮겨서 다음 화면이 로그아웃 상태로 먼저 그려지지 않는다 */
function useSignIn(next: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async (tokens: AuthTokens) => {
    saveTokens(tokens);
    await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    router.replace(next);
  };
}

export function useLogin(next: string) {
  const signIn = useSignIn(next);
  return useMutation({
    mutationFn: (body: AuthLoginRequest) => login(body),
    onSuccess: signIn,
    networkMode: NETWORK_MODE,
  });
}

/**
 * 가입 → 같은 이메일 · 비밀번호로 로그인 → next로. 가입은 됐는데 자동 로그인이 실패하면
 * 가입 실패로 보이지 않게 로그인 화면(이메일을 채우고 「가입했어요」 안내)으로 보낸다
 */
export function useSignup(next: string) {
  const router = useRouter();
  const signIn = useSignIn(next);
  return useMutation({
    mutationFn: async (body: AuthSignupRequest) => {
      await signup(body);
      return login({ email: body.email, password: body.password }).catch(
        () => null,
      );
    },
    onSuccess: (tokens, body) =>
      tokens
        ? signIn(tokens)
        : router.replace(
            authHref("/login", { email: body.email, joined: true, next }),
          ),
    networkMode: NETWORK_MODE,
  });
}

/** 서버 로그아웃이 실패해도(토큰 만료 · 네트워크) 이 브라우저에서는 로그아웃한다 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logout().catch(() => null),
    onSuccess: async () => {
      saveTokens(null);
      // 받는 중이던 내 정보가 로그아웃 뒤에 도착해 로그인 상태로 되돌리지 않게 멈춘다
      await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY });
      queryClient.setQueryData(ME_QUERY_KEY, null);
    },
    networkMode: NETWORK_MODE,
  });
}
