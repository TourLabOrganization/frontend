import { describe, expect, it, vi } from "vitest";
import {
  cleanAddress,
  geocodeSite,
  inCity,
  manualRow,
  nameMatches,
  toCsv,
} from "./geocode-heritage-places.mjs";
import { parseCsv } from "./add-manual-places.mjs";

const json = (documents: unknown[]) => Response.json({ documents });

describe("국가유산 소재지 지오코딩(geocode-heritage-places.mjs)", () => {
  it("cleanAddress: 괄호 · 「/」 뒤 · 쉼표 뒤 · 번지를 뗀다", () => {
    expect(
      cleanAddress(
        "경북 청도군 운문면 운문사길 264, 운문사 (신원리) / (지번)경북 청도군 운문면 신원리 1789",
      ),
    ).toBe("경북 청도군 운문면 운문사길 264");
    expect(cleanAddress("경북 영양군 입암면 산해리 391-6번지")).toBe(
      "경북 영양군 입암면 산해리 391-6",
    );
  });

  it("nameMatches · inCity", () => {
    expect(nameMatches("운문사", "운문사")).toBe(true);
    expect(nameMatches("호거산 운문사", "운문사")).toBe(true);
    expect(nameMatches("운문사 주차장", "봉정사")).toBe(false);
    expect(inCity("경북", "청도군 ", "청도")).toBe(true);
    expect(inCity("경북", "청송군 ", "청도")).toBe(false);
    expect(inCity("서울", "종로구 ", "서울")).toBe(true);
    expect(inCity("대구", "군위군 ", "대구")).toBe(true);
    expect(inCity("제주특별자치도", "서귀포시 ", "제주")).toBe(true);
    expect(inCity("전남", "북구 ", "광주")).toBe(true);
  });

  it("장소 검색 → 그 도시 · 이름 맞는 곳, 없으면 주소 검색. 시군구가 다른 도시면 버린다", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: string) => {
      const url = new URL(input);
      const q = url.searchParams.get("query") ?? "";
      calls.push(`${url.pathname.split("/").slice(-2).join("/")}:${q}`);
      if (url.pathname.endsWith("keyword.json")) {
        if (q === "청도 운문사")
          return json([
            {
              place_name: "운문사 주차장",
              address_name: "경북 청도군 운문면 신원리",
              x: "1",
              y: "1",
            },
            {
              place_name: "운문사",
              address_name: "경북 청도군 운문면 신원리 1789",
              x: "128.9520",
              y: "35.6430",
            },
          ]);
        return json([]);
      }
      if (url.pathname.endsWith("address.json"))
        return json([
          {
            address_name: "경북 영양군 입암면 산해리 391-6",
            x: "129.11",
            y: "36.69",
          },
        ]);
      if (url.pathname.endsWith("coord2regioncode.json")) {
        const x = Number(url.searchParams.get("x"));
        return json([
          x > 129
            ? {
                region_type: "B",
                code: "4776034021",
                region_1depth_name: "경상북도",
                region_2depth_name: "영양군",
              }
            : {
                region_type: "B",
                code: "4782033021",
                region_1depth_name: "경상북도",
                region_2depth_name: "청도군",
              },
        ]);
      }
      return json([]);
    }) as unknown as typeof fetch;
    const g1 = await geocodeSite(
      { region: "청도", site: "운문사", ko: "청도 운문사", address: "" },
      "K",
      fetchImpl,
    );
    expect(g1).toMatchObject({
      lat: 35.643,
      lng: 128.952,
      signgu: "47820",
      muni: "청도군",
      how: "장소",
      place: "운문사",
    });
    const g2 = await geocodeSite(
      {
        region: "영양",
        site: "현리 삼층석탑",
        ko: "영양 현리 삼층석탑",
        address: "경북 영양군 입암면 산해리 391-6번지",
      },
      "K",
      fetchImpl,
    );
    expect(g2).toMatchObject({ signgu: "47760", how: "주소" });
    // 주소 결과가 다른 도시면 버린다
    const g3 = await geocodeSite(
      {
        region: "청송",
        site: "어딘가",
        ko: "청송 어딘가",
        address: "경북 영양군 입암면 산해리 391-6",
      },
      "K",
      fetchImpl,
    );
    expect(g3).toBeNull();
    expect(calls.some((c) => c.includes("KakaoAK"))).toBe(false);
  });

  it("manualRow → toCsv → parseCsv: add-manual-places 입력 꼴(coord 열은 좌표 근거)", () => {
    const row = manualRow(
      {
        region: "청도",
        site: "운문사",
        ko: "청도 운문사",
        cat: "herit",
        count: "13",
        items: "금당 앞 석등 · 동호",
      },
      {
        lat: 35.643,
        lng: 128.952,
        signgu: "47820",
        muni: "청도군",
        how: "장소",
        place: "운문사",
      },
    );
    const back = parseCsv(toCsv([row]))[0];
    expect(back).toMatchObject({
      region: "청도",
      ko: "청도 운문사",
      lat: "35.643",
      signgu: "47820",
      cat: "herit",
    });
    expect(back.en).not.toMatch(/[가-힣]/);
    expect(back.desc).toContain("보물 13건");
    expect(back.coord).toContain("카카오 로컬 좌표");
  });
});
