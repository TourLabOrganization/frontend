import { describe, expect, it } from "vitest";
import { cleanSource } from "./clean-place-sources.mjs";
import details from "../src/features/planner/data/place-details.json";

describe("좌표 기준 문구 정리", () => {
  it("날짜 · 사용자 요청 · 검증 메모 · 대조 메모를 지우고 출처 종류는 남긴다", () => {
    expect(
      cleanSource(
        "사용자 요청(의령 관광지, 2026-10-04 의령군 문화관광 · 의령9경 검색) · 좌표 수기 입력(주소 기준, 지도 검증 필요, 2026-10-04) · 대략 위치",
      ),
    ).toBe("의령군 문화관광 자료 · 주소 기준 좌표 · 대략 위치");
    expect(
      cleanSource(
        "국가유산 보물 소재지(보물 13건, 2026-10-04 국가유산 기본정보) · 좌표 수기 입력(소재지 주소 기준, 지도 검증 필요, 2026-10-04)",
      ),
    ).toBe("국가유산 보물 소재지(보물 13건) · 주소 기준 좌표");
    expect(
      cleanSource(
        "열린관광지(2019년 선정, 문화체육관광부 · 한국관광공사 발표 보도) · 좌표 수기 입력(지도 검증 필요, 2026-10-04)",
      ),
    ).toBe("열린관광지(2019년 선정) · 주소 기준 좌표");
    expect(
      cleanSource(
        "사용자 요청(2026-10-04) · 좌표 수기 입력(지도 검증 필요, 2026-10-03)",
      ),
    ).toBe("주소 기준 좌표");
    expect(
      cleanSource(
        "보은군 속리산면 사내리 구글 지오코딩 · 2026-10-01 주소 기준으로 좌표 정정(지도 확인 필요)",
      ),
    ).toBe("보은군 속리산면 사내리 구글 지오코딩 · 주소 기준 좌표");
  });

  it("장소 데이터의 좌표 기준에 작업 기록이 남지 않았다", () => {
    const left = Object.entries(
      details as Record<string, { src?: { ko?: string } }>,
    ).filter(([, d]) =>
      /\d{4}-\d{2}-\d{2}|사용자 요청|검증 필요|확인 필요|좌표 수기 입력|노선 표기/.test(
        d.src?.ko ?? "",
      ),
    );
    expect(left.map(([id]) => id)).toEqual([]);
  });
});
