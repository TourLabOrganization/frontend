// 한글(자모 · 음절)이 들어 있는지. 외국어 화면에 한국어 원문이 새지 않게 거를 때 쓴다(docs/i18n.md)
const HANGUL = /[ㄱ-ㆎ가-힣]/;

export function hasHangul(text: string): boolean {
  return HANGUL.test(text);
}
