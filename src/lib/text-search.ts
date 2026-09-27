// 목록 검색에 쓰는 글자 맞추기. 띄어쓰기 · 대소문자를 무시하고, 여러 이름(한국어 · 영어 · 도시) 중 하나라도 검색어를 품으면 맞는다
export function normalizeText(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/\s+/g, "");
}

/** 검색어가 비어 있으면 모두 맞는다 */
export function matchesQuery(
  texts: readonly (string | null | undefined)[],
  query: string,
): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return texts.some((text) => !!text && normalizeText(text).includes(q));
}
