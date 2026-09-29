// 투어 플래너 지도의 도시 묶음(원형) 글자 크기(PlannerMap). 테스트하려고 지도 SDK를 import하지 않는 파일에 둔다.

/**
 * 이름 길이(가장 긴 단어)에 따른 이름 · 수 글자 크기. 영어 · 스페인어처럼 긴 이름도 원 안에 다 들어가게
 * 이름 글자를 줄이고 수는 더 작게 한다. 단어가 여럿이면(「Goseong (Gangwon)」) 단어 사이에서만 줄을 바꾼다
 */
export function bubbleText(label: string): { name: string; count: string } {
  const longest = Math.max(...label.split(/\s+/).map((w) => w.length));
  if (longest <= 5)
    return { name: "text-[0.625rem]", count: "text-[0.625rem]" };
  if (longest <= 8) return { name: "text-[0.5625rem]", count: "text-[0.5rem]" };
  return { name: "text-[0.5rem]", count: "text-[0.5rem]" };
}
