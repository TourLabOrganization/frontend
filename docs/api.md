# 백엔드 연동

백엔드는 `TourLabOrganization/backend`(Spring Boot 4)다.
API 목록은 백엔드의 `/swagger-ui.html`, 명세 JSON은 `/v3/api-docs`에 있다.

## 응답 규약

| 경우 | 본문                                                       |
| ---- | ---------------------------------------------------------- |
| 성공 | `{ "code": "API_SUCCESS", "message": "...", "data": ... }` |
| 실패 | `{ "code": "RESOURCE_NOT_FOUND", "message": "..." }`       |

`api()`는 성공이면 `data`만 돌려주고, 실패면 `ApiError`(`status`, `code`, `message`)를 던진다.

## 쓰는 법

```tsx
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError, saveTokens, type AuthTokens } from "@/lib/api/client";

type UserMeResponse = { id: number; email: string };

// 조회
const me = useQuery({
  queryKey: ["users", "me"],
  queryFn: () => api<UserMeResponse>("/api/v1/users/me"),
});

// 변경
const login = useMutation({
  mutationFn: (body: { email: string; password: string }) =>
    api<AuthTokens>("/api/v1/auth/login", {
      method: "POST",
      body,
      auth: false,
    }),
  onSuccess: (tokens) => saveTokens(tokens),
});

// 에러 분기는 code로 한다
if (
  login.error instanceof ApiError &&
  login.error.code === "AUTH_LOGIN_FAILED"
) {
  // ...
}
```

- 응답 타입 이름은 Swagger에 나온 DTO 이름을 그대로 쓴다
- `queryKey`는 URL 경로를 쪼갠 배열로 쓴다: `/api/v1/users/me` → `["users", "me"]`

## 인증

- 로그인하면 access token(30분)과 refresh token(14일)을 받는다. `saveTokens()`로 저장한다(localStorage)
- `api()`가 access token을 `Authorization: Bearer ...`로 붙인다. 로그인 · 회원가입 · 재발급 요청에는 `auth: false`를 준다
- 401이 오면 `api()`가 `/api/v1/auth/reissue`로 한 번 재발급하고 원래 요청을 다시 보낸다
- **refresh token은 한 번 쓰면 폐기된다.** 재발급을 따로 구현하지 않는다.
  같은 refresh token으로 두 번 요청하면 두 번째가 실패해 로그아웃된다. `api()`는 동시에 여러 401이 나도 재발급을 한 번만 보낸다
- 로그아웃은 `api("/api/v1/auth/logout", { method: "POST" })` 뒤에 `saveTokens(null)`

## 백엔드에 알려 줄 것

- 백엔드 CORS는 백엔드 환경변수 `CORS_ALLOWED_ORIGINS`에 적힌 주소만 허용한다.
  백엔드 `.env.example`의 기본값이 `http://localhost:5173`이라서 개발 서버를 5173번에서 띄운다(`npm run dev`).
  포트를 바꾸지 않는다. 배포 도메인은 정해지면 백엔드에 추가해 달라고 요청한다
- 백엔드를 로컬에서 띄우면 API 문서는 `http://localhost:8080/swagger-ui.html`이다 (JDK 21 · Docker 필요, 백엔드 README)
- Vercel 미리보기 배포는 주소가 매번 바뀐다. 정확한 주소만 받는 지금 설정으로는 미리보기에서 백엔드 호출이 막힌다
