// 장소 시트 오디오 가이드 칸 (GET /api/tour/audio?id=&locale=, 서버 전용).
// 한국관광공사 관광지 오디오 가이드(오디). 한국어 화면은 PoC Tour Planner.dc.html loadAudio와 같은 규칙:
// 한국어 이름으로 이야기 검색(storySearchList) → 대본이 있고 좌표가 ±0.12도 안인 것 중 이름이 겹치는 것, 없으면 그 첫째.
// 외국어 화면은 이름이 언어마다 달라(우리 영어 이름 Hwangnidan-gil ↔ 오디 Hwanglidan-gil) 오디 관광지 번호 tid로 잇는다(foreignAudio).
// 언어 코드는 2026-09-29 실제 호출로 확인한 값이다(ODII_LANG).
// 한국어 화면은 오디 결과가 없으면 한국관광공사 관광 스토리텔링(PoC STORY_DB · d_story*, data/stories.json)으로 대신한다.
// PoC는 대본만 보였지만 요청이 「오디오북」이라 응답의 음성 주소(audioUrl)로 재생한다.
import { loadNameTable } from "../features/names/server";
import storiesData from "../features/planner/data/stories.json";
import type { AppLocale } from "../i18n/locales";
import { hasHangul } from "./hangul";
import { type TourAudio, TOUR_DAY_SECONDS } from "./tour";
import {
  fetchTourItems,
  fetchTourPage,
  parseTourQuery,
  tourApiKey,
  tourApiUrl,
  type TourItem,
  tourJson,
  tourNotConfigured,
  type TourPlace,
  tourUnavailable,
  withoutCity,
  withoutSpaces,
} from "./tour-api";

/** 오디 언어 코드. 오디에는 ko · en · jp 자료만 있다(2026-09-29 확인, 중국어 ch · zh · cn 등은 0건) */
export type OdiiLang = "ko" | "en" | "jp";

/**
 * 화면 언어 → 오디 langCode. PoC ODII_LANG의 ja: "ja" · zh: "ch"는 0건이라 일본어는 jp,
 * 중국어 · 스페인어는 영어로 부른다
 */
export const ODII_LANG: Readonly<Record<AppLocale, OdiiLang>> = {
  ko: "ko",
  en: "en",
  ja: "jp",
  zh: "en",
  es: "en",
};

/** 오디 검색 한 번: 언어 코드와 검색어(그 언어의 장소 이름). 결과 고르기의 이름 겹침도 이 이름으로 본다 */
export type OdiiQuery = { langCode: OdiiLang; keyword: string };

/**
 * 그 언어 이름으로 찾는 검색 순서. 오디는 그 언어의 제목에서 찾는다(불국사를 한국어 이름으로 찾으면 en · jp 모두 0건, 「Bulguksa」로 찾으면 en 9건).
 * 한국어 화면 = 한국어 이름(PoC). 외국어 화면은 관광지 번호(tid)를 모를 때(한국어 해설이 없을 때)의 마지막 대안이다:
 * 영어 · 중국어 · 스페인어 = 영어 이름, 일본어 = 일본어 공식 명칭(이름표에 있을 때, jp) → 없거나 결과가 없으면 영어 이름
 */
export function odiiQueries(
  place: { ko: string; en: string },
  locale: AppLocale,
  jaName?: string,
): OdiiQuery[] {
  if (locale === "ko") return [{ langCode: "ko", keyword: place.ko }];
  const en: OdiiQuery[] = place.en
    ? [{ langCode: ODII_LANG.en, keyword: place.en }]
    : [];
  if (locale === "ja" && jaName)
    return [{ langCode: ODII_LANG.ja, keyword: jaName }, ...en];
  return en;
}

/** 오디 결과를 장소 좌표와 비교하는 한계(위도 · 경도 각각, 도). PoC ±0.12 */
export const ODII_NEAR_DEG = 0.12;

/**
 * 한국관광공사 관광 스토리텔링(PoC Tour Planner.dc.html STORY_DB 31곳, scripts/build-stories.mjs로 옮겼다).
 * 키는 장소 한국어 이름(places.json ko). 서버에서만 읽는다
 */
const STORIES = storiesData as Readonly<
  Record<string, { t: string; s: string }>
>;

