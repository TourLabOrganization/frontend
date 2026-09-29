import { EMPTY_NAMES, type NameTable } from "./names";

/** 앱이 옮긴 장소 이름표가 있는 언어(중 · 일 · 스페인어) */
type AppNameLocale = "zh" | "ja" | "es";

/**
 * 앱이 옮긴 장소 이름(장소 id → 이름, features/translations/data/place-names.<언어>.json). 그 언어 공식 명칭이 없는 장소만 있다.
 * 서버에서만 부른다(장소 시트의 「앱이 번역했어요」를 정할 때도 쓴다). 표가 없는 언어는 빈 표
 */
export async function loadAppPlaceNames(
  locale: string,
): Promise<Readonly<Record<string, string>>> {
  switch (locale as AppNameLocale) {
    case "zh":
      return (await import("../translations/data/place-names.zh.json")).default;
    case "ja":
      return (await import("../translations/data/place-names.ja.json")).default;
    case "es":
      return (await import("../translations/data/place-names.es.json")).default;
    default:
      return {};
  }
}

async function officialTable(locale: string): Promise<NameTable | null> {
  switch (locale) {
    case "zh":
      return (await import("./data/zh.json")).default;
    case "ja":
      return (await import("./data/ja.json")).default;
    case "es":
      return (await import("./data/es.json")).default;
    default:
      return null;
  }
}

/**
 * 화면 언어의 이름표. 서버에서만 부른다(언어마다 따로 불러와서 다른 언어 사용자에게 싣지 않는다).
 * 장소 이름은 그 언어 공식 명칭(data/<언어>.json) → 앱이 옮긴 이름(loadAppPlaceNames) 순이다.
 * 한국어 · 영어는 이름표가 없다(데이터에 ko · en이 들어 있다)
 */
export async function loadNameTable(locale: string): Promise<NameTable> {
  const [official, app] = await Promise.all([
    officialTable(locale),
    loadAppPlaceNames(locale),
  ]);
  if (!official) return EMPTY_NAMES;
  return { ...official, places: { ...app, ...official.places } };
}
