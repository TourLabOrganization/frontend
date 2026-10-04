import { describe, expect, it } from "vitest";
import details from "./data/place-details.json";
import {
  k100Sentence,
  withSentence,
  type PlannerPlaceDetail,
} from "./place-detail";

const DETAILS = details as Record<string, PlannerPlaceDetail>;

describe("한국관광 100선 선정 문장", () => {
  it("한 장소 건은 판만, 묶음 건은 명단 이름도 적는다", () => {
    expect(
      k100Sentence({ edition: "2025~2026", entry: "사유원", places: 1 }, "ko"),
    ).toBe("2025~2026 한국관광 100선 선정지.");
    expect(k100Sentence(DETAILS.kd10.k100!, "ko")).toBe(
      "2025~2026 한국관광 100선 「5대 고궁(경복궁·창덕궁·창경궁·덕수궁·종묘)」 선정지.",
    );
    expect(k100Sentence(DETAILS.kd10.k100!, "ja")).toBe(
      "Selected for the 2025–2026 Korea Tourism 100.",
    );
  });

  it("설명 뒤에 붙이고, 설명이 없으면 문장만", () => {
    expect(withSentence("궁궐. ", "선정지.")).toBe("궁궐. 선정지.");
    expect(withSentence(undefined, "선정지.")).toBe("선정지.");
  });

  it("100선 배지 장소마다 선정 정보가 있다", () => {
    const withInfo = Object.entries(DETAILS).filter(([, d]) => d.k100);
    expect(withInfo).toHaveLength(153);
    for (const [, d] of withInfo) expect(d.k100!.edition).toBe("2025~2026");
  });
});