/** 오디 이야기 검색 주소 (PoC와 같은 인자: 10개) */
export function odiiUrl(key: string, query: OdiiQuery): string {
  return tourApiUrl("Odii/storySearchList", key, {
    numOfRows: "10",
    pageNo: "1",
    langCode: query.langCode,
    keyword: query.keyword,
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

/** 제목 비교용 정규화 (PoC loadAudio norm: 공백 · 가운뎃점 · 괄호 무시) */
function odiiName(value: unknown): string {
  return String(value ?? "").replace(/\s|·|\(|\)/g, "");
}

/** 대본이 있고 장소 좌표와 오디 좌표(mapY 위도 · mapX 경도)가 모두 ±0.12도 안인 해설(오디 좌표가 없으면 통과) */
function odiiNear(
  items: readonly TourItem[],
  place: { lat: number; lng: number },
): TourItem[] {
  return items.filter((x) => {
    if (!x.script) return false;
    if (!place.lat || !x.mapY) return true;
    return (
      Math.abs(Number(x.mapY) - place.lat) < ODII_NEAR_DEG &&
      Math.abs(Number(x.mapX) - place.lng) < ODII_NEAR_DEG
    );
  });
}

/** 제목이 장소 이름을 품거나 장소 이름이 제목을 품는 해설 (공백 · 가운뎃점 · 괄호 무시) */
function odiiNamed(items: readonly TourItem[], name: string): TourItem[] {
  const key = odiiName(name);
  return items.filter((x) => {
    const title = odiiName(x.title);
    return title.includes(key) || key.includes(title);
  });
}

/**
 * 오디 결과에서 한 곳 고르기 (PoC loadAudio): 대본이 있고 좌표가 ±0.12도 안인 것 중
 * 제목이 장소 이름(검색어)과 겹치는 첫째, 없으면 좌표 안의 첫째. 없으면 null
 */
export function pickOdiiItem(
  items: readonly TourItem[],
  place: { name: string; lat: number; lng: number },
): TourItem | null {
  const near = odiiNear(items, place);
  return odiiNamed(near, place.name)[0] ?? near[0] ?? null;
}

/**
 * 외국어 해설을 이을 한국어 해설 후보(pickOdiiItem과 같은 기준으로 고를 수 있는 것 모두, 차례대로).
 * 같은 제목 · 좌표의 해설이 관광지 번호만 다르게 둘 이상 있을 수 있다(바람의 언덕: tid 1139 · 2880, 영어 해설은 2880에만)
 */
export function odiiKoCandidates(
  items: readonly TourItem[],
  place: { name: string; lat: number; lng: number },
): TourItem[] {
  const near = odiiNear(items, place);
  const named = odiiNamed(near, place.name);
  return named.length > 0 ? named : near.slice(0, 1);
}

/** 오디 해설 하나 → 응답. 대본이 비었으면 null. 제목은 해설 제목(audioTitle) → 관광지 제목(title) */
export function odiiAudio(item: TourItem | null): TourAudio | null {
  if (!item) return null;
  const script = String(item.script ?? "").trim();
  if (!script) return null;
  const url = audioUrl(item.audioUrl);
  const seconds = playSeconds(item.playTime);
  return {
    title: String(item.audioTitle || item.title || "").trim(),
    script,
    ...(url ? { audioUrl: url } : {}),
    ...(url && seconds ? { playTime: seconds } : {}),
    source: "odii",
  };
}

/**
 * 같은 관광지(tid) 해설 중 대표 하나(2026-09-29 팀 결정): 이 칸은 「오디오 가이드」라 음성 파일(audioUrl)이 있는 해설을 먼저 보고,
 * 그 안에서 제목이 기준 이름과 같은 것 → 품거나 품기는 것 → 첫째. 음성 있는 해설이 없으면 대본만 있는 해설에서 같은 기준
 */
function representative(
  items: readonly TourItem[],
  name: string,
): TourItem | null {
  const key = odiiName(name);
  const score = (x: TourItem) => {
    const t = odiiName(x.title);
    if (!t || !key) return 0;
    if (t === key) return 2;
    return t.includes(key) || key.includes(t) ? 1 : 0;
  };
  const best = (list: readonly TourItem[]) => {
    let top: TourItem | null = null;
    for (const x of list) if (!top || score(x) > score(top)) top = x;
    return top;
  };
  return best(items.filter((x) => audioUrl(x.audioUrl))) ?? best(items);
}

/**
 * 한국어 화면 · 이름 검색의 해설: PoC 고르기(pickOdiiItem)로 관광지(tid)를 정하고,
 * 그 tid의 해설(좌표 ±0.12도 안) 중 대표(음성 먼저, 제목 기준은 장소 이름)
 */
export function pickOdii(
  items: readonly TourItem[],
  place: { name: string; lat: number; lng: number },
): TourAudio | null {
  const base = pickOdiiItem(items, place);
  const tid = String(base?.tid ?? "");
  if (!base || !tid) return odiiAudio(base);
  const same = odiiNear(items, place).filter(
    (x) => String(x.tid ?? "") === tid,
  );
  return odiiAudio(representative(same, place.name) ?? base);
}

/** 오디 관광지(tid) 하나의 그 언어 제목과 좌표 (themeBasedList) */
export type OdiiTheme = { title: string; mapX: string; mapY: string };

/** 관광지 목록 응답 → tid → 관광지 */
export function odiiThemes(items: readonly TourItem[]): Map<string, OdiiTheme> {
  const map = new Map<string, OdiiTheme>();
  for (const x of items) {
    const tid = String(x.tid ?? "");
    const title = String(x.title ?? "").trim();
    if (tid && title && !map.has(tid))
      map.set(tid, {
        title,
        mapX: String(x.mapX ?? ""),
        mapY: String(x.mapY ?? ""),
      });
  }
  return map;
}

/** 관광지 목록을 한 번에 받는 수. en 1,356곳 · jp 1,134곳(2026-09-29)이라 두 쪽 */
const THEME_ROWS = 1000;
/** 관광지 목록을 받는 최대 쪽 수 */
const THEME_MAX_PAGES = 5;
const themeCache = new Map<
  OdiiLang,
  { at: number; themes: Promise<Map<string, OdiiTheme>> }
>();

/** 오디 관광지 목록(themeBasedList) 한 쪽 주소 */
export function odiiThemeUrl(
  key: string,
  lang: OdiiLang,
  page: number,
): string {
  return tourApiUrl("Odii/themeBasedList", key, {
    numOfRows: String(THEME_ROWS),
    pageNo: String(page),
    langCode: lang,
  });
}

/**
 * 그 언어의 오디 관광지 전체(tid → 제목 · 좌표). 한 쪽이 약 0.3MB라 Next 데이터 캐시에 넣지 않고(2MB 넘는 경고에 키가 든 주소가 찍히지 않게)
 * 서버 메모리에 하루 둔다(시군구 전체 목록과 같다). 부르는 중인 것도 같이 기다리고, 실패는 두지 않는다
 */
function themeList(key: string, lang: OdiiLang) {
  const hit = themeCache.get(lang);
  if (hit && Date.now() - hit.at < TOUR_DAY_SECONDS * 1000) return hit.themes;
  const themes = (async () => {
    const first = await fetchTourPage(odiiThemeUrl(key, lang, 1), "no-store");
    const pages = Math.min(
      THEME_MAX_PAGES,
      Math.ceil(first.total / THEME_ROWS),
    );
    const items = [...first.items];
    for (let page = 2; page <= pages; page++)
      items.push(
        ...(await fetchTourPage(odiiThemeUrl(key, lang, page), "no-store"))
          .items,
      );
    return odiiThemes(items);
  })();
  themeCache.set(lang, { at: Date.now(), themes });
  themes.catch(() => themeCache.delete(lang));
  return themes;
}

/** 테스트용: 서버 메모리의 오디 관광지 목록을 비운다 */
export function clearOdiiCache(): void {
  themeCache.clear();
}

/**
 * 한국어 해설 좌표 둘레(1km)의 그 언어 해설 주소(storyLocationBasedList, 가까운 순). 해설 제목이 관광지 제목과 다를 때 쓴다.
 * 같은 해설은 언어가 달라도 좌표가 같거나 가깝다(바람의 언덕 ko · en 같은 좌표, 불국사 대표 해설 ko · en 약 0.7km)
 */
export function odiiNearUrl(
  key: string,
  lang: OdiiLang,
  at: { mapX: unknown; mapY: unknown },
): string {
  return tourApiUrl("Odii/storyLocationBasedList", key, {
    numOfRows: "20",
    pageNo: "1",
    langCode: lang,
    mapX: String(at.mapX),
    mapY: String(at.mapY),
    radius: "1000",
  });
}

/**
 * 외국어 화면에서 같은 관광지(tid)의 해설 중 대표 하나: 대본이 있고 장소 좌표 ±0.12도 안이며(한국어와 같은 기준 — 도 단위 관광지의 먼 해설을 고르지 않게)
 * 한글이 섞이지 않은 것 중 음성 먼저, 제목 기준은 그 언어 관광지 제목(representative). 없으면 null
 */
export function pickOdiiByTid(
  items: readonly TourItem[],
  tid: string,
  themeTitle: string,
  place: { lat: number; lng: number },
): TourAudio | null {
  const same = odiiNear(items, place).filter(
    (x) =>
      String(x.tid ?? "") === tid &&
      !hasHangul(`${x.title ?? ""}${x.audioTitle ?? ""}${x.script ?? ""}`),
  );
  return odiiAudio(representative(same, themeTitle));
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
  const query = await parseTourQuery(request, true);
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
    if (locale === "ko") {
      const ko = await koSearch(key, place);
      audio = pickOdii(ko.items, {
        name: ko.name,
        lat: place.lat,
        lng: place.lng,
      });
    } else audio = await foreignAudio(key, place, locale);
  } catch {
    return story ? tourJson(story, 0) : tourUnavailable();
  }
  return tourJson(audio ?? story ?? { empty: true }, TOUR_DAY_SECONDS);
}

/**
 * 한국어 해설 검색: 장소 한국어 이름 → 앞의 도시 이름을 뗀 이름(「전주한옥마을」 → 「한옥마을」) →
 * 공백을 뺀 이름(「정동심곡 바다부채길」 → 「정동심곡바다부채길」). 고를 해설(좌표 ±0.12도, 이름 겹침)이
 * 나온 첫 검색의 결과와 그 검색어. 한국어 화면과 외국어 화면의 관광지(tid) 찾기가 함께 쓴다
 */
async function koSearch(
  key: string,
  place: TourPlace,
): Promise<{ items: TourItem[]; name: string }> {
  const names = [
    place.ko,
    withoutCity(place.ko, place.locKo) ?? "",
    ...withoutSpaces(place.ko, place.locKo),
  ].filter(Boolean);
  for (const name of names) {
    const items = await fetchTourItems(
      odiiUrl(key, { langCode: "ko", keyword: name }),
      TOUR_DAY_SECONDS,
    );
    const at = { name, lat: place.lat, lng: place.lng };
    if (odiiKoCandidates(items, at).length > 0) return { items, name };
  }
  return { items: [], name: place.ko };
}

/** 검색어 차례로 이야기 검색 → PoC 고르기(이름 겹침 · 좌표) → 외국어 화면이면 한글 거르기. 처음 나온 것 */
async function searchAudio(
  key: string,
  place: TourPlace,
  locale: AppLocale,
  queries: readonly OdiiQuery[],
): Promise<TourAudio | null> {
  for (const q of queries) {
    const items = await fetchTourItems(odiiUrl(key, q), TOUR_DAY_SECONDS);
    const at = { name: q.keyword, lat: place.lat, lng: place.lng };
    const audio = audioForLocale(pickOdii(items, at), locale);
    if (audio) return audio;
  }
  return null;
}

/**
 * 외국어 화면의 해설 (2026-09-29 팀 규칙). 오디 관광지 번호 tid는 언어가 달라도 같다(불국사 ko · en 모두 2, 해설 번호 stid는 다르다).
 * 1. 한국어 이름(없으면 앞의 도시 이름을 뗀 이름 → 공백을 뺀 이름)으로 ko 해설을 찾고(한국어 화면과 같은 기준) 그 tid를 얻는다. 같은 기준의 해설이 tid만 달리 여럿이면 차례로 본다
 * 2. 그 언어 관광지 목록(themeBasedList, 서버 메모리)에서 tid의 제목을 찾는다. 일본어는 jp → 없으면 en
 * 3. 그 제목으로 그 언어 이야기 검색 → 같은 tid 해설만 남겨 대표 하나. 해설 제목이 관광지 제목과 달라 없으면
 *    (관광지 「Hwanglidan-gil」 ↔ 해설 「Hwangnidan Street」, 관광지가 도 단위 「Gyeongsangnam-do」 ↔ 해설 「Windy Hill」)
 *    그 ko 해설 좌표 둘레 1km의 그 언어 해설에서 같은 tid
 * 4. tid를 알지만 그 언어들에 없으면 숨긴다. ko 해설이 없어 tid를 모를 때만 그 언어 이름으로 찾는다(odiiQueries)
 */
async function foreignAudio(
  key: string,
  place: TourPlace,
  locale: AppLocale,
): Promise<TourAudio | null> {
  const ko = await koSearch(key, place);
  // tid마다 처음 나온 ko 해설(좌표를 쓴다)
  const byTid = new Map<string, TourItem>();
  for (const x of odiiKoCandidates(ko.items, {
    name: ko.name,
    lat: place.lat,
    lng: place.lng,
  })) {
    const tid = String(x.tid ?? "");
    if (tid && !byTid.has(tid)) byTid.set(tid, x);
  }
  if (byTid.size === 0) {
    const jaName =
      locale === "ja"
        ? (await loadNameTable("ja")).places[place.id]
        : undefined;
    return searchAudio(key, place, locale, odiiQueries(place, locale, jaName));
  }
  const langs: OdiiLang[] = locale === "ja" ? ["jp", "en"] : ["en"];
  for (const lang of langs) {
    const themes = await themeList(key, lang);
    for (const [tid, ko] of byTid) {
      const theme = themes.get(tid);
      if (!theme) continue;
      const byTitle = await fetchTourItems(
        odiiUrl(key, { langCode: lang, keyword: theme.title }),
        TOUR_DAY_SECONDS,
      );
      let audio = pickOdiiByTid(byTitle, tid, theme.title, place);
      if (!audio && ko.mapX && ko.mapY) {
        const near = await fetchTourItems(
          odiiNearUrl(key, lang, { mapX: ko.mapX, mapY: ko.mapY }),
          TOUR_DAY_SECONDS,
        );
        audio = pickOdiiByTid(near, tid, theme.title, place);
      }
      if (audio) return audio;
    }
  }
  return null;
}
