import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";
import zh from "../../../messages/zh.json";
import {
  decodeTrip,
  encodeTrip,
  TRIP_QUESTIONS,
  type TripAnswers,
} from "./trip";

describe("여행 조건 ↔ URL", () => {
  it("조건 → URL → 조건 왕복이 같다", () => {
    const answers: TripAnswers = {
      q10: ["this-month"],
      q11: ["1-night"],
      q12: ["public-transit"],
      q13: ["1-3h"],
      q14: ["pet", "accessible", "indoor-rain"],
    };
    expect(decodeTrip(encodeTrip(answers))).toEqual(answers);
  });

  it("조건 순서대로 한 줄로 만든다 (홈 「지금 인기 코스」 링크 형식)", () => {
    expect(encodeTrip({ q12: ["car"], q11: ["1-night"] })).toBe(
      "q11.1-night~q12.car",
    );
    expect(decodeTrip("q11.2-nights-plus~q12.public-transit")).toEqual({
      q11: ["2-nights-plus"],
      q12: ["public-transit"],
    });
  });

  it("모르는 조건 · 보기는 버리고, 하나만 고르는 조건은 첫 보기만 받는다", () => {
    expect(
      decodeTrip("q1.20s~q11.1-night,day-trip~q12.boat~q14.pet,pet,x~bad"),
    ).toEqual({ q11: ["1-night"], q14: ["pet"] });
  });

  it("빈 값은 빈 조건이다", () => {
    expect(decodeTrip(undefined)).toEqual({});
    expect(decodeTrip("")).toEqual({});
    expect(encodeTrip({})).toBe("");
  });

  it("모든 조건 보기에 5개 언어 문구가 있다", () => {
    for (const messages of [ko, en, zh, ja, es]) {
      const trip = messages.Trip as Record<
        string,
        { options: Record<string, string> }
      >;
      for (const q of TRIP_QUESTIONS) {
        for (const option of q.options) {
          expect(trip[q.id]?.options[option], `${q.id}.${option}`).toBeTruthy();
        }
      }
    }
  });
});
