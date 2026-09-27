import { describe, expect, it } from "vitest";
import ticData from "./data/tic.json";
import {
  cityInfoCenters,
  type InfoCenter,
  kakaoMapLink,
  langsOf,
  mineCount,
  mineOf,
  telHref,
} from "./tic";

const row = (name: string, lang = "", city = "가"): InfoCenter => ({
  name,
  city,
  lat: 37.5,
  lng: 127,
  tel: "",
  hours: "",
  closed: "",
  lang,
  addr: "",
});

describe("langsOf (PoC langOf)", () => {
  it("낱말을 나눠 언어 코드로, 겹치면 한 번만", () => {
    expect(langsOf("영/일/중")).toEqual(["EN", "JP", "CN"]);
    expect(langsOf("영어, 중국어 · 일본어")).toEqual(["EN", "CN", "JP"]);
    expect(langsOf("영 영어")).toEqual(["EN"]);
    expect(langsOf("중간/중번/러/베트남어/태국어")).toEqual([
      "CN",
      "RU",
      "VN",
      "TH",
    ]);
  });
  it("표에 없는 낱말은 버린다", () => {
    expect(langsOf("")).toEqual([]);
    expect(langsOf("한/태/말/스")).toEqual([]);
    expect(langsOf("중.일")).toEqual([]);
    expect(langsOf("일어")).toEqual([]);
  });
});

describe("mineOf (PoC mine)", () => {
  it("스페인어는 영어 안내, 한국어는 없음", () => {
    expect(mineOf("en")).toBe("EN");
    expect(mineOf("es")).toBe("EN");
    expect(mineOf("ja")).toBe("JP");
    expect(mineOf("zh")).toBe("CN");
    expect(mineOf("ko")).toBeNull();
  });
});

describe("cityInfoCenters", () => {
  const all = [
    row("다 휴게소 안내소", "영"),
    row("나 안내소"),
    row("가 안내소"),
    row("라 안내소", "영/일"),
    row("마 안내소", "일"),
    row("다른 도시", "영", "나"),
  ];

  it("그 도시만, 한국어 화면은 휴게소 뒤로 → 이름 가나다", () => {
    expect(cityInfoCenters(all, "가", null).map((c) => c.name)).toEqual([
      "가 안내소",
      "나 안내소",
      "라 안내소",
      "마 안내소",
      "다 휴게소 안내소",
    ]);
  });

  it("내 언어 안내 가능한 곳이 먼저(휴게소여도)", () => {
    expect(cityInfoCenters(all, "가", "EN").map((c) => c.name)).toEqual([
      "라 안내소",
      "다 휴게소 안내소",
      "가 안내소",
      "나 안내소",
      "마 안내소",
    ]);
  });

  it("내 언어만 거르기 · 개수", () => {
    expect(cityInfoCenters(all, "가", "JP", true).map((c) => c.name)).toEqual([
      "라 안내소",
      "마 안내소",
    ]);
    expect(mineCount(all, "가", "JP")).toBe(2);
    expect(mineCount(all, "가", null)).toBe(0);
    // 한국어 화면에서는 거르기를 켜도 전부
    expect(cityInfoCenters(all, "가", null, true)).toHaveLength(5);
  });

  it("원천 데이터: 725곳, 서울 64곳", () => {
    const data = ticData as InfoCenter[];
    expect(data).toHaveLength(725);
    expect(cityInfoCenters(data, "서울", null)).toHaveLength(64);
    expect(cityInfoCenters(data, "없는 도시", null)).toEqual([]);
  });
});

describe("링크", () => {
  it("전화는 숫자만, 지도는 카카오맵 이름 · 좌표", () => {
    expect(telHref("02-2148-4161")).toBe("tel:0221484161");
    expect(
      kakaoMapLink({ name: "북촌 안내소", lat: 37.57947, lng: 126.98242 }),
    ).toBe(
      "https://map.kakao.com/link/map/%EB%B6%81%EC%B4%8C%20%EC%95%88%EB%82%B4%EC%86%8C,37.57947,126.98242",
    );
  });
});
