import { describe, expect, it } from "vitest";
import {
  manualId,
  manualPlaces,
  nearExisting,
  parseCsv,
  stayMedians,
} from "./add-manual-places.mjs";
import { mergeAdded } from "./add-popular-places.mjs";

const pool = [
  {
    id: "gj1",
    ko: "효우당",
    locKo: "경주",
    pickCity: "경주",
    cat: "stay",
    lat: 35.8923,
    lng: 129.1786,
    min: 180,
    macro: "daegyeong",
  },
  {
    id: "gj2",
    ko: "첨성대",
    locKo: "경주",
    pickCity: "경주",
    cat: "herit",
    lat: 35.8347,
    lng: 129.219,
    min: 40,
    macro: "daegyeong",
  },
  {
    id: "gj3",
    ko: "대릉원",
    locKo: "경주",
    pickCity: "경주",
    cat: "herit",
    lat: 35.8389,
    lng: 129.2126,
    min: 80,
    macro: "daegyeong",
  },
];

const row = (over: Record<string, string> = {}) => ({
  region: "경주",
  stopName: "새정원",
  tours: "2",
  ko: "새정원",
  en: "Sae Garden",
  cat: "heal",
  lat: "35.9000",
  lng: "129.3000",
  signgu: "47130",
  muni: "경주시",
  desc: "새로 적은 정원",
  descEn: "A newly listed garden",
  ...over,
});

describe("parseCsv", () => {
  it("큰따옴표 안 쉼표 · BOM · 빈 줄을 다룬다", () => {
    const rows = parseCsv('﻿a,b,c\n1,"x, y",3\n\n2,"he said ""hi""",\n');
    expect(rows).toEqual([
      { a: "1", b: "x, y", c: "3" },
      { a: "2", b: 'he said "hi"', c: "" },
    ]);
  });
});

describe("manualId", () => {
  it("같은 도시 · 이름이면 같은 id, 다르면 다른 id", () => {
    expect(manualId("경주", "새정원")).toBe(manualId("경주", "새정원"));
    expect(manualId("경주", "새정원")).toMatch(/^ctm[0-9a-f]{8}$/);
    expect(manualId("경주", "새정원")).not.toBe(manualId("부산", "새정원"));
  });
});

describe("stayMedians", () => {
  it("범주별 중앙값(짝수면 가운데 둘의 평균)", () => {
    expect(stayMedians(pool)).toEqual({ stay: 180, herit: 60 });
  });
});

describe("nearExisting", () => {
  it("250m 안이면 이름이 달라도 기존 장소", () => {
    expect(
      nearExisting({ ko: "전혀다른곳", lat: 35.8348, lng: 129.2195 }, pool)?.id,
    ).toBe("gj2");
  });
  it("1km 안은 이름 글자쌍이 절반 넘게 겹칠 때만", () => {
    const far = { lat: 35.8347 + 0.005, lng: 129.219 }; // 약 550m
    expect(nearExisting({ ko: "경주 첨성대", ...far }, pool)?.id).toBe("gj2");
    expect(nearExisting({ ko: "새정원", ...far }, pool)).toBeNull();
  });
});

describe("mergeAdded(수기 장소)", () => {
  it("영어 설명이 있으면 장소 상세 desc.en에 적는다", () => {
    const { places } = manualPlaces([row()], pool);
    const id = places[0].id as string;
    const merged = mergeAdded(places, {
      added: [],
      signgu: {},
      regions: { placeCounts: {} },
      details: {},
    });
    expect(merged.newIds).toEqual([id]);
    expect(merged.details[id]).toEqual({
      desc: { ko: "새로 적은 정원", en: "A newly listed garden" },
      src: { ko: places[0].source },
    });
    expect(merged.signgu[id]).toBe("47130");
    expect(merged.regions.placeCounts).toEqual({ 경주: 1 });
  });
});

describe("manualPlaces", () => {
  it("행을 추가 장소로 만들고 체류 · 권역 · 출처를 채운다", () => {
    const { places, skipped } = manualPlaces([row()], pool, "2026-10-03");
    expect(skipped).toEqual([]);
    expect(places).toHaveLength(1);
    const p = places[0];
    expect(p.id).toBe(manualId("경주", "새정원"));
    expect(p).toMatchObject({
      ko: "새정원",
      en: "Sae Garden",
      locKo: "경주",
      pickCity: "경주",
      macro: "daegyeong",
      cat: "heal",
      lat: 35.9,
      lng: 129.3,
      min: 60, // heal 중앙값이 없어 60
      signgu: "47130",
      off: true,
      auto: false,
      desc: "새로 적은 정원",
      descEn: "A newly listed garden",
    });
    expect(p.source).toBe(
      "시티투어 경유지(2개 노선, 노선 표기 「새정원」) · 좌표 수기 입력(지도 검증 필요, 2026-10-03)",
    );
  });
  it("범주 중앙값을 쓰고 설명이 없으면 기본 설명", () => {
    const { places } = manualPlaces([row({ cat: "herit", desc: "" })], pool);
    expect(places[0].min).toBe(60);
    expect(places[0].desc).toBe("경주 시티투어 경유지(2개 노선)");
  });
  it("기존 장소 근처 · 앱에 없는 도시 · 표 안 중복 · 빈 좌표는 건너뛴다", () => {
    const { places, skipped } = manualPlaces(
      [
        row({ ko: "첨성대 옆", lat: "35.8348", lng: "129.2195" }),
        row({ region: "없는도시" }),
        row(),
        row({ ko: "새정원", stopName: "새정원(중복)" }),
        row({ ko: "좌표없음", lat: "" }),
        row({ ko: "먼곳", lat: "35.9001", lng: "129.3001" }),
      ],
      pool,
    );
    expect(places.map((p) => p.ko)).toEqual(["새정원"]);
    expect(skipped.map((s) => s.reason)).toEqual([
      "기존 장소 첨성대",
      "앱에 없는 도시 없는도시",
      "표 안 중복",
      "빈 이름 · 도시 · 좌표",
      "기존 장소 새정원",
    ]);
  });
});
