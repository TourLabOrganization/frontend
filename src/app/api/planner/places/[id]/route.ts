import details from "@/features/planner/data/place-details.json";
import type { PlannerPlaceDetail } from "@/features/planner/place-detail";

// 투어 플래너 장소 한 곳의 무거운 필드(설명 · 사진 · 중일 이름 · 좌표 근거 · 카카오 장소 URL).
// 3,118곳 전체(약 650KB)를 클라이언트 번들에 넣지 않으려고, 장소 시트를 열 때 한 곳씩 여기서 받는다
// (features/planner/use-place-detail.ts). 데이터는 빌드에 들어 있는 JSON이라 외부 호출은 없다.
const DETAILS = details as Readonly<Record<string, PlannerPlaceDetail>>;

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/planner/places/[id]">,
) {
  const { id } = await ctx.params;
  if (!Object.hasOwn(DETAILS, id))
    return Response.json({ message: "not found" }, { status: 404 });
  return Response.json(DETAILS[id], {
    headers: {
      // 배포마다 바뀔 수 있어 immutable은 쓰지 않는다
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
