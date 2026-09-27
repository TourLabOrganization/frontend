import themePlaces from "../course/data/places.json";
import { type CityTour, tourFare } from "../home/citytour";
import plannerPlaces from "../planner/data/places.json";
import type { InfoCenter } from "../planner/tic";
import { workTitle } from "../theme/work-titles";
import { krUnits } from "../../lib/kr-units";
import addressesEn from "./data/addresses.en.json";
import categoriesEn from "./data/categories.en.json";
import namesEn from "./data/names.en.json";
import phrases from "./data/phrases.json";
import scenesEn from "./data/scenes.en.json";
import sources from "./data/sources.json";

// 외국어 화면에서 한국어뿐인 데이터 문구를 그 언어로 옮기는 조회 함수. 번역 표(data/*.json)는 앱이 만든 비공식 번역이다(docs/i18n.md).
// 표가 크고(설명 틀 · 운영시간 · 좌표 기준 · 시티투어 · 관광안내소) 화면마다 일부만 쓰므로 **서버에서만** 부른다:
// 서버 컴포넌트 · Route Handler가 옮긴 글을 만들어 클라이언트 컴포넌트에 넘긴다. 클라이언트 컴포넌트가 이 파일에 닿지 않는지는
// translations/bundle.test.ts가 확인한다.
// 언어 규칙(docs/i18n.md): 이름 · 설명 · 정류장 · 주소 같은 긴 데이터는 영어 번역만 있고 중 · 일 · 스페인어도 영어를 쓴다.
// 운영시간 · 요금 · 휴무 · 좌표 기준 종류처럼 짧은 정형 문구는 4개 언어 표(phrases.json · sources.json), 표에 없으면 krUnits.
// 한국어 화면은 늘 원문이다.

export type DataLocale = "en" | "zh" | "ja" | "es";
type Localized = Readonly<Record<DataLocale, string>>;

const HANGUL = /[ㄱ-ㆎ가-힣]/;

/** 한글이 들어 있는지 */
export function hasHangul(text: string): boolean {
  return HANGUL.test(text);
}

const PHRASES = phrases as Readonly<Record<string, Localized>>;
const SOURCES = sources as Readonly<Record<string, Localized>>;
const NAMES = namesEn as Readonly<Record<string, string>>;
const CATEGORIES = categoriesEn as Readonly<Record<string, string>>;
const ADDRESSES = addressesEn as Readonly<Record<string, string>>;
const SCENES = scenesEn as Readonly<Record<string, string>>;

function dataLocale(locale: string): DataLocale | null {
  return locale === "en" ||
    locale === "zh" ||
    locale === "ja" ||
    locale === "es"
    ? locale
    : null;
}

/** 한국어 장소 이름 → 영어 이름. 플래너 장소(places.json en, 앱 번역 포함) → 테마 장소. 같은 이름은 먼저 나온 값 */
const PLACE_EN: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  const add = (ko: string, en: string) => {
    if (en && !hasHangul(en) && !map.has(ko)) map.set(ko, en);
  };
  for (const p of plannerPlaces) add(p.ko, p.en);
  for (const list of Object.values(themePlaces))
    for (const p of list) add(p.ko, p.en);
  return map;
})();

/**
 * 고유명사(장소 · 정류장 · 탑승지 · 시티투어 노선 · 관광안내소 이름)의 영어. 한글이 없으면 그대로.
 * 플래너 · 테마 장소와 이름이 같으면 그 영어 이름(정류장이 플래너 장소와 같으면 같은 이름으로 보이게), 아니면 이름 표. 없으면 null
 */
export function nameEn(ko: string): string | null {
  const s = ko.trim();
  if (!hasHangul(s)) return s;
  return PLACE_EN.get(s) ?? NAMES[s] ?? null;
}

/**
 * 짧은 정형 문구(운영시간 · 요금 · 휴무)를 화면 언어로. 한국어 화면이나 한글이 없는 문구는 그대로.
 * 4개 언어 표(phrases.json)에 있으면 그 값, 없으면 PoC KR_UNIT 치환(krUnits)
 */
export function phraseText(ko: string, locale: string): string {
  const lang = dataLocale(locale);
  if (!lang || !hasHangul(ko)) return ko;
  return (
    PHRASES[ko]?.[lang] ?? PHRASES[ko.trim()]?.[lang] ?? krUnits(ko, locale)
  );
}

// 한국관광공사 연관 관광지 · 시티투어 경유지로 더한 장소의 설명 틀(data-server 문장)
const DESC_WITH = /^(.+?) · (.+?) 등과 함께 많이 찾는 곳 \(연관 (\d+)회\)$/;
const DESC_STAY =
  /^(.+?) · (.+?) 등을 찾은 여행자들이 함께 많이 머문 곳 \(연관 (\d+)회\)$/;
const DESC_TOUR = /^(.+?) · (.+) 시티투어 경유지$/;

function namesEnList(list: string): string | null {
  const out = list.split(", ").map(nameEn);
  return out.every((n): n is string => n !== null) ? out.join(", ") : null;
}

