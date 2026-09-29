// 장소 시트 오디오 가이드 칸 (GET /api/tour/audio?id=&locale=, 서버 전용).
// 한국관광공사 관광지 오디오 가이드(오디, Odii storySearchList). PoC Tour Planner.dc.html loadAudio와 같은 규칙:
// 장소 한국어 이름으로 찾고(langCode = ODII_LANG), 대본이 있고 좌표가 ±0.12도 안인 것 중 이름이 겹치는 것, 없으면 그 첫째.
// 한국어 화면은 오디 결과가 없으면 한국관광공사 관광 스토리텔링(PoC STORY_DB · d_story*, data/stories.json)으로 대신한다.
// PoC는 대본만 보였지만 요청이 「오디오북」이라 응답에 음성 주소가 있으면 넘겨 재생한다.
import storiesData from "../features/planner/data/stories.json";
import type { AppLocale } from "../i18n/locales";
import { hasHangul } from "./hangul";
import { type TourAudio, TOUR_DAY_SECONDS } from "./tour";
import {
  fetchTourItems,
  parseTourQuery,
  tourApiKey,
  tourApiUrl,
  type TourItem,
  tourJson,
  tourNotConfigured,
  tourUnavailable,
} from "./tour-api";

/** 화면 언어 → 오디 langCode (PoC ODII_LANG. 중국어는 ch, 스페인어는 오디에 없어 영어) */
export const ODII_LANG: Readonly<Record<AppLocale, string>> = {
  ko: "ko",
  en: "en",
  ja: "ja",
  zh: "ch",
  es: "en",
};

/** 오디 결과를 장소 좌표와 비교하는 한계(위도 · 경도 각각, 도). PoC ±0.12 */
export const ODII_NEAR_DEG = 0.12;

/**
 * 한국관광공사 관광 스토리텔링(PoC Tour Planner.dc.html STORY_DB 31곳, scripts/build-stories.mjs로 옮겼다).
 * 키는 장소 한국어 이름(places.json ko). 서버에서만 읽는다
 */
const STORIES = storiesData as Readonly<
  Record<string, { t: string; s: string }>
>;

/** 오디 이야기 검색 주소 (PoC와 같은 인자: 10개, 검색어는 화면 언어와 상관없이 한국어 이름) */
export function odiiUrl(
  key: string,
  locale: AppLocale,
  keyword: string,
): string {
  return tourApiUrl("Odii/storySearchList", key, {
    numOfRows: "10",
    pageNo: "1",
    langCode: ODII_LANG[locale],
    keyword,
  });
}

/** 음성 주소. http(s)만 받고 https로 올린다(배포 화면이 https라 섞인 콘텐츠로 막히지 않게) */
export function audioUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return undefined;
  }
}

/** 재생 시간 → 초. 숫자(초) · 숫자 글자 · 「분:초」 · 「시:분:초」를 받는다. 모르는 모양이면 undefined */
export function playSeconds(value: unknown): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return playSeconds(Number(v));
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return undefined;
  return playSeconds(
    Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]),
  );
}

/**
 * 오디 결과에서 한 곳 고르기 (PoC loadAudio):
 * 대본(script)이 있고, 장소 좌표와 오디 좌표(mapY 위도 · mapX 경도)가 모두 ±0.12도 안(오디 좌표가 없으면 통과)인 것 중
 * 제목이 장소 이름을 품거나 장소 이름이 제목을 품는 것(공백 · 가운뎃점 · 괄호 무시), 없으면 그 첫째. 없으면 null
 */
export function pickOdii(
  items: readonly TourItem[],
  place: { ko: string; lat: number; lng: number },
): TourAudio | null {
  const norm = (v: unknown) => String(v ?? "").replace(/\s|·|\(|\)/g, "");
  const key = norm(place.ko);
  const near = items.filter((x) => {
    if (!x.script) return false;
    if (!place.lat || !x.mapY) return true;
    return (
      Math.abs(Number(x.mapY) - place.lat) < ODII_NEAR_DEG &&
      Math.abs(Number(x.mapX) - place.lng) < ODII_NEAR_DEG
    );
  });
  const hit =
    near.find((x) => {
      const title = norm(x.title);
      return title.includes(key) || key.includes(title);
    }) ?? near[0];
  if (!hit) return null;
  const script = String(hit.script ?? "").trim();
  if (!script) return null;
  const url = audioUrl(hit.audioUrl);
  const seconds = playSeconds(hit.playTime);
  return {
    title: String(hit.audioTitle || hit.title || "").trim(),
    script,
    ...(url ? { audioUrl: url } : {}),
    ...(url && seconds ? { playTime: seconds } : {}),
    source: "odii",
  };
}

/** 한국어 스토리텔링(PoC STORY_DB). 없으면 null */
export function storyFor(ko: string): TourAudio | null {
  if (!Object.hasOwn(STORIES, ko)) return null;
  const { t, s } = STORIES[ko];
  return { title: t, script: s, source: "story" };
}

/** 외국어 화면은 제목 · 대본에 한글이 섞이면 버린다(docs/i18n.md 외국어 화면 한글 0). 한국어 화면은 그대로 */
export function audioForLocale(
  audio: TourAudio | null,
  locale: AppLocale,
): TourAudio | null {
  if (!audio || locale === "ko") return audio;
  return hasHangul(audio.title) || hasHangul(audio.script) ? null : audio;
}

/** GET /api/tour/audio 처리. 응답 { title, script, audioUrl?, playTime?, source } · 결과 없음 { empty: true } */
export async function tourAudioResponse(request: Request): Promise<Response> {
  const query = parseTourQuery(request, true);
  if ("error" in query) return query.error;
  const { place, locale } = query;
  // 한국어 화면은 오디 결과가 없으면(키 없음 · 외부 실패 포함) 스토리텔링을 보인다(PoC d_storyShow)
  const story = locale === "ko" ? storyFor(place.ko) : null;
  const key = tourApiKey();
  // 키가 없으면: 한국어 화면은 스토리텔링 또는 결과 없음(스토리텔링은 키 없이 보이는 칸이라 장소 시트가 키 없이도 부른다,
  // components/ui/tour-api-context.tsx), 외국어 화면은 503. 키가 생기면 바로 바뀌게 캐시하지 않는다
  if (!key) {
    if (locale !== "ko") return tourNotConfigured();
    return tourJson(story ?? { empty: true }, 0);
  }
  let audio: TourAudio | null;
  try {
    const items = await fetchTourItems(
      odiiUrl(key, locale, place.ko),
      TOUR_DAY_SECONDS,
    );
    audio = audioForLocale(pickOdii(items, place), locale);
  } catch {
    return story ? tourJson(story, 0) : tourUnavailable();
  }
  return tourJson(audio ?? story ?? { empty: true }, TOUR_DAY_SECONDS);
}
