import { describe, expect, it } from "vitest";
import {
  commonsUrl,
  khsImageUrl,
  khsListUrl,
  httpsPhoto,
  kakaoImageUrl,
  kakaoLocalUrl,
  kakaoPlaceInfoUrl,
  photoName,
  pickCommonsImage,
  pickGalleryImage,
  pickKhsHeritage,
  pickKhsImage,
  pickKakaoImage,
  pickKakaoMapPhoto,
  pickKakaoPlace,
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

describe("위키미디어 공용 좌표 검색(④)", () => {
  const page = (
    title: string,
    lat: number,
    lon: number,
    extra: Record<string, unknown> = {},
  ) => ({
    title: `File:${title}`,
    coordinates: [{ lat, lon }],
    imageinfo: [
      {
        thumburl: `https://upload.wikimedia.org/thumb/${encodeURIComponent(title)}/800px.jpg`,
        extmetadata: {
          Artist: {
            value: '<a href="//commons.wikimedia.org/wiki/User:Kim">Kim</a>',
          },
          LicenseShortName: { value: "CC BY-SA 4.0" },
        },
      },
    ],
    ...extra,
  });
  const spot = {
    ko: "불국사",
    en: "Bulguksa Temple",
    lat: 35.7901,
    lng: 129.3321,
  };

  it("파일 이름에 장소 이름이 든 사진만, 가까운 순, 작성자 · 라이선스와 함께", () => {
    const body = {
      query: {
        pages: [
          page("Seokguram 01.jpg", 35.79, 129.332),
          page("불국사 대웅전 02.jpg", 35.7905, 129.3325),
          page("Bulguksa Temple gate.jpg", 35.7901, 129.3321),
        ],
      },
    };
    expect(pickCommonsImage(body, spot)).toEqual({
      src: "https://upload.wikimedia.org/thumb/Bulguksa%20Temple%20gate.jpg/800px.jpg",
      author: "Kim",
      license: "CC BY-SA 4.0",
    });
  });

  it("지도 · 로고 · SVG · 이름이 맞지 않는 파일은 쓰지 않는다", () => {
    const body = {
      query: {
        pages: [
          page("불국사 map.jpg", 35.7901, 129.3321),
          page("불국사.svg", 35.7901, 129.3321),
          page("Gyeongju street.jpg", 35.7901, 129.3321),
        ],
      },
    };
    expect(pickCommonsImage(body, spot)).toBeNull();
    expect(pickCommonsImage({}, spot)).toBeNull();
  });

  it("좌표 300m 안 파일 이름공간을 부른다", () => {
    const u = new URL(commonsUrl(35.79, 129.33));
    expect(u.host).toBe("commons.wikimedia.org");
    expect(u.searchParams.get("ggscoord")).toBe("35.79|129.33");
    expect(u.searchParams.get("ggsradius")).toBe("300");
    expect(u.searchParams.get("ggsnamespace")).toBe("6");
  });
});

describe("카카오 이미지 검색(⑤)", () => {
  const doc = (
    image_url: string,
    width = 800,
    height = 600,
    site = "티스토리",
  ) => ({
    image_url,
    width,
    height,
    display_sitename: site,
  });

  it("https · 가로 500 · 세로 300px 이상 · 너무 길지 않은 첫 사진, 출처는 사이트 이름", () => {
    const body = {
      documents: [
        doc("http://a.com/1.jpg"),
        doc("https://a.com/small.jpg", 300, 200),
        doc("https://a.com/banner.jpg", 2000, 400),
        doc("https://a.com/anim.gif"),
        doc("https://blog.example.com/ok.jpg", 1200, 800, "네이버블로그"),
        doc("https://b.com/later.jpg"),
      ],
    };
    expect(pickKakaoImage(body)).toEqual({
      src: "https://blog.example.com/ok.jpg",
      author: "네이버블로그",
    });
    expect(pickKakaoImage({})).toBeNull();
  });

  it("정확도순 10장을 부른다", () => {
    const u = new URL(kakaoImageUrl("경주 불국사"));
    expect(u.host).toBe("dapi.kakao.com");
    expect(u.pathname).toBe("/v2/search/image");
    expect(u.searchParams.get("query")).toBe("경주 불국사");
    expect(u.searchParams.get("sort")).toBe("accuracy");
  });
});

describe("카카오맵 기반(⑤)", () => {
  const doc = (
    id: string,
    place_name: string,
    distance: number,
    address_name = "전북 전주시 완산구 풍남동3가 64",
  ) => ({
    id,
    place_name,
    distance: String(distance),
    address_name,
  });

  it("좌표 500m 안 · 이름이 서로를 품는 가장 가까운 카카오맵 장소, 동 이름도", () => {
    const body = {
      documents: [
        doc("1", "전주한옥마을 주차장", 50),
        doc("2", "가족회관", 120),
        doc("3", "가족회관 2호점", 90),
        doc("4", "가족회관", 900),
      ],
    };
    expect(pickKakaoPlace(body, "가족회관")).toEqual({
      id: "3",
      name: "가족회관 2호점",
      dong: "풍남동3가",
    });
    expect(
      pickKakaoPlace({ documents: [doc("4", "가족회관", 900)] }, "가족회관"),
    ).toBeNull();
    expect(
      pickKakaoPlace({ documents: [doc("1", "다른식당", 10)] }, "가족회관"),
    ).toBeNull();
  });

  it("카카오맵 대표 사진은 https만, 호출 주소", () => {
    expect(
      pickKakaoMapPhoto({
        basicInfo: { mainphotourl: "http://t1.daumcdn.net/place/a.jpg" },
      }),
    ).toBe("https://t1.daumcdn.net/place/a.jpg");
    expect(pickKakaoMapPhoto({ basicInfo: {} })).toBeNull();
    expect(pickKakaoMapPhoto(null)).toBeNull();
    const u = new URL(kakaoLocalUrl("가족회관", 35.8148, 127.1454));
    expect(u.pathname).toBe("/v2/local/search/keyword.json");
    expect([
      u.searchParams.get("x"),
      u.searchParams.get("y"),
      u.searchParams.get("radius"),
    ]).toEqual(["127.1454", "35.8148", "500"]);
    expect(kakaoPlaceInfoUrl("123")).toBe(
      "https://place.map.kakao.com/main/v/123",
    );
  });
});

describe("국가유산청(⑤)", () => {
  const item = (name: string, lat: string, lng: string, asno = "00010000") =>
    `<item><ccbaKdcd>13</ccbaKdcd><ccbaAsno>${asno}</ccbaAsno><ccbaCtcd>35</ccbaCtcd><ccbaMnm1><![CDATA[${name}]]></ccbaMnm1><latitude>${lat}</latitude><longitude>${lng}</longitude></item>`;
  const site = { ko: "전주 경기전", lat: 35.8153, lng: 127.1498 };

  it("이름이 서로를 품고 2km 안인 가장 가까운 국가유산(좌표 0이면 검색 순)", () => {
    const xml = `<result>${item("전주 경기전 정전", "35.8155", "127.1500", "A")}${item("전주 경기전", "36.5", "127.1", "B")}${item("다른 절", "35.8153", "127.1498", "C")}</result>`;
    expect(pickKhsHeritage(xml, site)).toEqual({
      kdcd: "13",
      asno: "A",
      ctcd: "35",
      name: "전주 경기전 정전",
    });
    expect(
      pickKhsHeritage(
        `<result>${item("전주 경기전", "0", "0", "D")}</result>`,
        site,
      )?.asno,
    ).toBe("D");
    expect(pickKhsHeritage("<result></result>", site)).toBeNull();
  });

  it("이미지는 https 첫 사진, 호출 주소", () => {
    expect(
      pickKhsImage(
        "<result><item><imageUrl>http://www.khs.go.kr/unisearch/images/a.jpg</imageUrl></item></result>",
      ),
    ).toBe("https://www.khs.go.kr/unisearch/images/a.jpg");
    expect(pickKhsImage("<result></result>")).toBeNull();
    expect(new URL(khsListUrl("경기전")).searchParams.get("ccbaMnm1")).toBe(
      "경기전",
    );
    expect(new URL(khsImageUrl("13", "A", "35")).pathname).toBe(
      "/cha/SearchImageOpenapi.do",
    );
  });
});
