import { describe, expect, it } from "vitest";
import { romanize } from "./romanize";

describe("romanize (국어의 로마자 표기법 기본 규칙)", () => {
  it.each([
    ["경복궁", "Gyeongbokgung"],
    ["불국사", "Bulguksa"],
    ["부산", "Busan"],
    ["해운대 해수욕장", "Haeundae Haesuyokjang"],
    // 연음 · 비음화 · 유음화
    ["광안리", "Gwangalli"],
    ["신라", "Silla"],
    ["종로", "Jongno"],
    ["대학로", "Daehangno"],
    ["독립문", "Dongnimmun"],
    ["설날", "Seollal"],
    ["제주 올레길", "Jeju Ollegil"],
  ])("%s → %s", (ko, en) => {
    expect(romanize(ko)).toBe(en);
  });

  it("한글이 아닌 글자는 그대로", () => {
    expect(romanize("스타벅스 DT점")).toBe("Seutabeokseu DTjeom");
    expect(romanize("F1963")).toBe("F1963");
  });
});
