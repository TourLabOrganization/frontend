import type { AccessMode } from "../course/schedule";
import wideData from "./data/wide.json";

// 지하철(도시철도) 출발 · 귀가역. 수도권 전철역(PoC METRO_STATIONS 262역)과 부산 도시철도역(PoC BUSAN_STATIONS 46역).
// data/wide.json은 scripts/build-wide.mjs가 Tour Planner.dc.html에서 만든다. 손으로 고치지 않는다.
//
//  - 호선 고르기(PoC metroLineOptions): 수도권 역의 호선을 PoC order 순서로, order에 없는 호선은 뒤에.
//    PoC는 수도권 역만 고르게 하고 부산 역은 역 이름 검색(카카오 REST 키 필요)으로만 더한다. 검색을 만들지 않아
//    부산 호선(BUSAN_LINE_LABEL)을 수도권 호선 뒤에 붙였다
//  - 역 이름 순서(PoC metroOriginOptions): 화면 언어 이름의 Intl.Collator 순서(한국어는 ko, 그 밖은 en)
//  - 역을 고른 값은 PoC처럼 역의 한국어 이름(ko)이다. 수도권 · 부산에 같은 이름(「중앙」)이 있어서
//    찾을 때는 고른 호선의 역 목록을 먼저 본다(PoC metroOrg는 수도권을 먼저 본다)

export type Station = {
  ko: string;
  en: string;
  lines: string[];
  lat: number;
  lng: number;
};

export const METRO_STATIONS = wideData.metroStations as readonly Station[];
export const BUSAN_STATIONS = wideData.busanStations as readonly Station[];

const LINE_ORDER: readonly string[] = wideData.metroLineOrder;
const METRO_LINE_NAME = wideData.metroLineName as Readonly<
  Record<string, Readonly<Record<string, string>>>
>;
const BUSAN_LINE_LABEL = wideData.busanLineLabel as Readonly<
  Record<"ko" | "en", Readonly<Record<string, string>>>
>;
const LINE_COLOR: Readonly<Record<string, string>> = {
  ...wideData.metroLineColor,
  ...wideData.busanLineColor,
};

/** 부산 도시철도 호선(B1 · B2 · B3 · B4 · G · D)인지. 저장값이 「constructor」여도 참이 되지 않게 Object.hasOwn */
export function isBusanLine(line: string): boolean {
  return Object.hasOwn(BUSAN_LINE_LABEL.ko, line);
}

/** 고를 수 있는 호선. 수도권(PoC order 순서, 없는 호선은 뒤) → 부산(BUSAN_LINE_LABEL 순서) */
export function metroLines(): string[] {
  const set = new Set<string>();
  for (const s of METRO_STATIONS) for (const l of s.lines) set.add(l);
  const rank = (l: string) => {
    const i = LINE_ORDER.indexOf(l);
    return i < 0 ? 99 : i;
  };
  const seoul = [...set].sort((a, b) => rank(a) - rank(b));
  return [...seoul, ...Object.keys(BUSAN_LINE_LABEL.ko)];
}

/** 호선 색(PoC METRO_LINE_COLOR · BUSAN_LINE_COLOR). 없으면 null */
export function lineColor(line: string): string | null {
  return LINE_COLOR[line] ?? null;
}

/** 이름 있는 노선의 그 언어 표기(PoC METRO_LINE_NAME, 없으면 영어). 없는 노선은 null */
export function namedLineLabel(line: string, locale: string): string | null {
  const n = METRO_LINE_NAME[line];
  return n ? n[locale] || n.en : null;
}

/** 부산 호선 이름(PoC BUSAN_LINE_LABEL). 한국어 밖은 영어(중 · 일 · 스페인어 값이 PoC에 없다) */
export function busanLineLabel(line: string, locale: string): string {
  return (locale === "ko" ? BUSAN_LINE_LABEL.ko : BUSAN_LINE_LABEL.en)[line];
}

/** 그 호선의 역(호선이 비면 수도권 전체, PoC처럼). 화면 언어 이름 순서 */
export function lineStations(line: string, locale: string): Station[] {
  const list = isBusanLine(line)
    ? BUSAN_STATIONS.filter((s) => s.lines.includes(line))
    : METRO_STATIONS.filter((s) => !line || s.lines.includes(line));
  const coll = new Intl.Collator(locale === "ko" ? "ko" : "en");
  const name = (s: Station) => (locale === "ko" ? s.ko : s.en || s.ko);
  return list.sort((a, b) => coll.compare(name(a), name(b)));
}

/** 화면에 보이는 역 이름(PoC: 한국어는 끝에 「역」을 붙인다) */
export function stationLabel(s: Station, locale: string): string {
  if (locale !== "ko") return s.en || s.ko;
  return /역$/.test(s.ko) ? s.ko : `${s.ko}역`;
}

/** 역 이름(ko)으로 역을 찾는다. 고른 호선이 부산 호선이면 부산 역을 먼저 본다 */
export function findStation(name: string, line = ""): Station | null {
  if (!name) return null;
  const lists = isBusanLine(line)
    ? [BUSAN_STATIONS, METRO_STATIONS]
    : [METRO_STATIONS, BUSAN_STATIONS];
  for (const list of lists) {
    const s = list.find((x) => x.ko === name);
    if (s) return s;
  }
  return null;
}

/**
 * 체인 출발점으로 쓰는 역(PoC metroOrg, 수단은 metro). 이름은 stationLabel과 같게 「역」을 붙인다
 * (PoC는 늘 붙여서 「서울역역」이 된다)
 */
export function stationPoint(s: Station): {
  ko: string;
  en: string;
  lat: number;
  lng: number;
  modes: AccessMode[];
} {
  return {
    ko: stationLabel(s, "ko"),
    en: s.en || s.ko,
    lat: s.lat,
    lng: s.lng,
    modes: ["metro"],
  };
}
