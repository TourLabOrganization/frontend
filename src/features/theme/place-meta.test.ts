import { describe, expect, it } from "vitest";
import { directionsUrl } from "./place-meta";

describe("directionsUrl", () => {
  it("카카오맵 길찾기 형식 (이름,위도,경도)", () => {
    expect(directionsUrl({ lat: 37.5796, lng: 126.977 }, "경복궁")).toBe(
      `https://map.kakao.com/link/to/${encodeURIComponent("경복궁")},37.5796,126.977`,
    );
  });

  it("이름의 쉼표는 공백으로 바꾸고 인코딩한다", () => {
    expect(directionsUrl({ lat: 35.8, lng: 129.2 }, "Bulguksa, Gyeongju")).toBe(
      "https://map.kakao.com/link/to/Bulguksa%20%20Gyeongju,35.8,129.2",
    );
  });
});
