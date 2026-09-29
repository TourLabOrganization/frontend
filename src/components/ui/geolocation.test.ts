import { describe, expect, it } from "vitest";
import { accuracyRadius, canLocate, locateFailure } from "./geolocation";

describe("accuracyRadius", () => {
  it("정확도가 없으면 120m", () => {
    expect(accuracyRadius(null)).toBe(120);
    expect(accuracyRadius(undefined)).toBe(120);
    expect(accuracyRadius(0)).toBe(120);
  });

  it("60m ~ 3km로 자른다", () => {
    expect(accuracyRadius(10)).toBe(60);
    expect(accuracyRadius(500)).toBe(500);
    expect(accuracyRadius(9000)).toBe(3000);
  });
});

describe("locateFailure", () => {
  it("권한 거부와 나머지를 나눈다", () => {
    expect(locateFailure(1)).toBe("denied");
    expect(locateFailure(2)).toBe("unavailable");
    expect(locateFailure(3)).toBe("unavailable");
  });
});

describe("canLocate", () => {
  it("HTTPS(보안 컨텍스트)이고 위치 기능이 있을 때만", () => {
    expect(canLocate({ isSecureContext: true, hasGeolocation: true })).toBe(
      true,
    );
    expect(canLocate({ isSecureContext: false, hasGeolocation: true })).toBe(
      false,
    );
    expect(canLocate({ isSecureContext: true, hasGeolocation: false })).toBe(
      false,
    );
  });
});
