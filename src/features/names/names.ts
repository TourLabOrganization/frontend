// 중 · 일 · 스페인어 화면의 데이터 이름(권역 · 도시 · 장소). 데이터 파일을 import하지 않아 클라이언트 컴포넌트에서도 가볍게 쓴다.
// 이름표(data/<언어>.json)는 그 언어 화면일 때만 서버가 불러와(server.ts) NamesProvider로 내려 준다.
// 떨어짐 규칙: 그 언어 공식 명칭 → 앱이 옮긴 이름(translations/data/place-names.<언어>.json) → 영어 → 한국어. 한국어 화면은 늘 한국어
// 공식 명칭표는 scripts/build-names.mjs가 만든다. 손으로 고치지 않는다. 두 표는 server.ts loadNameTable이 합친다.

export type NameTable = {
  /** 권역 key → 이름 (Tour Planner.dc.html REG) */
  regions: Readonly<Record<string, string>>;
  /** 한국어 도시 이름 → 이름 (CITY_NAME · I18N.locs) */
  cities: Readonly<Record<string, string>>;
  /** 장소 id → 공식 명칭 (파생 데이터/장소.csv 장소명(중문) · 장소명(일문)) */
  places: Readonly<Record<string, string>>;
};

export const EMPTY_NAMES: NameTable = { regions: {}, cities: {}, places: {} };

/** 이름표가 따로 있는 언어 */
export const NAME_TABLE_LOCALES = ["zh", "ja", "es"] as const;
