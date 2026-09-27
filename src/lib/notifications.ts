// 머리줄 알림(홈 · ME 종 아이콘). 순수 함수만 둔다.
// 이 브라우저에 실제로 있는 정보만 알림으로 만든다(지어낸 알림은 없다):
//   recommend  마지막 테마 추천 결과(tn.lastRecommendation)가 있다
//   planner    투어 플래너 코스에 담아 둔 장소가 있다(tn.planner.course)
//   saved      저장된 플랜이 있다(tn.savedPlans)
//   citytour   홈 지역 시티투어 데이터(노선 수 · 지역 수 · 가장 최근 기준일)
// id는 내용이 바뀌면 달라진다. 그래서 읽은 뒤 내용이 바뀌면 다시 안 읽음이 된다

export type AppNotification =
  | { id: string; kind: "recommend"; href: string; type: string }
  | { id: string; kind: "planner"; href: string; count: number }
  | { id: string; kind: "saved"; href: string; count: number }
  | {
      id: string;
      kind: "citytour";
      href: string;
      tours: number;
      regions: number;
      date: string;
    };

export type NotificationInput = {
  /** 마지막 추천의 답 문자열과 유형 이름. 없으면 null */
  recommendation: { a: string; type: string } | null;
  /** 플래너 코스에 담은 장소 id */
  plannerPlaceIds: readonly string[];
  /** 저장된 플랜의 저장 시각(ms) */
  savedAt: readonly number[];
  citytour: { tours: number; regions: number; date: string };
};

/** 지금 보일 알림. 추천 → 플래너 코스 → 저장된 플랜 → 시티투어 순 */
export function buildNotifications(
  input: NotificationInput,
): AppNotification[] {
  const out: AppNotification[] = [];
  const { recommendation, plannerPlaceIds, savedAt, citytour } = input;
  if (recommendation) {
    out.push({
      id: `recommend:${recommendation.a}`,
      kind: "recommend",
      href: `/recommend/result?a=${recommendation.a}`,
      type: recommendation.type,
    });
  }
  if (plannerPlaceIds.length > 0) {
    out.push({
      id: `planner:${plannerPlaceIds.join(",")}`,
      kind: "planner",
      href: "/planner?tab=course",
      count: plannerPlaceIds.length,
    });
  }
  if (savedAt.length > 0) {
    out.push({
      id: `saved:${savedAt.length}:${Math.max(...savedAt)}`,
      kind: "saved",
      href: "/me",
      count: savedAt.length,
    });
  }
  if (citytour.tours > 0) {
    out.push({
      id: `citytour:${citytour.tours}:${citytour.date}`,
      kind: "citytour",
      href: "/#home-citytour",
      ...citytour,
    });
  }
  return out;
}

/** 안 읽은 알림 수 */
export function unreadCount(
  list: readonly AppNotification[],
  readIds: readonly string[],
): number {
  return list.filter((n) => !readIds.includes(n.id)).length;
}

/** 알림을 읽음으로 표시한 뒤의 읽은 id. 지금 없는 알림의 id는 버린다 */
export function markRead(
  list: readonly AppNotification[],
  readIds: readonly string[],
  ids: readonly string[],
): string[] {
  const current = new Set(list.map((n) => n.id));
  return [...new Set([...readIds, ...ids])].filter((id) => current.has(id));
}
