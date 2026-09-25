# 화면과 디자인

> 디자인 시스템은 아직 확정 전이다. 지금 토큰은 PoC의 팔레트와 서체를 임시로 옮겨 둔 것이다.
> 확정되면 이 문서와 `src/app/globals.css`의 `@theme`을 함께 고친다.

## 토큰

| 이름     | 값        | 클래스 예                  |
| -------- | --------- | -------------------------- |
| `ink`    | `#153b3d` | `text-ink`, `border-ink`   |
| `accent` | `#b8431c` | `bg-accent`, `text-accent` |
| `cream`  | `#f2ece0` | `bg-cream`                 |

- 서체는 Archivo(라틴 문자 · 숫자)와 Gowun Dodum(한글)이다. `font-sans` 하나로 섞여 나온다
- hex 값을 클래스(`bg-[#153b3d]`)나 `style`에 직접 쓰지 않는다. 필요한 색이 없으면 토큰을 추가한다

## 반응형

- 모바일부터 만든다. 접두사 없는 클래스가 390px 폭 기준이고, 넓은 화면은 `md:`(768px) · `lg:`(1024px)로 덧붙인다
- 글자는 14px 이상, 누르는 영역은 44px 이상으로 둔다
- 한글은 단어 단위로 줄바꿈한다. `body`에 `break-keep`(word-break: keep-all)이 걸려 있으니 풀지 않는다.
  URL처럼 띄어쓰기 없이 긴 문자열이 들어가는 곳에만 `break-all`을 따로 준다
- 화면을 바꾸면 390px과 1280px 두 폭에서 직접 띄워 본다

## 이미지와 폰트

- 이미지는 `next/image`로 넣는다. 외부 도메인 이미지는 `next.config.ts`의 `images.remotePatterns`에 도메인을 추가한다
- 폰트는 `next/font`로만 불러온다. `<link>`로 Google Fonts를 걸지 않는다
