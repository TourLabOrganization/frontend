import { describe, expect, it } from "vitest";
import { formatStayHours } from "./stay-hours";

const label = {
  checkIn: (time: string) => `체크인 ${time}`,
  checkOut: (time: string) => `체크아웃 ${time}`,
};

describe("formatStayHours", () => {
  it("「15:00 IN / 11:00 OUT」을 체크인 · 체크아웃 문구로 바꾼다", () => {
    expect(formatStayHours("15:00 IN / 11:00 OUT", label)).toBe(
      "체크인 15:00 · 체크아웃 11:00",
    );
  });

  it("띄어쓰기 · 대소문자가 달라도 같은 꼴이면 바꾼다", () => {
    expect(formatStayHours("9:00in/11:30 out", label)).toBe(
      "체크인 9:00 · 체크아웃 11:30",
    );
  });

  it("IN/OUT 꼴이 아니면 원문 그대로", () => {
    for (const raw of [
      "체크인 15:00 · 054-745-7788",
      "09:00–18:00",
      "예약제 · 유료",
      "",
    ])
      expect(formatStayHours(raw, label)).toBe(raw);
  });
});
