import { describe, expect, it } from "vitest";
import themePlaces from "../course/data/places.json";
import tours from "../home/data/citytour.json";
import esNames from "../names/data/es.json";
import jaNames from "../names/data/ja.json";
import zhNames from "../names/data/zh.json";
import type { NameTable } from "../names/names";
import details from "../planner/data/place-details.json";
import plannerPlaces from "../planner/data/places.json";
import tic from "../planner/data/tic.json";
import type { PlannerPlaceDetail } from "../planner/place-detail";
import extras from "../theme/data/extras.json";
import scenes from "../theme/data/scenes.json";
import { placeName } from "../theme/place-meta";
import type { PlaceExtra } from "../theme/theme-data";
import addressesEn from "./data/addresses.en.json";
import namesEn from "./data/names.en.json";
import placeNamesEn from "./data/place-names.en.json";
import phrases from "./data/phrases.json";
import {
  cityTourText,
  hasHangul,
  infoCenterText,
  nameEn,
  phraseText,
  placeDescEn,
  sceneText,
  sourceText,
} from "./text";

// 외국어 화면(en · zh · ja · es)의 데이터 표시 함수 결과에 한글이 없는지, 번역이 원문의 숫자를 그대로 옮겼는지.
// 예외(한글이 남아도 되는 곳): 없음. 언어 메뉴의 「한국어」는 데이터가 아니라 messages(LOCALE_NAMES)라 여기서 보지 않는다.

const LOCALES = ["en", "zh", "ja", "es"] as const;
const NAME_TABLES: Record<(typeof LOCALES)[number], NameTable> = {
  en: { regions: {}, cities: {}, places: {} },
  zh: zhNames,
  ja: jaNames,
  es: esNames,
};
const DETAILS = details as Readonly<Record<string, PlannerPlaceDetail>>;
const EXTRAS = extras as Readonly<
  Record<string, Readonly<Record<string, PlaceExtra>>>
>;
const THEME_PLACES = Object.values(themePlaces).flat();

/** 한글이 든 값만 모은다(실패 메시지에 앞의 몇 개를 보인다) */
function hangulOf(values: Iterable<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const v of values) if (v && hasHangul(v)) out.push(v);
  return out.slice(0, 5);
}

describe.each(LOCALES)(
  "외국어 화면(%s)의 데이터 글에 한글이 없다",
  (locale) => {
    const names = NAME_TABLES[locale];

    it("장소 이름(플래너 · 테마)", () => {
      expect(
        hangulOf(plannerPlaces.map((p) => placeName(p, locale, names))),
      ).toEqual([]);
      expect(
        hangulOf(THEME_PLACES.map((p) => placeName(p, locale, names))),
      ).toEqual([]);
    });

    it("운영시간(플래너 · 테마)", () => {
      expect(
        hangulOf(
          [...plannerPlaces, ...THEME_PLACES].map((p) =>
            phraseText(p.hrs, locale),
          ),
        ),
      ).toEqual([]);
    });

    it("장소 설명(플래너 · 테마): 한국어뿐인 설명은 틀 번역, 영어가 있으면 영어", () => {
      const shown = [
        ...Object.values(DETAILS),
        ...Object.values(EXTRAS).flatMap((t) => Object.values(t)),
      ].map((d) =>
        d.desc?.en ? d.desc.en : d.desc?.ko ? placeDescEn(d.desc.ko) : null,
      );
      const missing = [
        ...Object.values(DETAILS),
        ...Object.values(EXTRAS).flatMap((t) => Object.values(t)),
      ].filter((d) => d.desc?.ko && !d.desc.en && !placeDescEn(d.desc.ko));
      expect(missing.map((d) => d.desc?.ko).slice(0, 5)).toEqual([]);
      expect(hangulOf(shown)).toEqual([]);
    });

    it("좌표 기준(플래너 · 테마)", () => {
      const srcs = [
        ...Object.values(DETAILS),
        ...Object.values(EXTRAS).flatMap((t) => Object.values(t)),
      ].map((d) => sourceText(d.src, locale));
      expect(hangulOf(srcs)).toEqual([]);
    });

    it("시티투어(노선명 · 경로 · 탑승지 · 요금)", () => {
      const texts = tours.map((t) => cityTourText(t, locale)!);
      expect(
        hangulOf(texts.flatMap((t) => [t.name, t.route, t.board, t.fare])),
      ).toEqual([]);
    });

    it("관광안내소(이름 · 주소 · 운영 · 휴무)", () => {
      const texts = tic.map((c) => infoCenterText(c, locale)!);
      expect(
        hangulOf(texts.flatMap((t) => [t.name, t.addr, t.hours, t.closed])),
      ).toEqual([]);
    });

    it("장면(영화 탭 장면 제목 · 장소 장면 제목 · 영상 제목)", () => {
      const film = Object.values(scenes)
        .flat()
        .flatMap((s) => ("title" in s ? [sceneText(s.title, locale)] : []));
      const sceneTitles = Object.values(EXTRAS)
        .flatMap((t) => Object.values(t))
        .flatMap((e) =>
          e.sceneTitle ? [sceneText(e.sceneTitle, locale)] : [],
        );
      expect(hangulOf([...film, ...sceneTitles])).toEqual([]);
    });
  },
);

