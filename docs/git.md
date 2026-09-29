# Git

백엔드 리포와 같은 규칙을 쓴다.

## 브랜치

주 브랜치는 2개다.

| 브랜치    | 역할                                                 |
| --------- | ---------------------------------------------------- |
| `develop` | 개발 기준. 일반 작업은 여기로 머지한다               |
| `main`    | 릴리스 기준. 릴리스할 때만 `develop`에서 PR을 올린다 |

- 작업은 `<타입>/<기능요약>` 브랜치에서 하고, PR로만 머지한다. 베이스 브랜치는 `develop`이다
- 타입은 커밋 타입과 같은 목록에서 고르고, 기능요약은 kebab-case로 쓴다.
  예: `feat/theme-route-page`, `docs/ai-convention`, `ci/github-actions`
- **`develop`과 `main`에 직접 푸시하거나 force-push하지 않는다.** 사람이 승인해도 하지 않는다

## 커밋

- 메시지는 `<타입>: <한국어 요약>`으로 쓴다. 예: `feat: 테마 코스 화면 추가`
- 타입은 `feat` `fix` `refactor` `docs` `test` `chore` `ci` 중에서 고른다
- `refactor`는 동작 변화가 없는 정리에만 쓴다
- 커밋 전에 `npm run format`을 실행하고 `npm run check`가 통과하는지 본다

## PR

- `.github/PULL_REQUEST_TEMPLATE.md`를 채운다
- 화면을 바꿨으면 390px 폭과 데스크톱 폭 캡처를 붙인다
- CI(`npm run check`)가 통과해야 머지한다

원격에 올리기 전 확인 절차는 `AGENTS.md` 6번 규칙 하나만 따른다. 여기에 다시 적지 않는다.
