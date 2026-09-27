import { describe, expect, it } from "vitest";
import { krUnits } from "./kr-units";

// PoC krUnits에 같은 문구를 넣은 결과(손으로 규칙 순서대로 따라간 값)
describe("krUnits", () => {
  it("한국어 화면 · 한국어 없는 문구는 그대로", () => {
    expect(krUnits("연중무휴", "ko")).toBe("연중무휴");
    expect(krUnits("09:00-18:00", "en")).toBe("09:00-18:00");
  });

  it("휴무 정형 문구", () => {
    expect(krUnits("연중무휴", "en")).toBe("Open all year");
    expect(krUnits("연중무휴", "zh")).toBe("全年无休");
    expect(krUnits("연중무휴", "ja")).toBe("年中無休");
    expect(krUnits("연중무휴", "es")).toBe("Abierto todo el año");
    expect(krUnits("월요일", "en")).toBe("Mon");
    expect(krUnits("스케줄에 따라 유동적", "en")).toBe("varies by schedule");
    // 「당일」은 영어에서 지운다
    expect(krUnits("설날, 추석 당일", "en")).toBe("Seollal, Chuseok");
    expect(krUnits("설날, 추석 당일", "ja")).toBe("旧正月, 秋夕 当日");
  });

  it("규칙 밖의 한국어는 원문으로 남는다", () => {
    expect(krUnits("연중 매일 운영", "en")).toBe("연중 매일 운영");
    expect(krUnits("09:00-16:00 (점심12~13)", "en")).toBe(
      "09:00-16:00 (점심12~13)",
    );
  });

  it("요금(원) · 빈 괄호 정리", () => {
    expect(krUnits("성인 30000원 소인 25000원 (48개월 미만 무료)", "en")).toBe(
      "성인 30000 KRW 소인 25000 KRW (48개월 미만 무료)",
    );
    expect(krUnits("15,000원", "zh")).toBe("15,000韩元");
    expect(krUnits("약 30분", "ja")).toBe("約30分");
    // 「내외」를 지우고 남은 빈 괄호 · 겹친 공백을 정리한다
    expect(krUnits("15,000원 (내외)", "en")).toBe("15,000 KRW");
    // PoC 치환 문자열 「~$10,000」은 $1 뒤에 0,000을 붙인다
    expect(krUnits("2만 원 내외", "en")).toBe("~20,000 KRW");
    expect(krUnits("2만 원 내외", "es")).toBe("~20.000 KRW");
  });
});
