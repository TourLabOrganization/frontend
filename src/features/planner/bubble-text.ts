// 투어 플래너 지도의 도시 묶음(원형) 글자 크기(PlannerMap). 테스트하려고 지도 SDK를 import하지 않는 파일에 둔다.

/**
 * 이름 길이(가장 긴 단어)에 따른 이름 · 수 글자 크기. 원 지름은 모두 같고(3.5rem), 영어 · 스페인어처럼 긴 이름도 원 안에 다 들어가게
 * 글자를 줄인다. 단어가 여럿이면(「Goseong (Gangwon)」 · 「Paju (DMZ)」) 줄이 늘어 한 단계 더 작게 하고, 단어 사이에서만 줄을 바꾼다.
 * 한국어 · 영어 · 스페인어 · 일본어 · 중국어 도시 이름이 원 안에 들어가는지 브라우저로 쟀다(가장 긴 영어 11글자 · 스페인어 「Área Metropolitana」)
 */
export function bubbleText(label: string): { name: string; count: string } {
  let longest = Math.max(...label.split(/\s+/).map((w) => w.length));
  if (/\s/.test(label.trim())) longest = Math.max(longest, 6);
  if (longest <= 5)
    return { name: "text-[0.625rem]", count: "text-[0.5625rem]" };
  if (longest <= 8)
    return { name: "text-[0.53125rem]", count: "text-[0.53125rem]" };
  if (longest <= 11)
    return { name: "text-[0.4375rem]", count: "text-[0.4375rem]" };
  return { name: "text-[0.40625rem]", count: "text-[0.40625rem]" };
}
