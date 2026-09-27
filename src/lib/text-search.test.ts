import { describe, expect, it } from "vitest";
import { matchesQuery, normalizeText } from "./text-search";

describe("목록 검색", () => {
  it("띄어쓰기 · 대소문자를 무시한다", () => {
    expect(normalizeText(" Bulguk Sa ")).toBe("bulguksa");
    expect(matchesQuery(["불국사", "Bulguksa Temple"], "불 국")).toBe(true);
    expect(matchesQuery(["불국사", "Bulguksa Temple"], "TEMPLE")).toBe(true);
  });

  it("여러 이름 중 하나라도 맞으면 맞고, 비어 있는 이름은 건너뛴다", () => {
    expect(matchesQuery([undefined, null, "경주", "Gyeongju"], "gyeong")).toBe(
      true,
    );
    expect(matchesQuery(["첨성대", undefined], "석굴암")).toBe(false);
  });

  it("검색어가 비어 있거나 띄어쓰기뿐이면 모두 맞는다", () => {
    expect(matchesQuery(["첨성대"], "")).toBe(true);
    expect(matchesQuery(["첨성대"], "   ")).toBe(true);
  });
});
