import { describe, expect, it } from "vitest";
import {
  airKoreaUrl,
  airPath,
  nearestSido,
  parseAirQuery,
  pm10Grade,
  pm25Grade,
  SIDO_CENTERS,
  sidoOf,
  toAirQuality,
} from "./air-quality";

const ok = (items: unknown) => ({
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL_CODE" },
    body: { totalCount: 3, items, pageNo: 1, numOfRows: 200 },
  },
});

describe("nearestSido (PoC nearestSido)", () => {
  it("시도청 좌표는 그 시도다", () => {
    for (const [name, lat, lng] of SIDO_CENTERS)
      expect(nearestSido(lat, lng)).toBe(name);
  });

  it("관광지 좌표 → 가장 가까운 시도청의 시도", () => {
    expect(nearestSido(37.5796, 126.977)).toBe("서울"); // 경복궁
    expect(nearestSido(35.1587, 129.1604)).toBe("부산"); // 해운대
    expect(nearestSido(33.2465, 126.5641)).toBe("제주"); // 서귀포 천지연
    expect(nearestSido(37.7519, 128.8761)).toBe("강원"); // 강릉
    // 가장 가까운 시도청만 보면 경주는 울산이 된다 → 시군구 코드가 있으면 코드를 쓴다(sidoOf)
    expect(nearestSido(35.8349, 129.2192)).toBe("울산");
  });

  it("sidoOf: 시군구 코드 앞 2자리가 먼저, 12(광주 · 전남)는 가까운 쪽, 없으면 가까운 시도청", () => {
    expect(sidoOf("47130", 35.8349, 129.2192)).toBe("경북"); // 경주
    expect(sidoOf("51150", 37.7519, 128.8761)).toBe("강원"); // 강릉(새 코드)
    expect(sidoOf("42150", 37.7519, 128.8761)).toBe("강원"); // 옛 코드
    expect(sidoOf("52111", 35.8, 127.1)).toBe("전북");
    expect(sidoOf("12110", 35.15, 126.85)).toBe("광주");
    expect(sidoOf("12130", 34.76, 127.66)).toBe("전남"); // 여수
    expect(sidoOf("", 35.8349, 129.2192)).toBe("울산");
    expect(sidoOf("99999", 37.5665, 126.978)).toBe("서울");
  });
});

describe("등급 (환경부 통합 기준, PoC g10 · g25)", () => {
  it("PM10: 30 · 80 · 150 이하", () => {
    expect([0, 30, 31, 80, 81, 150, 151].map(pm10Grade)).toEqual([
      1, 1, 2, 2, 3, 3, 4,
    ]);
    expect(pm10Grade(null)).toBe(0);
  });
  it("PM2.5: 15 · 35 · 75 이하", () => {
    expect([15, 16, 35, 36, 75, 76].map(pm25Grade)).toEqual([1, 2, 2, 3, 3, 4]);
  });
});

describe("toAirQuality (시도 측정소 평균)", () => {
  it("빈 값 · 「-」는 빼고 평균을 반올림한다. 등급은 둘 중 나쁜 쪽", () => {
    const body = ok([
      {
        stationName: "중구",
        pm10Value: "20",
        pm25Value: "10",
        dataTime: "2026-09-29 14:00",
      },
      { stationName: "종로구", pm10Value: "25", pm25Value: "-" },
      { stationName: "용산구", pm10Value: "", pm25Value: "19" },
    ]);
    expect(toAirQuality(body, "서울")).toEqual({
      sido: "서울",
      pm10: 23, // (20 + 25) / 2 = 22.5
      pm25: 15, // (10 + 19) / 2 = 14.5
      grade: 1,
      stations: 3,
      at: "2026-09-29 14:00",
    });
    expect(
      toAirQuality(ok([{ pm10Value: "40", pm25Value: "40" }]), "부산")?.grade,
    ).toBe(3);
  });

  it("값이 하나도 없거나 resultCode가 00이 아니거나 모양이 다르면 null", () => {
    expect(
      toAirQuality(ok([{ pm10Value: "-", pm25Value: "" }]), "서울"),
    ).toBeNull();
    expect(toAirQuality(ok([]), "서울")).toBeNull();
    expect(
      toAirQuality(
        { response: { header: { resultCode: "30" }, body: {} } },
        "서울",
      ),
    ).toBeNull();
    expect(toAirQuality("<OpenAPI_ServiceResponse/>", "서울")).toBeNull();
    expect(toAirQuality(null, "서울")).toBeNull();
  });
});

describe("쿼리 · 주소", () => {
  it("한국 범위 밖 · 숫자 아님은 null, 통과하면 소수 2자리", () => {
    expect(parseAirQuery("37.57961", "126.97704")).toEqual({
      lat: 37.58,
      lng: 126.98,
    });
    expect(parseAirQuery("40.7", "-74")).toBeNull();
    expect(parseAirQuery("abc", "126")).toBeNull();
    expect(parseAirQuery(null, "126")).toBeNull();
  });

  it("에어코리아 주소는 고정 호스트에 시도 이름만 쿼리로 넘긴다", () => {
    const url = new URL(airKoreaUrl("KEY", "제주"));
    expect(url.origin + url.pathname).toBe(
      "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty",
    );
    expect(url.searchParams.get("sidoName")).toBe("제주");
    expect(url.searchParams.get("returnType")).toBe("json");
    expect(url.searchParams.get("ver")).toBe("1.3");
    expect(airPath(33.49961, 126.53122)).toBe("/api/air?lat=33.5&lng=126.53");
    expect(airPath(33.5, 126.53, "jeju-abc")).toBe(
      "/api/air?lat=33.5&lng=126.53&id=jeju-abc",
    );
  });
});
