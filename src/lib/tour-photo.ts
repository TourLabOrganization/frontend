// 장소 시트의 대표 사진(GET /api/tour/photo?id=, 서버 전용). 장소 자료에 사진(img)이 없는 곳만 부른다.
// PoC Tour Planner.dc.html loadPhoto와 같은 순서로 찾는다:
//   ① 한국관광공사 국문 관광정보 KorService2 searchKeyword2의 대표 이미지(firstimage). 이름 · 거리로 점수를 매겨 한 곳만 고른다(PoC tourTry score)
//   ② 한국관광공사 관광사진 정보 PhotoGalleryService1 gallerySearchList1. 사진 제목이 장소 이름과 같거나 서로 품는 사진(PoC galleryTry)
//   ③ 한국어 위키백과 요약(REST page/summary)의 대표 이미지(PoC tryOne). 키가 없어도 부른다
//   ④ 위키미디어 공용(Wikimedia Commons) 좌표 검색(앱에서 더한 단계, PoC에 없다): 장소 좌표 300m 안 파일 중
//      파일 이름에 장소 이름(한국어 · 영어)이 든 사진, 가까운 순. 자유 라이선스라 작성자 · 라이선스를 함께 돌려주고 화면에 적는다.
//   ⑤ 국가유산청 국가유산 검색 · 이미지 오픈 API(키 없음, 국가유산 장소(herit)만): 이름으로 목록을 찾고(SearchKindOpenapiList)
//      이름이 서로를 품고 좌표 2km 안(좌표가 있으면)인 가장 가까운 국가유산의 첫 이미지(SearchImageOpenapi). 출처 「국가유산청」(공공누리)
//   ⑥ 카카오맵 기반(2026-10-05 요청으로 마지막 단계에 더함. Google Places 단계는 2026-10-06 요청으로 뺐다, 키 KAKAO_REST_KEY 서버 전용):
//      (a) 카카오 로컬 키워드 검색(dapi.kakao.com/v2/local/search/keyword)으로 장소 좌표 500m 안, 이름이 맞는 카카오맵 장소를 찾는다
//      (b) 그 장소의 카카오맵 대표 사진(place.map.kakao.com 장소 정보의 mainphotourl, 공개 문서가 없는 주소라 실패하면 건너뛴다)
//      (c) 대표 사진이 없으면 카카오 이미지 검색(dapi.kakao.com/v2/search/image)을 「카카오맵 장소 이름 + 동」으로 좁혀 가로 500 · 세로 300px 이상 첫 사진.
//      카카오맵에서 같은 장소를 못 찾으면 사진을 쓰지 않는다(엉뚱한 사진 방지). 이미지 검색 사진은 출처에 원 사이트 이름을 적는다
// 키(DATA_GO_KR_KEY)가 없으면 ①②를 건너뛰고 ③만 쓴다. 사진 주소는 https로 바꿔 돌려준다.
// 테스트(vitest)가 "@/" 경로를 풀지 못해 상대 경로로 import한다.
import {
  fetchTourItems,
  parseTourQuery,
  tourApiKey,
  tourApiUrl,
  type TourItem,
  tourJson,
  type TourPlace,
} from "./tour-api";
import type { PlacePhotoSource } from "../components/ui/place-photo";
import { TOUR_TIMEOUT_MS } from "./tour";

/** 같은 장소의 사진을 다시 찾는 간격(초). 대표 사진은 자주 바뀌지 않는다 */
export const TOUR_PHOTO_SECONDS = 7 * 24 * 3600;

/** 사진 출처(화면이 언어에 맞춰 적는다: messages PlaceSheet.photoSources) */
export type PhotoSource = PlacePhotoSource;

/** GET /api/tour/photo 응답. 찾지 못하면 { empty: true } */
export type TourPhoto = {
  src: string;
  source: PhotoSource;
  author?: string;
  license?: string;
};

/** 제목 정규화(PoC strip · norm): 대괄호 태그 · 괄호 병기(전각 · 반각, 겹친 것 3단계까지)를 빼고 공백 · 가운뎃점을 지운다 */
export function photoName(value: unknown): string {
  let t = String(value ?? "").replace(/\[[^\]]*\]/g, " ");
  for (let i = 0; i < 3; i++) t = t.replace(/[（(][^（()）]*[）)]/g, " ");
  return t
    .replace(/[（()）]/g, " ")
    .replace(/[\s·]/g, "")
    .toLowerCase();
}

