import { describe, expect, it } from "vitest";
import { breakBeforeContact, formatStayHours } from "./stay-hours";

describe("breakBeforeContact", () => {
  it("연락처 앞에서 줄을 바꾸고 연락처 이름 뒤에 쌍점을 붙인다(중 · 일은 전각 쌍점)", () => {
    const tel = "054-746-9913";
    expect(breakBeforeContact(`09:00–18:00 · 문의 ${tel}`)).toBe(
      `09:00–18:00\n문의: ${tel}`,
    );
    expect(breakBeforeContact(`09:00–18:00 · Contact ${tel}`)).toBe(
      `09:00–18:00\nContact: ${tel}`,
    );
    expect(breakBeforeContact(`09:00–18:00 · Contacto ${tel}`)).toBe(
      `09:00–18:00\nContacto: ${tel}`,
    );
    expect(breakBeforeContact(`09:00–18:00 · 咨询电话 ${tel}`)).toBe(
      `09:00–18:00\n咨询电话：${tel}`,
    );
    expect(breakBeforeContact(`09:00–18:00 · お問い合わせ ${tel}`)).toBe(
      `09:00–18:00\nお問い合わせ：${tel}`,
    );
  });

  it("연락처가 없으면 그대로", () => {
    for (const raw of [
      "09:00–18:00 · Adults 3,000 KRW · 054-750-8650",
      "Contact for details",
      "",
    ])
      expect(breakBeforeContact(raw)).toBe(raw);
  });
});

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
