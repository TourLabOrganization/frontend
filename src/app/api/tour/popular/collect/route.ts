import {
  allTargets,
  collectPopular,
  homeTargets,
  type CollectScope,
} from "@/lib/tour-collect";
import { tourApiKey, tourNotConfigured, tourUnavailable } from "@/lib/tour-api";

// 인기 관광지에서 앱 장소 목록에 없는 곳을 모은다(lib/tour-collect.ts). scripts/add-popular-places.mjs가 개발 서버에서 부르고
// 결과를 features/planner/data/added-places.json 등에 합친다. 시군구 211곳 × 최대 5쪽을 부르므로 배포에서는 열지 않는다(404).
// 쿼리: scope=all(기본, 장소가 있는 시군구 전부) | home(홈 칩 8개 도시) · regions=서울,부산(이 지역만) · top=10(지역마다 볼 상위 수, 0이면 전부)
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production")
    return Response.json({ message: "not found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") ?? "all";
  if (scope !== "all" && scope !== "home")
    return Response.json({ message: "invalid scope" }, { status: 400 });
  const regions = (params.get("regions") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const top = Number(params.get("top") ?? "10");
  if (!Number.isInteger(top) || top < 0)
    return Response.json({ message: "invalid top" }, { status: 400 });
  const key = tourApiKey();
  if (!key) return tourNotConfigured();
  const targets =
    (scope as CollectScope) === "home"
      ? homeTargets(regions.length ? regions : undefined)
      : allTargets(
          undefined,
          undefined,
          1,
          regions.length ? regions : undefined,
        );
  try {
    const result = await collectPopular(key, targets, {
      top,
      log: (line) => console.log(`[popular/collect] ${line}`),
    });
    return Response.json(
      {
        scope,
        targets: targets.map((t) => ({ region: t.region, codes: t.codes })),
        ...result,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return tourUnavailable();
  }
}