/** 두 좌표 사이 거리(km) */
function km(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) *
      Math.cos(lat2 * r) *
      Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** 숙박(32) · 쇼핑(39)은 대표 사진으로 쓰지 않는다(PoC BAD) */
const BAD_TYPES = new Set(["32", "39"]);
/** 여행코스(25) · 레포츠 코스(28)는 코스 사진이라 뺀다(PoC COURSE) */
const COURSE_TYPES = new Set(["25", "28"]);
/** 유형 순위: 관광지 12 · 문화시설 14 · 레포츠 28이 먼저, 음식점 38 다음, 코스 · 축제는 뒤(PoC RANK). 표에 없으면 2 */
const TYPE_RANK: Readonly<Record<string, number>> = {
  "12": 0,
  "14": 0,
  "28": 0,
  "38": 1,
  "25": 9,
  "15": 9,
};

/**
 * TourAPI 검색 결과에서 대표 사진 하나 고르기(PoC tourTry score, 국문):
 * 제목이 이름과 같으면 0 · 이름으로 끝나면 1 · 이름으로 시작하면 2, 아니면 후보가 아니다.
 * 같지 않은데 제목이 8글자보다 더 길면 뺀다. 거리는 같은 이름 12km · 나머지 3km 이내.
 * 순서: 이름 점수 → 유형 순위 → 거리
 */
export function pickTourImage(
  items: readonly TourItem[],
  place: Pick<TourPlace, "ko" | "lat" | "lng">,
): string | null {
  const key = photoName(place.ko);
  if (!key) return null;
  const scored = items.flatMap((x) => {
    const src = String(x.firstimage ?? "");
    const ct = String(x.contenttypeid ?? "");
    if (!src || BAD_TYPES.has(ct) || COURSE_TYPES.has(ct)) return [];
    if (/코스|~/.test(String(x.title ?? "").replace(/\[[^\]]*\]/g, "")))
      return [];
    const t = photoName(x.title);
    const r = t === key ? 0 : t.endsWith(key) ? 1 : t.startsWith(key) ? 2 : -1;
    if (r < 0) return [];
    if (r > 0 && t.length - key.length > 8) return [];
    const lat = Number(x.mapy);
    const lng = Number(x.mapx);
    const d =
      place.lat && Number.isFinite(lat) && Number.isFinite(lng) && lat && lng
        ? km(place.lat, place.lng, lat, lng)
        : 0;
    if (d > (r === 0 ? 12 : 3)) return [];
    return [{ src, r, c: TYPE_RANK[ct] ?? 2, d }];
  });
  scored.sort((a, b) => a.r - b.r || a.c - b.c || a.d - b.d);
  return scored[0]?.src ?? null;
}

/** 관광사진 검색 결과에서 고르기(PoC galleryTry): 제목이 같은 사진, 없으면 서로 품는 사진 */
export function pickGalleryImage(
  items: readonly TourItem[],
  name: string,
): string | null {
  const norm = (v: unknown) => String(v ?? "").replace(/[\s·()（）]/g, "");
  const key = norm(name);
  if (key.length < 2) return null;
  const withUrl = items.filter((x) => String(x.galWebImageUrl ?? ""));
  const pick =
    withUrl.find((x) => norm(x.galTitle) === key) ??
    withUrl.find((x) => {
      const t = norm(x.galTitle);
      return t.length >= 2 && (t.includes(key) || key.includes(t));
    });
  return pick ? String(pick.galWebImageUrl) : null;
}

/** 위키백과 요약 응답의 대표 이미지. 지도 · 로고가 많은 SVG는 쓰지 않는다. 800px 썸네일로 바꾼다(PoC tryOne) */
export function pickWikiImage(body: unknown): string | null {
  const b = body as {
    originalimage?: { source?: unknown };
    thumbnail?: { source?: unknown };
  } | null;
  const src = String(b?.originalimage?.source ?? b?.thumbnail?.source ?? "");
  if (!src || /\.svg(\.png)?$/i.test(src)) return null;
  return src.replace(/\/\d+px-/, "/800px-");
}

