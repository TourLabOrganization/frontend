import type { ThemeSlug } from "@/features/recommend/themes";

/**
 * 테마 → 백엔드 코스 id (GET /api/v1/courses 의 courseId, 2026-09-27 확인).
 * 여행 정보 탭의 「데이터랩으로 본 {지역}」은 이 코스의 regions 중 TFI · 체류시간이 있는 지역을 보인다
 */
export const THEME_COURSE_ID: Record<ThemeSlug, string> = {
  "kings-warden": "kings-warden-route",
  "kpop-demon-hunters": "kpop-demon-hunters-route",
  "rescene-route": "rescene-route",
  "jeju-k-drama": "jeju-k-drama-route",
  "busan-film-trip": "busan-cinema-route",
};
