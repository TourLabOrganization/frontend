import { findPlace } from "@/features/planner/data";
import details from "@/features/planner/data/place-details.json";
import type {
  PlannerPlaceDetail,
  PlannerPlaceView,
} from "@/features/planner/place-detail";
import placeNamesEn from "@/features/translations/data/place-names.en.json";
import {
  hasHangul,
  phraseText,
  placeDescEn,
  sourceText,
} from "@/features/translations/text";
import { isKtoId } from "@/features/planner/kto-place";
import { locales } from "@/i18n/locales";
import { ktoDetailResponse } from "@/lib/tour-spot";

// 투어 플래너 장소 한 곳의 무거운 필드(설명 · 사진 · 중일 이름 · 좌표 근거 · 카카오 장소 URL).
// 3,118곳 전체(약 650KB)를 클라이언트 번들에 넣지 않으려고, 장소 시트를 열 때 한 곳씩 여기서 받는다
// (features/planner/use-place-detail.ts). 데이터는 빌드에 들어 있는 JSON이라 외부 호출은 없다.
// ?locale=<언어>를 붙이면 그 언어로 옮긴 설명 · 운영시간 · 좌표 기준(view)을 함께 돌려준다.
// 번역 표(features/translations)도 무거워 여기서만 읽는다(docs/i18n.md)
const DETAILS = details as Readonly<Record<string, PlannerPlaceDetail>>;
const APP_NAMES = placeNamesEn as Readonly<Record<string, string>>;

function viewOf(
  id: string,
  detail: PlannerPlaceDetail,
  locale: string,
): PlannerPlaceView {
  const place = findPlace(id);
  if (locale === "ko")
    return {
      desc: detail.desc?.ko ?? detail.desc?.en,
      hours: place?.hrs,
      source: sourceText(detail.src, locale),
      appTranslated: false,
    };
  const descEn =
    detail.desc?.en ?? (detail.desc?.ko ? placeDescEn(detail.desc.ko) : null);
  // 이름을 앱이 옮겼는가: 원천에 영어 이름이 없던 장소이고, 그 언어 공식 명칭(중 · 일)도 없다
  const officialName =
    (locale === "zh" && detail.zh) || (locale === "ja" && detail.ja);
  const nameByApp = Object.hasOwn(APP_NAMES, id) && !officialName;
  const descByApp = !detail.desc?.en && !!descEn;
  return {
    desc: descEn ?? undefined,
    hours: place && phraseText(place.hrs, locale),
    source: sourceText(detail.src, locale),
    appTranslated: nameByApp || descByApp,
  };
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/planner/places/[id]">,
) {
  const { id } = await ctx.params;
  // 신규 관광지(kto:)는 한국관광공사 공통정보에서 만든다(lib/tour-spot.ts)
  if (isKtoId(id))
    return ktoDetailResponse(
      id,
      new URL(request.url).searchParams.get("locale"),
    );
  if (!Object.hasOwn(DETAILS, id))
    return Response.json({ message: "not found" }, { status: 404 });
  const detail = DETAILS[id];
  const locale = new URL(request.url).searchParams.get("locale");
  const view =
    locale && (locales as readonly string[]).includes(locale)
      ? viewOf(id, detail, locale)
      : null;
  // 번역이 빠진 곳이 생겨도 한국어 원문을 외국어 화면에 보내지 않는다(테스트가 막지만 한 번 더)
  if (view && locale !== "ko") {
    if (view.desc && hasHangul(view.desc)) view.desc = undefined;
    if (view.hours && hasHangul(view.hours)) view.hours = undefined;
  }
  return Response.json(view ? { ...detail, view } : detail, {
    headers: {
      // 배포마다 바뀔 수 있어 immutable은 쓰지 않는다
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
