import { describe, expect, it } from "vitest";
import {
  httpsPhoto,
  photoName,
  pickGalleryImage,
  pickTourImage,
  pickWikiImage,
  wikiSummaryUrl,
} from "./tour-photo";

const place = { ko: "불국사", lat: 35.7901, lng: 129.3321 };
const item = (
  title: string,
  ct: string,
  lat = 35.7901,
  lng = 129.3321,
  img = `http://tong.visitkorea.or.kr/cms/${title}.jpg`,
) => ({
  title,
  contenttypeid: ct,
  mapy: String(lat),
  mapx: String(lng),
  firstimage: img,
});

describe("photoName (PoC strip · norm)", () => {
  it("대괄호 태그 · 괄호 병기 · 공백 · 가운뎃점을 뺀다", () => {
    expect(photoName("[UNESCO] 경주 불국사 (佛國寺)")).toBe("경주불국사");
    expect(photoName("창덕궁（昌德宮）")).toBe("창덕궁");
    expect(photoName("A · B")).toBe("ab");
  });
});

describe("pickTourImage (PoC tourTry score)", () => {
  it("같은 이름이 먼저, 그다음 이름으로 끝나는 제목", () => {
    const got = pickTourImage(
      [item("경주 불국사", "12"), item("불국사", "12")],
      place,
    );
    expect(got).toContain("/불국사.jpg");
    expect(pickTourImage([item("경주 불국사", "12")], place)).toContain(
      "경주 불국사",
    );
  });

  it("숙박 · 쇼핑 · 코스 · 사진 없는 항목은 뺀다", () => {
    expect(
      pickTourImage(
        [
          item("불국사", "32"),
          item("불국사", "39"),
          item("불국사", "25"),
          item("불국사 탐방코스", "12"),
          { ...item("불국사", "12"), firstimage: "" },
        ],
        place,
      ),
    ).toBeNull();
  });

  it("거리: 같은 이름은 12km, 나머지는 3km 이내", () => {
    expect(pickTourImage([item("불국사", "12", 35.85)], place)).not.toBeNull(); // 약 6.7km
    expect(pickTourImage([item("불국사", "12", 36)], place)).toBeNull(); // 약 23km
    expect(pickTourImage([item("경주불국사", "12", 35.85)], place)).toBeNull();
  });

  it("같은 점수면 관광지(12)가 음식점(38)보다 먼저, 제목이 8글자보다 더 길면 뺀다", () => {
    expect(
      pickTourImage(
        [
          item("불국사", "38", 35.79, 129.33, "http://a/food.jpg"),
          item("불국사", "12", 35.79, 129.33, "http://a/spot.jpg"),
        ],
        place,
      ),
    ).toBe("http://a/spot.jpg");
    expect(
      pickTourImage([item("아주아주아주긴이름의불국사", "12")], place),
    ).toBeNull();
  });
});

describe("pickGalleryImage (PoC galleryTry)", () => {
  it("제목이 같은 사진, 없으면 서로 품는 사진", () => {
    const items = [
      { galTitle: "불국사 다보탑", galWebImageUrl: "http://a/1.jpg" },
      { galTitle: "불국사", galWebImageUrl: "http://a/2.jpg" },
    ];
    expect(pickGalleryImage(items, "불국사")).toBe("http://a/2.jpg");
    expect(pickGalleryImage(items.slice(0, 1), "불국사")).toBe(
      "http://a/1.jpg",
    );
    expect(
      pickGalleryImage([{ galTitle: "석굴암", galWebImageUrl: "x" }], "불국사"),
    ).toBeNull();
  });
});

describe("위키백과 · 주소", () => {
  it("대표 이미지를 800px로, SVG는 쓰지 않는다", () => {
    expect(
      pickWikiImage({
        originalimage: {
          source: "https://upload.wikimedia.org/a/b/320px-Bulguksa.jpg",
        },
      }),
    ).toBe("https://upload.wikimedia.org/a/b/800px-Bulguksa.jpg");
    expect(
      pickWikiImage({
        originalimage: { source: "https://upload.wikimedia.org/x/Map.svg" },
      }),
    ).toBeNull();
    expect(pickWikiImage({})).toBeNull();
    expect(wikiSummaryUrl("불국사")).toBe(
      "https://ko.wikipedia.org/api/rest_v1/page/summary/%EB%B6%88%EA%B5%AD%EC%82%AC",
    );
  });

  it("http는 https로, 이상한 주소는 null", () => {
    expect(httpsPhoto("http://tong.visitkorea.or.kr/cms/a.jpg")).toBe(
      "https://tong.visitkorea.or.kr/cms/a.jpg",
    );
    expect(httpsPhoto("javascript:alert(1)")).toBeNull();
    expect(httpsPhoto("")).toBeNull();
  });
});
