import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import ja from "../../messages/ja.json";
import ko from "../../messages/ko.json";
import zh from "../../messages/zh.json";
import { locales } from "./locales";

// 5개 언어 문구 파일의 키 · ICU 인자가 ko.json과 같은지 고정한다 (docs/i18n.md)

type Tree = { [key: string]: string | Tree };

const MESSAGES: Record<string, Tree> = { ko, en, zh, ja, es };

/** 키 경로 → 문구 */
function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** 문구 안의 ICU 인자 이름 ({name} · {count, plural, …}). 복수형 갈래 안의 인자도 센다 */
function argNames(message: string): string[] {
  const names = new Set<string>();
  for (const m of message.matchAll(/\{\s*([A-Za-z_][\w]*)\s*[,}]/g)) {
    names.add(m[1]);
  }
  return [...names].sort();
}

/** 복수형 갈래 이름들 ({count, plural, one {…} other {…}} → [["one", "other"]]) */
function pluralCategories(message: string): string[][] {
  const out: string[][] = [];
  const re = /\{\s*\w+\s*,\s*plural\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message))) {
    let i = m.index + m[0].length;
    let depth = 1;
    const cats: string[] = [];
    let token = "";
    while (i < message.length && depth > 0) {
      const ch = message[i];
      if (ch === "{") {
        if (depth === 1) cats.push(token.trim());
        token = "";
        depth++;
      } else if (ch === "}") {
        depth--;
      } else if (depth === 1) {
        token += ch;
      }
      i++;
    }
    out.push(cats);
  }
  return out;
}

const base = flatten(ko);
const english = flatten(en);

describe("문구 파일 (messages/*.json)", () => {
  it("지원 언어마다 문구 파일이 있다", () => {
    for (const locale of locales)
      expect(MESSAGES[locale], locale).toBeDefined();
    expect([...locales].sort()).toEqual(["en", "es", "ja", "ko", "zh"]);
  });

  for (const [locale, tree] of Object.entries(MESSAGES)) {
    if (locale === "ko") continue;
    const flat = flatten(tree);

    it(`${locale}: 키가 ko.json과 같다`, () => {
      const missing = [...base.keys()].filter((k) => !flat.has(k));
      const extra = [...flat.keys()].filter((k) => !base.has(k));
      expect(missing, `${locale}에 빠진 키`).toEqual([]);
      expect(extra, `${locale}에만 있는 키`).toEqual([]);
    });

    // 인자 집합은 ko.json 또는 en.json 중 하나와 같아야 한다.
    // 언어에 따라 쓰는 인자가 다른 문구가 있다(예: 날짜의 {month} · {monthName}, 한국어뿐인 출처 이름 {source}는 외국어 화면에서 뺀다)
    it(`${locale}: ICU 인자가 ko.json(또는 en.json)과 같고 빈 문구가 없다`, () => {
      for (const [key, message] of base) {
        const translated = flat.get(key);
        if (translated === undefined) continue;
        expect(translated.trim(), `${locale} ${key}`).not.toBe("");
        const got = argNames(translated);
        const allowed = [argNames(message), argNames(english.get(key) ?? "")];
        expect(
          allowed.some((a) => a.join() === got.join()),
          `${locale} ${key}: {${got.join("} {")}}`,
        ).toBe(true);
      }
    });

    // 한국어 화면이 아닌데 한글이 섞이면 번역이 빠진 것이다. en.json에도 한글이 있는 문구(한국어 표기를 일부러 보이는 곳)만 예외
    it(`${locale}: 한글이 섞이지 않았다`, () => {
      const hangul = /[\uAC00-\uD7A3]/;
      const mixed = [...flat].filter(
        ([key, message]) =>
          hangul.test(message) && !hangul.test(english.get(key) ?? ""),
      );
      expect(mixed.map(([key]) => key)).toEqual([]);
    });

    it(`${locale}: 복수형 갈래가 언어 규칙에 맞다`, () => {
      const allowed =
        locale === "zh" || locale === "ja" ? ["other"] : ["one", "other"];
      for (const [key, message] of flat) {
        for (const cats of pluralCategories(message)) {
          const words = cats.filter((c) => !c.startsWith("="));
          expect(words.sort(), `${locale} ${key}`).toEqual(allowed);
        }
      }
    });
  }
});
