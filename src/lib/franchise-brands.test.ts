import { describe, expect, it } from "vitest";
import areaGyeongju from "./fixtures/tour/rlte-area-47130-202607.json";
import searchBulguksa from "./fixtures/tour/rlte-search-bulguksa-202607.json";
import searchGyeongbokgung from "./fixtures/tour/rlte-search-gyeongbokgung-202607.json";
import searchNaksan from "./fixtures/tour/rlte-search-naksan.json";
import { FRANCHISE_BRANDS, isFranchiseName } from "./franchise-brands";

// 한국관광공사 연관 관광지 실제 응답(2026-09-29)에 나온 이름으로 본다
const names = [
  searchBulguksa,
  searchGyeongbokgung,
  searchNaksan,
  areaGyeongju,
].flatMap((body) =>
  body.response.body.items.item.map((x) => String(x.rlteTatsNm)),
);
const has = (name: string) => expect(names).toContain(name);

describe("전국 체인 브랜드 거르기 (팀장 의견 2026-09-29)", () => {
  it("체인 브랜드로 시작하는 이름은 뺀다(「/」 앞부분, 공백 무시)", () => {
    for (const name of [
      "스타벅스/경주보문로DT점",
      "투썸플레이스/경주감포항점",
      "맥도날드/신월남부DT점",
      "CGV/동대문",
    ]) {
      has(name);
      expect(isFranchiseName(name)).toBe(true);
    }
    // 「/」가 없어도 브랜드로 시작하면(대소문자 · 공백 무시)
    expect(isFranchiseName("CGV용산아이파크몰")).toBe(true);
    expect(isFranchiseName("cgv 용산아이파크몰")).toBe(true);
    expect(isFranchiseName("스타 벅스 경주점")).toBe(true);
  });

  it("「브랜드/지점」 꼴의 지역 가게 · 로컬 맛집 · 백화점 · 면세점 · 시장은 남긴다", () => {
    for (const name of [
      "교리김밥/경주본점",
      "경주밀면/본점",
      "함양집/보불로점",
      "소문난성수감자탕/본관",
      "마복림떡볶이",
      "황남빵",
      "더현대/서울",
      "롯데면세점/명동본점",
      "광장시장",
    ]) {
      has(name);
      expect(isFranchiseName(name)).toBe(false);
    }
  });

  it("겹치는 브랜드(이마트 · 이마트24)는 목록 순서와 상관없이 걸린다", () => {
    expect(FRANCHISE_BRANDS.indexOf("이마트24")).toBeLessThan(
      FRANCHISE_BRANDS.indexOf("이마트"),
    );
    expect(isFranchiseName("이마트24/경주보문점")).toBe(true);
    expect(isFranchiseName("이마트/경주점")).toBe(true);
    expect(isFranchiseName("메가MGC커피/황남점")).toBe(true);
    expect(isFranchiseName("메가박스/경주")).toBe(true);
  });

  it("영문 브랜드는 뒤에 영문자가 이어지면 다른 이름이다(「CU」 ↔ 「CUBE」)", () => {
    expect(isFranchiseName("CU/경주보문점")).toBe(true);
    expect(isFranchiseName("CU경주점")).toBe(true);
    expect(isFranchiseName("CUBE 갤러리")).toBe(false);
    expect(isFranchiseName("GS25/황남점")).toBe(true);
  });
});
