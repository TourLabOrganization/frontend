/**
 * 백엔드(Spring) 호출 창구. 백엔드 API는 이 파일의 api()로만 부른다.
 * 응답 규약: 성공 {code, message, data} · 실패 {code, message} — docs/api.md
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const TOKEN_KEY = "tour-navigator.tokens";
const REISSUE_PATH = "/api/v1/auth/reissue";

export type AuthTokens = { accessToken: string; refreshToken: string };

type ApiResult<T> = { code: string; message: string; data: T };
type ErrorResult = { code: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiInit = Omit<RequestInit, "body"> & {
  /** JSON으로 직렬화해서 보낸다 */
  body?: unknown;
  /** false면 access token을 싣지 않는다. 로그인·회원가입·재발급에 쓴다 */
  auth?: boolean;
};

export function readTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    return null;
  }
}

/** 로그인·재발급 응답을 저장한다. null을 넘기면 로그아웃 */
export function saveTokens(tokens: AuthTokens | null) {
  if (tokens) window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else window.localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  let res = await send(path, init);
  if (res.status === 401 && init.auth !== false && readTokens()) {
    if (await reissue()) res = await send(path, init);
  }
  return parse<T>(res);
}

function send(path: string, { body, auth = true, headers, ...rest }: ApiInit) {
  if (!BASE_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");

  const merged = new Headers(headers);
  if (body !== undefined) merged.set("Content-Type", "application/json");
  const accessToken = auth ? readTokens()?.accessToken : undefined;
  if (accessToken) merged.set("Authorization", `Bearer ${accessToken}`);

  return fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: merged,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function parse<T>(res: Response): Promise<T> {
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = payload as ErrorResult | null;
    throw new ApiError(
      res.status,
      error?.code ?? "UNKNOWN_ERROR",
      error?.message ?? res.statusText,
    );
  }
  return (payload as ApiResult<T> | null)?.data as T;
}

// refresh token은 한 번 쓰면 폐기된다(회전). 401이 동시에 여러 개 나도
// 재발급 요청은 하나만 보내고 나머지는 그 결과를 기다린다.
let reissuing: Promise<boolean> | null = null;

function reissue(): Promise<boolean> {
  reissuing ??= (async () => {
    const used = readTokens()?.refreshToken;
    if (!used) return false;

    const res = await send(REISSUE_PATH, {
      method: "POST",
      body: { refreshToken: used },
      auth: false,
    });
    if (res.ok) {
      saveTokens(((await res.json()) as ApiResult<AuthTokens>).data);
      return true;
    }
    // 다른 탭이 먼저 재발급해 토큰이 바뀌었다면 그 토큰으로 다시 시도하면 된다
    const latest = readTokens();
    if (latest && latest.refreshToken !== used) return true;
    saveTokens(null);
    return false;
  })().finally(() => {
    reissuing = null;
  });
  return reissuing;
}