/** http 사진 주소를 https로(한국관광공사 tong.visitkorea.or.kr는 https도 준다). https가 아니면 null */
export function httpsPhoto(src: string): string | null {
  const s = src.trim().replace(/^http:\/\//i, "https://");
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : null;
}

/** 위키백과 요약 주소(제목은 괄호를 뗀 이름도 시도한다) */
export function wikiSummaryUrl(title: string): string {
  return `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
}

async function wikiPhoto(place: TourPlace): Promise<string | null> {
  const titles = [
    ...new Set(
      [place.ko, place.ko.replace(/\s*\(.*\)/, "").trim()].filter(Boolean),
    ),
  ];
  for (const title of titles) {
    try {
      const res = await fetch(wikiSummaryUrl(title), {
        signal: AbortSignal.timeout(TOUR_TIMEOUT_MS),
        next: { revalidate: TOUR_PHOTO_SECONDS },
      });
      if (!res.ok) continue;
      const src = pickWikiImage(await res.json());
      if (src) return src;
    } catch {
      // 다음 제목으로
    }
  }
  return null;
}

/** 위키미디어 공용 좌표 검색 반경(m)과 후보 수 */
export const COMMONS_RADIUS_M = 300;
const COMMONS_LIMIT = 30;

/** 위키미디어 공용 좌표 검색 주소(파일 이름공간 6, 800px 썸네일 · 작성자 · 라이선스) */
export function commonsUrl(lat: number, lng: number): string {
  const q = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    generator: "geosearch",
    ggscoord: `${lat}|${lng}`,
    ggsradius: String(COMMONS_RADIUS_M),
    ggslimit: String(COMMONS_LIMIT),
    ggsnamespace: "6",
    prop: "imageinfo|coordinates",
    iiprop: "url|extmetadata",
    iiurlwidth: "800",
    iiextmetadatafilter: "Artist|LicenseShortName",
  });
  return `https://commons.wikimedia.org/w/api.php?${q}`;
}

/** HTML 태그를 뺀 짧은 글(작성자 칸은 링크 HTML로 온다) */
const plainText = (v: unknown) =>
  String(v ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

type CommonsPage = {
  title?: string;
  index?: number;
  coordinates?: { lat?: number; lon?: number }[];
  imageinfo?: {
    thumburl?: string;
    url?: string;
    extmetadata?: Record<string, { value?: unknown }>;
  }[];
};

/**
 * 위키미디어 공용 좌표 검색 결과에서 사진 하나 고르기.
 * 파일 이름(「File:」 · 확장자 뺌)에 장소 한국어 이름(2글자 이상) 또는 영어 이름(4글자 이상)이 들어 있어야 한다.
 * 사진(jpg · jpeg · png · webp)만, 지도 · 로고 · 도면은 뺀다. 가까운 순(없으면 검색 순)
 */
export function pickCommonsImage(
  body: unknown,
  place: Pick<TourPlace, "ko" | "en" | "lat" | "lng">,
): Omit<TourPhoto, "source"> | null {
  const pages = ((body as { query?: { pages?: CommonsPage[] } } | null)?.query
    ?.pages ?? []) as CommonsPage[];
  const ko = photoName(place.ko);
  const en = photoName(place.en ?? "").replace(/[^a-z0-9]/g, "");
  const scored = pages.flatMap((p) => {
    const title = String(p.title ?? "").replace(/^File:/i, "");
    if (!/\.(jpe?g|png|webp)$/i.test(title)) return [];
    const base = title.replace(/\.[a-z]+$/i, "");
    if (/map|logo|plan|diagram|지도|로고|도면|배치도/i.test(base)) return [];
    const t = photoName(base);
    const tEn = t.replace(/[^a-z0-9]/g, "");
    const hit =
      (ko.length >= 2 && t.includes(ko)) ||
      (en.length >= 4 && tEn.includes(en));
    if (!hit) return [];
    const info = p.imageinfo?.[0];
    const src = String(info?.thumburl ?? info?.url ?? "");
    if (!src) return [];
    const c = p.coordinates?.[0];
    const d =
      c && Number.isFinite(c.lat) && Number.isFinite(c.lon)
        ? km(place.lat, place.lng, Number(c.lat), Number(c.lon))
        : 1e9;
    const meta = info?.extmetadata ?? {};
    return [
      {
        src,
        d,
        i: p.index ?? 0,
        author: plainText(meta.Artist?.value) || undefined,
        license: plainText(meta.LicenseShortName?.value) || undefined,
      },
    ];
  });
  scored.sort((a, b) => a.d - b.d || a.i - b.i);
  const best = scored[0];
  return best
    ? { src: best.src, author: best.author, license: best.license }
    : null;
}

async function commonsPhoto(
  place: TourPlace,
): Promise<Omit<TourPhoto, "source"> | null> {
  if (!place.lat || !place.lng) return null;
  try {
    const res = await fetch(commonsUrl(place.lat, place.lng), {
      signal: AbortSignal.timeout(TOUR_TIMEOUT_MS),
      next: { revalidate: TOUR_PHOTO_SECONDS },
    });
    if (!res.ok) return null;
    return pickCommonsImage(await res.json(), place);
  } catch {
    return null;
  }
}

/** 카카오 REST API 키(서버 전용). 없으면 null */
export function kakaoRestKey(): string | null {
  const key = process.env.KAKAO_REST_KEY?.trim();
  return key ? key : null;
}

/** 카카오 이미지 검색 주소(정확도순 10장) */
export function kakaoImageUrl(query: string): string {
  const q = new URLSearchParams({ query, sort: "accuracy", size: "10" });
  return `https://dapi.kakao.com/v2/search/image?${q}`;
}

/** 카카오 이미지 검색에서 장소 사진으로 쓸 최소 크기(px) */
const KAKAO_MIN_W = 500;
const KAKAO_MIN_H = 300;

/**
 * 카카오 이미지 검색 결과에서 하나 고르기: https 사진 주소, 가로 500 · 세로 300px 이상, 가로가 세로의 3배를 넘지 않는 첫째(정확도순).
 * 출처는 사이트 이름(display_sitename)
 */
export function pickKakaoImage(
  body: unknown,
): Omit<TourPhoto, "source"> | null {
  const docs = ((body as { documents?: unknown[] } | null)?.documents ??
    []) as {
    image_url?: unknown;
    width?: unknown;
    height?: unknown;
    display_sitename?: unknown;
  }[];
  for (const d of docs) {
    const src = String(d.image_url ?? "");
    const w = Number(d.width);
    const h = Number(d.height);
    if (!/^https:\/\//i.test(src) || /\.(svg|gif)(\?|$)/i.test(src)) continue;
    if (!(w >= KAKAO_MIN_W && h >= KAKAO_MIN_H && w <= h * 3)) continue;
    const site = plainText(d.display_sitename);
    return { src, ...(site ? { author: site } : {}) };
  }
  return null;
}

/** 카카오 로컬 키워드 검색 주소(좌표 반경 500m, 가까운 순 15곳) */
export const KAKAO_PLACE_RADIUS_M = 500;
export function kakaoLocalUrl(query: string, lat: number, lng: number): string {
  const q = new URLSearchParams({
    query,
    x: String(lng),
    y: String(lat),
    radius: String(KAKAO_PLACE_RADIUS_M),
    sort: "distance",
    size: "15",
  });
  return `https://dapi.kakao.com/v2/local/search/keyword.json?${q}`;
}

/** 카카오맵 장소 정보(대표 사진이 든 JSON) 주소 */
export function kakaoPlaceInfoUrl(id: string): string {
  return `https://place.map.kakao.com/main/v/${encodeURIComponent(id)}`;
}

export type KakaoPlace = { id: string; name: string; dong: string };

/**
 * 카카오 로컬 검색 결과에서 같은 장소 고르기: 이름(괄호 · 공백 뺌)이 서로를 품고(2글자 이상), 거리 500m 이내, 가까운 순 첫째.
 * dong: 지번 주소의 읍면동(이미지 검색을 좁힐 때)
 */
export function pickKakaoPlace(body: unknown, name: string): KakaoPlace | null {
  const docs = ((body as { documents?: unknown[] } | null)?.documents ??
    []) as {
    id?: unknown;
    place_name?: unknown;
    distance?: unknown;
    address_name?: unknown;
  }[];
  const key = photoName(name);
  if (key.length < 2) return null;
  const hits = docs
    .map((d) => ({
      id: String(d.id ?? ""),
      name: String(d.place_name ?? ""),
      d: Number(d.distance),
      addr: String(d.address_name ?? ""),
    }))
    .filter((d) => {
      const t = photoName(d.name);
      return (
        d.id &&
        t.length >= 2 &&
        (t.includes(key) || key.includes(t)) &&
        Number.isFinite(d.d) &&
        d.d <= KAKAO_PLACE_RADIUS_M
      );
    })
    .sort((a, b) => a.d - b.d);
  const h = hits[0];
  if (!h) return null;
  const dong =
    h.addr.split(/\s+/).find((w) => /[읍면동가리]$/.test(w) && w.length >= 2) ??
    "";
  return { id: h.id, name: h.name, dong };
}

/** 카카오맵 장소 정보 JSON의 대표 사진(basicInfo.mainphotourl). https만 */
export function pickKakaoMapPhoto(body: unknown): string | null {
  const src = String(
    (body as { basicInfo?: { mainphotourl?: unknown } } | null)?.basicInfo
      ?.mainphotourl ?? "",
  );
  return httpsPhoto(src);
}

async function kakaoGet(url: string, key?: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      ...(key ? { headers: { Authorization: `KakaoAK ${key}` } } : {}),
      signal: AbortSignal.timeout(TOUR_TIMEOUT_MS),
      next: { revalidate: TOUR_PHOTO_SECONDS },
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** ⑥ 카카오맵 기반 사진. 카카오맵에서 같은 장소를 못 찾으면 null */
async function kakaoPhoto(place: TourPlace): Promise<TourPhoto | null> {
  const key = kakaoRestKey();
  if (!key || !place.lat || !place.lng) return null;
  const name = place.ko.replace(/\s*\(.*?\)\s*/g, "").trim();
  if (name.length < 2) return null;
  const kp = pickKakaoPlace(
    await kakaoGet(kakaoLocalUrl(name, place.lat, place.lng), key),
    name,
  );
  if (!kp) return null;
  const main = pickKakaoMapPhoto(await kakaoGet(kakaoPlaceInfoUrl(kp.id)));
  if (main) return { src: main, source: "kakaomap" };
  const img = pickKakaoImage(
    await kakaoGet(
      kakaoImageUrl(kp.dong ? `${kp.name} ${kp.dong}` : kp.name),
      key,
    ),
  );
  const src = httpsPhoto(img?.src ?? "");
  return src && img
    ? { src, source: "kakao", ...(img.author ? { author: img.author } : {}) }
    : null;
}

// ── ⑤ 국가유산청 ─────────────────────────────────────────────────

/** 국가유산청 오픈 API 주인(키 없음) */
const KHS = "https://www.khs.go.kr/cha";
/** 국가유산청: 좌표가 있을 때 장소와 국가유산 사이 최대 거리(km) */
const KHS_MAX_KM = 2;

/** 국가유산 이름 검색 주소 */
export function khsListUrl(name: string): string {
  const q = new URLSearchParams({
    ccbaMnm1: name,
    pageUnit: "20",
    pageIndex: "1",
  });
  return `${KHS}/SearchKindOpenapiList.do?${q}`;
}

/** 국가유산 이미지 주소(종목 · 지정번호 · 시도 코드) */
export function khsImageUrl(kdcd: string, asno: string, ctcd: string): string {
  const q = new URLSearchParams({
    ccbaKdcd: kdcd,
    ccbaAsno: asno,
    ccbaCtcd: ctcd,
  });
  return `${KHS}/SearchImageOpenapi.do?${q}`;
}

/** XML 조각에서 태그 값(CDATA 포함). 없으면 빈 값 */
function xmlTag(xml: string, tag: string): string {
  const m = xml.match(
    new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`),
  );
  return m ? m[1].trim() : "";
}
const xmlItems = (xml: string) => xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

export type KhsHeritage = {
  kdcd: string;
  asno: string;
  ctcd: string;
  name: string;
};

/** 국가유산 검색 결과(XML)에서 같은 장소 고르기: 이름이 서로를 품고, 좌표가 있으면 2km 안, 가까운 순(좌표 없으면 검색 순) */
export function pickKhsHeritage(
  xml: string,
  place: Pick<TourPlace, "ko" | "lat" | "lng">,
): KhsHeritage | null {
  const key = photoName(place.ko);
  if (key.length < 2) return null;
  const hits = xmlItems(xml).flatMap((it, i) => {
    const name = xmlTag(it, "ccbaMnm1");
    const t = photoName(name);
    if (t.length < 2 || !(t.includes(key) || key.includes(t))) return [];
    const lat = Number(xmlTag(it, "latitude"));
    const lng = Number(xmlTag(it, "longitude"));
    const d =
      lat && lng && place.lat ? km(place.lat, place.lng, lat, lng) : null;
    if (d !== null && d > KHS_MAX_KM) return [];
    return [
      {
        kdcd: xmlTag(it, "ccbaKdcd"),
        asno: xmlTag(it, "ccbaAsno"),
        ctcd: xmlTag(it, "ccbaCtcd"),
        name,
        d: d ?? 1e6 + i,
      },
    ];
  });
  hits.sort((a, b) => a.d - b.d);
  const h = hits.find((x) => x.kdcd && x.asno && x.ctcd);
  return h ? { kdcd: h.kdcd, asno: h.asno, ctcd: h.ctcd, name: h.name } : null;
}

/** 국가유산 이미지 결과(XML)의 첫 사진 주소(https로) */
export function pickKhsImage(xml: string): string | null {
  for (const v of xml.match(/<imageUrl>[\s\S]*?<\/imageUrl>/g) ?? []) {
    const src = httpsPhoto(xmlTag(v, "imageUrl"));
    if (src && !/\.svg(\?|$)/i.test(src)) return src;
  }
  return null;
}

async function getText(
  url: string,
  init: RequestInit = {},
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TOUR_TIMEOUT_MS),
      ...(init.cache ? {} : { next: { revalidate: TOUR_PHOTO_SECONDS } }),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** ⑤ 국가유산청 사진(국가유산 장소만) */
async function khsPhoto(place: TourPlace): Promise<string | null> {
  if (place.cat !== "herit") return null;
  const name = place.ko.replace(/\s*\(.*?\)\s*/g, "").trim();
  if (name.length < 2) return null;
  const list = await getText(khsListUrl(name));
  const h = list ? pickKhsHeritage(list, place) : null;
  if (!h) return null;
  const img = await getText(khsImageUrl(h.kdcd, h.asno, h.ctcd));
  return img ? pickKhsImage(img) : null;
}

/** 장소의 대표 사진을 찾는다. 공공데이터포털 실패는 다음 단계로 넘어간다(한 곳이 막혀도 위키백과 · 위키미디어 공용 · 국가유산청 · 카카오맵까지 본다) */
export async function findPhoto(
  place: TourPlace,
  key: string | null,
): Promise<TourPhoto | null> {
  // 신규 관광지(kto:)는 한국관광공사 대표 이미지를 이미 갖고 있다
  const own = httpsPhoto(place.photo ?? "");
  if (own) return { src: own, source: "kto" };
  const name = place.ko.replace(/\s*\(.*?\)\s*/g, "").trim();
  if (key && name.length >= 2) {
    try {
      const items = await fetchTourItems(
        tourApiUrl("KorService2/searchKeyword2", key, {
          numOfRows: "20",
          pageNo: "1",
          arrange: "A",
          keyword: place.ko,
        }),
        TOUR_PHOTO_SECONDS,
      );
      const src = httpsPhoto(pickTourImage(items, place) ?? "");
      if (src) return { src, source: "kto" };
    } catch {
      // 관광사진으로
    }
    try {
      const items = await fetchTourItems(
        tourApiUrl("PhotoGalleryService1/gallerySearchList1", key, {
          numOfRows: "20",
          pageNo: "1",
          arrange: "A",
          keyword: place.ko,
        }),
        TOUR_PHOTO_SECONDS,
      );
      const src = httpsPhoto(pickGalleryImage(items, place.ko) ?? "");
      if (src) return { src, source: "ktoGallery" };
    } catch {
      // 위키백과로
    }
  }
  const wiki = httpsPhoto((await wikiPhoto(place)) ?? "");
  if (wiki) return { src: wiki, source: "wikipedia" };
  const commons = await commonsPhoto(place);
  const src = httpsPhoto(commons?.src ?? "");
  if (src && commons)
    return {
      src,
      source: "commons",
      ...(commons.author ? { author: commons.author } : {}),
      ...(commons.license ? { license: commons.license } : {}),
    };
  const khs = await khsPhoto(place);
  if (khs) return { src: khs, source: "khs" };
  return kakaoPhoto(place);
}

/** GET /api/tour/photo 처리. 응답 { src, source, author?, license? } · 못 찾으면 { empty: true }. 키가 없어도 위키백과 · 위키미디어 공용은 본다(카카오는 KAKAO_REST_KEY가 있을 때) */
export async function tourPhotoResponse(request: Request): Promise<Response> {
  const query = await parseTourQuery(request, false);
  if ("error" in query) return query.error;
  const photo = await findPhoto(query.place, tourApiKey());
  return tourJson(photo ?? { empty: true }, TOUR_PHOTO_SECONDS);
}