/**
 * 한국어뿐인 장소 설명(틀 문장)의 영어. 틀은 틀로 옮기고, 그 안의 장소 이름은 nameEn, 분류 이름은 categories.en.json.
 * 틀이 아니거나 모르는 이름 · 분류가 있으면 null(원문을 보이지 않고 설명을 뺀다)
 */
export function placeDescEn(ko: string): string | null {
  let m = DESC_WITH.exec(ko);
  if (m) {
    const cat = CATEGORIES[m[1]];
    const with_ = namesEnList(m[2]);
    return cat && with_
      ? `${cat} · Often visited together with ${with_}, etc. (linked ${m[3]} times)`
      : null;
  }
  m = DESC_STAY.exec(ko);
  if (m) {
    const cat = CATEGORIES[m[1]];
    const with_ = namesEnList(m[2]);
    return cat && with_
      ? `${cat} · Where travelers visiting ${with_}, etc. often stay (linked ${m[3]} times)`
      : null;
  }
  m = DESC_TOUR.exec(ko);
  if (m) {
    const cat = CATEGORIES[m[1]];
    const course = nameEn(m[2]);
    return cat && course ? `${cat} · City tour stop (${course})` : null;
  }
  return null;
}

/** 「Google geocoding: 중구 큰장로26길 45」처럼 영어 머리말 뒤에 한국어 주소가 붙은 조각 */
const PREFIXED = /^([^:ㄱ-ㆎ가-힣]+):\s*(.*)$/;

/**
 * 좌표 기준(PoC srcKo · srcEn)을 화면 언어로. 한국어 화면은 원문(한국어 → 영어).
 * 외국어 화면은 영어 원문(없으면 한국어)을 「 · 」 조각으로 나눠, 출처 종류 문구(sources.json)는 그 언어로 옮기고
 * 한글이 없는 조각은 그대로 두고, 한국어 주소 조각은 뺀다(위도 · 경도 · 카카오맵 줄이 따로 있다).
 * 남는 것이 없으면 undefined(그 줄을 숨긴다)
 */
export function sourceText(
  src: { ko?: string; en?: string } | undefined,
  locale: string,
): string | undefined {
  if (!src) return undefined;
  const lang = dataLocale(locale);
  if (!lang) return src.ko ?? src.en;
  const raw = src.en ?? src.ko;
  if (!raw) return undefined;
  const parts: string[] = [];
  for (const seg of raw.split(" · ").map((s) => s.trim())) {
    if (!seg) continue;
    const kind = SOURCES[seg];
    if (kind) {
      parts.push(kind[lang]);
      continue;
    }
    if (!hasHangul(seg)) {
      parts.push(seg);
      continue;
    }
    const m = PREFIXED.exec(seg);
    const prefix = m && SOURCES[m[1].trim()];
    if (prefix) parts.push(prefix[lang]);
    else if (m && !hasHangul(m[1])) parts.push(m[1].trim());
    // 그 밖(한국어 주소)은 뺀다
  }
  const text = [...new Set(parts)].join(" · ");
  return text || undefined;
}

/**
 * 장면 제목(영화 탭 장면 짧은 제목 · 장소의 장면 제목 · RESCENE 영상 제목)을 화면 언어로.
 * 작품명이면 work-titles.ts(그 언어 공식 제목), 아니면 영어 번역(scenes.en.json). 표에 없으면 원문
 */
export function sceneText(ko: string, locale: string): string {
  if (!dataLocale(locale) || !hasHangul(ko)) return ko;
  const work = workTitle(ko, locale);
  if (work !== ko && !hasHangul(work)) return work;
  return SCENES[ko] ?? ko;
}

/** 시티투어 카드에 보이는 글(화면 언어) */
export type CityTourText = {
  name: string;
  /** 경유지를 「 → 」로 이은 글 */
  route: string;
  board: string;
  /** 요금(tourFare가 null이면 null) */
  fare: string | null;
};

/** 시티투어 노선의 표시 글. 한국어 화면이면 undefined(카드가 원문을 쓴다) */
export function cityTourText(
  tour: Pick<CityTour, "name" | "route" | "board" | "fare">,
  locale: string,
): CityTourText | undefined {
  if (!dataLocale(locale)) return undefined;
  const fare = tourFare(tour);
  return {
    name: nameEn(tour.name) ?? tour.name,
    route: tour.route
      .split(/\s*→\s*/)
      .map((s) => nameEn(s) ?? s)
      .join(" → "),
    board: tour.board && (nameEn(tour.board) ?? tour.board),
    fare: fare && phraseText(fare, locale),
  };
}

/** 관광안내소 카드에 보이는 글(화면 언어) */
export type InfoCenterText = {
  name: string;
  addr: string;
  hours: string;
  closed: string;
};

/** 관광안내소의 표시 글. 한국어 화면이면 undefined(카드가 원문을 쓴다) */
export function infoCenterText(
  c: Pick<InfoCenter, "name" | "addr" | "hours" | "closed">,
  locale: string,
): InfoCenterText | undefined {
  if (!dataLocale(locale)) return undefined;
  return {
    name: nameEn(c.name) ?? c.name,
    addr: hasHangul(c.addr) ? (ADDRESSES[c.addr] ?? c.addr) : c.addr,
    hours: phraseText(c.hours, locale),
    closed: phraseText(c.closed, locale),
  };
}
