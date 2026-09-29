// 한글 → 로마자(국어의 로마자 표기법 기본 규칙). 한국관광공사 다국어 이름이 없는 신규 관광지 · 글자만인 인기 관광지의 외국어 화면 이름에 쓴다.
// 음절 단위로 옮기고, 받침 뒤 ㅇ(연음) · 비음화(ㄱㄷㅂ + ㄴㅁ) · 유음화(ㄴ + ㄹ, ㄹ + ㄴ) · ㄹㄹ만 다룬다(고유명사 관례 표기는 표로 하지 않는다).
// 단어(공백으로 나뉜 조각)마다 첫 글자를 대문자로 한다. 한글이 아닌 글자는 그대로 둔다.

const INITIAL = [
  "g",
  "kk",
  "n",
  "d",
  "tt",
  "r",
  "m",
  "b",
  "pp",
  "s",
  "ss",
  "",
  "j",
  "jj",
  "ch",
  "k",
  "t",
  "p",
  "h",
];
const MEDIAL = [
  "a",
  "ae",
  "ya",
  "yae",
  "eo",
  "e",
  "yeo",
  "ye",
  "o",
  "wa",
  "wae",
  "oe",
  "yo",
  "u",
  "wo",
  "we",
  "wi",
  "yu",
  "eu",
  "ui",
  "i",
];
// 받침(종성) 대표음. 27개 + 없음
const FINAL = [
  "",
  "k",
  "k",
  "k",
  "n",
  "n",
  "n",
  "t",
  "l",
  "k",
  "m",
  "l",
  "l",
  "l",
  "p",
  "l",
  "m",
  "p",
  "p",
  "t",
  "t",
  "ng",
  "t",
  "t",
  "k",
  "t",
  "p",
  "t",
];
// 연음(뒤 음절이 ㅇ으로 시작)할 때 받침이 넘어가는 소리(초성 로마자). 겹받침은 뒤 자음이 넘어간다
const LIAISON = [
  "",
  "g",
  "kk",
  "ks",
  "n",
  "nj",
  "nh",
  "d",
  "r",
  "lg",
  "lm",
  "lb",
  "ls",
  "lt",
  "lp",
  "lh",
  "m",
  "b",
  "ps",
  "s",
  "ss",
  "",
  "j",
  "ch",
  "k",
  "t",
  "p",
  "h",
];

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

type Syllable = { i: number; m: number; f: number };

function split(ch: string): Syllable | null {
  const code = ch.charCodeAt(0) - HANGUL_START;
  if (code < 0 || code > HANGUL_END - HANGUL_START) return null;
  return {
    i: Math.floor(code / 588),
    m: Math.floor((code % 588) / 28),
    f: code % 28,
  };
}

function romanizeWord(word: string): string {
  const chars = [...word];
  let out = "";
  for (let k = 0; k < chars.length; k++) {
    const s = split(chars[k]);
    if (!s) {
      out += chars[k];
      continue;
    }
    const next = k + 1 < chars.length ? split(chars[k + 1]) : null;
    const prev = k > 0 ? split(chars[k - 1]) : null;
    // 앞 음절 받침이 이 음절로 넘어왔으면 초성 대신 그 소리
    let initial = INITIAL[s.i];
    if (prev && prev.f !== 0) {
      if (s.i === 11 && prev.f !== 21) initial = "";
      else if (s.i === 5 && (prev.f === 8 || prev.f === 4))
        initial = "l"; // ㄹㄹ · ㄴㄹ → ll
      else if (s.i === 5) initial = "n"; // 그 밖의 받침 + ㄹ → ㄴ
    }
    let final = FINAL[s.f];
    if (next && s.f !== 0) {
      if (next.i === 11) final = s.f === 21 ? "ng" : LIAISON[s.f];
      else if (
        next.i === 2 ||
        next.i === 6 ||
        (next.i === 5 && s.f !== 4 && s.f !== 8)
      ) {
        // 비음화: ㄱ → ng, ㄷ → n, ㅂ → m (ㄴ · ㅁ 앞, ㄴ으로 바뀐 ㄹ 앞)
        if (final === "k") final = "ng";
        else if (final === "t") final = "n";
        else if (final === "p") final = "m";
      }
      if (next.i === 5 && (s.f === 8 || s.f === 4)) final = "l"; // ㄹㄹ · ㄴㄹ
      if (next.i === 2 && s.f === 8) final = "l"; // ㄹㄴ → ll
    }
    if (prev && prev.f === 8 && s.i === 2) initial = "l";
    out += initial + MEDIAL[s.m] + final;
  }
  return out;
}

/** 한글 이름 → 로마자. 「경복궁」 → 「Gyeongbokgung」, 「해운대 해수욕장」 → 「Haeundae Haesuyokjang」 */
export function romanize(text: string): string {
  return text
    .split(/(\s+)/)
    .map((w) => {
      const r = romanizeWord(w);
      return /[가-힣]/.test(w) ? r.charAt(0).toUpperCase() + r.slice(1) : r;
    })
    .join("")
    .trim();
}
