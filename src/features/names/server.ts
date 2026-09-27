import { EMPTY_NAMES, type NameTable } from "./names";

/**
 * 화면 언어의 이름표. 서버에서만 부른다(언어마다 따로 불러와서 다른 언어 사용자에게 싣지 않는다).
 * 한국어 · 영어는 이름표가 없다(데이터에 ko · en이 들어 있다)
 */
export async function loadNameTable(locale: string): Promise<NameTable> {
  switch (locale) {
    case "zh":
      return (await import("./data/zh.json")).default;
    case "ja":
      return (await import("./data/ja.json")).default;
    case "es":
      return (await import("./data/es.json")).default;
    default:
      return EMPTY_NAMES;
  }
}
