import { describe, expect, it } from "vitest";
import { mergeDataServer, unescapeJs } from "./data-server.mjs";

const place = {
  id: "gj1",
  ko: "불국사",
  en: "Bulguksa Temple",
  cat: "heal",
  min: 90,
  macro: "daegyeong",
};

describe("data-server 합치기", () => {
  it("cat은 catFinal로, popRank · zone(vz)은 값이 있을 때만 뒤에 붙인다", () => {
    const { place: out, changed } = mergeDataServer(place, {
      catFinal: "herit",
      nameEn: "Bulguksa Temple",
      popRank: 3,
      zone: "경주시 관광단지 (2008 지정)",
    });
    expect(out).toEqual({
      ...place,
      cat: "herit",
      vz: "경주시 관광단지 (2008 지정)",
      popRank: 3,
    });
    expect(Object.keys(out).slice(-2)).toEqual(["vz", "popRank"]);
    expect(changed).toEqual({ cat: true, en: false });
    // 원래 객체는 그대로
    expect(place.cat).toBe("heal");
  });

  it("값이 없으면 넣지 않고, 원천에 있던 지정구역도 data-server 값을 따른다", () => {
    const { place: out, changed } = mergeDataServer(
      { ...place, vz: "옛 문구" },
      {
        catFinal: "heal",
        nameEn: "Bulguksa Temple",
        popRank: null,
        zone: null,
      },
    );
    expect(out).toEqual(place);
    expect(changed).toEqual({ cat: false, en: false });
  });

  it("영어 이름은 이스케이프를 풀고 다를 때만 바꾼다", () => {
    expect(unescapeJs("Yeonhee\\'s Supermarket")).toBe("Yeonhee's Supermarket");
    expect(unescapeJs("Land\\u2019s End Village")).toBe("Land’s End Village");
    const same = mergeDataServer(
      { ...place, en: "Children's Museum" },
      { catFinal: "heal", nameEn: "Children\\'s Museum" },
    );
    expect(same.changed.en).toBe(false);
    const fixed = mergeDataServer(place, {
      catFinal: "heal",
      nameEn: "Bulguksa",
    });
    expect(fixed.place.en).toBe("Bulguksa");
    expect(fixed.changed.en).toBe(true);
  });

  it("data-server에 없는 장소면 멈춘다", () => {
    expect(() => mergeDataServer(place, undefined)).toThrow(/gj1/);
  });
});