describe("한국어 화면은 원문 그대로", () => {
  it("운영시간 · 좌표 기준 · 장면 · 시티투어 · 관광안내소", () => {
    expect(phraseText("상시 개방 · 무료", "ko")).toBe("상시 개방 · 무료");
    expect(sourceText({ ko: "카카오 좌표", en: "Kakao" }, "ko")).toBe(
      "카카오 좌표",
    );
    expect(sceneText("물길", "ko")).toBe("물길");
    expect(cityTourText(tours[0], "ko")).toBeUndefined();
    expect(infoCenterText(tic[0], "ko")).toBeUndefined();
  });
});

describe("좌표 기준에서 한국어 주소를 뺀다", () => {
  it("출처 종류만 남기고, 남는 것이 없으면 줄을 숨긴다", () => {
    expect(
      sourceText(
        {
          ko: "경북 경주시 엑스포로 45 · 한국관광공사 연관 관광지(숙박) · 카카오 좌표",
        },
        "en",
      ),
    ).toBe("KTO related attractions (lodging) · Kakao coordinates");
    expect(
      sourceText(
        {
          ko: "중구 큰장로26길 45 구글 지오코딩",
          en: "Google geocoding: 중구 큰장로26길 45",
        },
        "ja",
      ),
    ).toBe("Googleジオコーディング");
    expect(sourceText({ ko: "경북 경주시 엑스포로 45" }, "en")).toBeUndefined();
    expect(
      sourceText(
        { ko: "공식 관광정보 좌표", en: "Official tourism coordinates" },
        "es",
      ),
    ).toBe("Official tourism coordinates");
  });
});

describe("설명 틀 번역", () => {
  it("분류 · 장소 이름 · 연관 횟수를 옮긴다", () => {
    const ko = DETAILS.ro465?.desc?.ko ?? "";
    expect(ko).toMatch(/등과 함께 많이 찾는 곳 \(연관 \d+회\)$/);
    const en = placeDescEn(ko)!;
    expect(en).toMatch(
      /^Korean Food · Often visited together with .+, etc\. \(linked \d+ times\)$/,
    );
  });
});

// ── 숫자 열: 번역이 원문의 숫자를 그대로 옮겼는지 ─────────────────────────
// 한국어의 천 · 만 단위(5천원 = 5,000)와 서수(둘째 = 2nd), 달 이름(Jul = 7)은 같은 숫자로 본다.

const ORD: Record<string, number> = {
  첫째: 1,
  둘째: 2,
  셋째: 3,
  넷째: 4,
  다섯째: 5,
};
const MONTHS: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Sept: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
  ene: 1,
  feb: 2,
  abr: 4,
  jun: 6,
  jul: 7,
  ago: 8,
  sept: 9,
  oct: 10,
  nov: 11,
  dic: 12,
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function numbersOfSource(s: string): string {
  const t = s
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/(\d+)만\s*(\d+)천/g, (_, a, b) => String(+a * 10000 + +b * 1000))
    .replace(/(\d+(?:\.\d+)?)만/g, (_, a) => String(Math.round(+a * 10000)))
    .replace(/(\d+(?:\.\d+)?)천/g, (_, a) => String(Math.round(+a * 1000)))
    .replace(/첫째|둘째|셋째|넷째|다섯째/g, (m) => ` ${ORD[m]} `);
  return (t.match(/\d+/g) ?? [])
    .map(Number)
    .sort((a, b) => a - b)
    .join(",");
}

function numbersOfTranslation(s: string): string {
  const t = s
    .replace(/(\d)[,.](?=\d{3}\b)/g, "$1")
    .replace(/(\d+(?:\.\d+)?)万/g, (_, a) => String(Math.round(+a * 10000)))
    .replace(/(\d+)(?:st|nd|rd|th|º|ª|er|°)\b/g, "$1")
    .replace(/\b([A-Za-z]+)\b/g, (w) =>
      Object.hasOwn(MONTHS, w) ? ` ${MONTHS[w]} ` : w,
    );
  return (t.match(/\d+/g) ?? [])
    .map(Number)
    .sort((a, b) => a - b)
    .join(",");
}

describe("번역의 숫자 열이 원문과 같다", () => {
  const byId = new Map(plannerPlaces.map((p) => [p.id, p]));

  it("장소 이름 표(place-names.en.json)", () => {
    const bad = Object.entries(placeNamesEn as Record<string, string>).filter(
      ([id, en]) =>
        numbersOfSource(byId.get(id)!.ko) !== numbersOfTranslation(en),
    );
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it("이름 표 · 주소 표(names.en.json · addresses.en.json)", () => {
    const bad = Object.entries({
      ...(namesEn as Record<string, string>),
      ...(addressesEn as Record<string, string>),
    }).filter(([ko, en]) => numbersOfSource(ko) !== numbersOfTranslation(en));
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it("짧은 정형 문구 표(phrases.json, 4개 언어)", () => {
    const bad = Object.entries(
      phrases as Record<string, Record<string, string>>,
    ).flatMap(([ko, byLang]) =>
      LOCALES.filter(
        (l) => numbersOfSource(ko) !== numbersOfTranslation(byLang[l]),
      ).map((l) => [ko, l, byLang[l]]),
    );
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it("장소 이름 표의 장소는 places.json에 영어 이름으로 채워져 있다(scripts/place-names.mjs)", () => {
    for (const [id, en] of Object.entries(
      placeNamesEn as Record<string, string>,
    ))
      expect(byId.get(id)?.en).toBe(en);
    expect(nameEn(byId.get("gj1")!.ko)).toBe(byId.get("gj1")!.en);
  });
});
