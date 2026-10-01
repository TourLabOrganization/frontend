import { describe, expect, it } from "vitest";
import { mergeAdded } from "./add-popular-places.mjs";

const collected = {
  id: "pop2002",
  n: null,
  ko: "새전망대",
  en: "Saejeonmangdae",
  locKo: "경주",
  cat: "herit",
  lat: 35.8,
  lng: 129.3,
  min: 60,
  hrs: "",
  open: null,
  close: null,
  yt: false,
  off: true,
  k100: false,
  un: false,
  bf: false,
  auto: true,
  macro: "daegyeong",
  pickCity: "경주",
  signgu: "47130",
  contentid: "2002",
  addr: "경상북도 경주시 어딘가 1",
  photo: "https://tong.visitkorea.or.kr/a.jpg",
  zh: "新展望台",
  ja: "",
  source:
    "경상북도 경주시 어딘가 1 · 한국관광공사 인기 관광지(집중률 30%, 2026-10-01) · 관광정보 contentid 2002 좌표",
  desc: "새로 생긴 전망대",
};

const files = {
  added: [],
  signgu: { gj1: "47130" },
  regions: { regions: [], placeCounts: { 경주: 70 } },
  details: { gj1: { desc: { ko: "x" } } },
};

describe("추가 장소 합치기", () => {
  it("가벼운 필드만 added-places에, 코드 · 장소 수 · 무거운 필드는 각 파일에", () => {
    const out = mergeAdded([collected], files);
    expect(out.newIds).toEqual(["pop2002"]);
    expect(out.added).toEqual([
      {
        id: "pop2002",
        n: null,
        ko: "새전망대",
        en: "Saejeonmangdae",
        locKo: "경주",
        cat: "herit",
        lat: 35.8,
        lng: 129.3,
        min: 60,
        hrs: "",
        open: null,
        close: null,
        yt: false,
        off: true,
        k100: false,
        un: false,
        bf: false,
        auto: true,
        macro: "daegyeong",
        pickCity: "경주",
      },
    ]);
    expect(out.signgu).toEqual({ gj1: "47130", pop2002: "47130" });
    expect(out.regions.placeCounts).toEqual({ 경주: 71 });
    expect(out.details.pop2002).toEqual({
      desc: { ko: "새로 생긴 전망대" },
      src: { ko: collected.source },
      img: "https://tong.visitkorea.or.kr/a.jpg",
      imgCredit: "한국관광공사",
      zh: "新展望台",
    });
    // 원래 객체는 그대로
    expect(files.added).toEqual([]);
    expect(files.regions.placeCounts).toEqual({ 경주: 70 });
  });

  it("이미 있는 id는 건너뛴다(값도 바꾸지 않는다)", () => {
    const once = mergeAdded([collected], files);
    const twice = mergeAdded([{ ...collected, ko: "바뀐 이름" }], once);
    expect(twice.newIds).toEqual([]);
    expect(twice.added).toEqual(once.added);
    expect(twice.regions.placeCounts).toEqual({ 경주: 71 });
    // signgu.json에 코드가 있는 앱 장소 id도 건너뛴다
    expect(mergeAdded([{ ...collected, id: "gj1" }], files).newIds).toEqual([]);
  });
});
