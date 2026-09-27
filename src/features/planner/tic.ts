// 투어 플래너 여행 정보 탭 「관광안내소」의 순수 함수. 규칙은 PoC Tour Planner.dc.html의 관광안내소 블록
// (ticTitle · ticMeta · ticFlt · ticList · ticMore)을 그대로 옮겼다.
// 데이터는 data/tic.json(scripts/build-tic.mjs가 PoC data/tic.json으로 만든다. 손으로 고치지 않는다)

export type InfoCenter = {
  /** 안내소명(원천 한국어) */
  name: string;
  /** 시군(한국어 도시 이름, 플래너 도시 key와 같다) */
  city: string;
  lat: number;
  lng: number;
  /** 전화(원천 문자열). 없으면 "" */
  tel: string;
  /** 운영시간 원문 */
  hours: string;
  /** 휴무 원문 */
  closed: string;
  /** 외국어 원문(「영/일/중」). 없으면 "" */
  lang: string;
  /** 주소 원문 */
  addr: string;
};

/** 안내 언어 코드(PoC LANG 값) */
export type GuideLang = "EN" | "JP" | "CN" | "RU" | "VN" | "TH";

// PoC LANG. 원문 외국어 칸의 낱말 → 언어 코드. 표에 없는 낱말(한 · 태 · 말 · 스 · 폐쇄 …)은 버린다
const LANG: Readonly<Record<string, GuideLang>> = {
  영: "EN",
  영어: "EN",
  일: "JP",
  일본어: "JP",
  중: "CN",
  중국어: "CN",
  중간: "CN",
  중번: "CN",
  러: "RU",
  러시아어: "RU",
  베트남어: "VN",
  태국어: "TH",
};

/** 외국어 원문 → 안내 언어 코드(PoC langOf). 「/ , · 공백」으로 나누고 겹치면 한 번만. 원문 순서 */
export function langsOf(raw: string): GuideLang[] {
  const out: GuideLang[] = [];
  for (const part of raw.split(/[/,·\s]+/)) {
    const code = LANG[part];
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

/** 화면 언어 → 「내 언어」 안내 코드(PoC mine). 스페인어는 영어 안내. 한국어는 없음(null) */
export function mineOf(locale: string): GuideLang | null {
  return (
    (
      { en: "EN", es: "EN", ja: "JP", zh: "CN" } as Record<
        string,
        GuideLang | undefined
      >
    )[locale] ?? null
  );
}

/** 코드 포인트 순서 비교. PoC는 localeCompare('ko')지만 서버와 브라우저의 Intl 차이로 하이드레이션이 어긋나지 않게 쓰지 않는다 */
function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

const isRestArea = (c: Pick<InfoCenter, "name">) => /휴게소/.test(c.name);

/**
 * 한 도시의 관광안내소 목록(PoC ticList 앞부분).
 * onlyMine이면 내 언어 안내가 있는 곳만. 정렬: 내 언어 안내 가능 → 휴게소 안내소는 뒤로 → 이름 가나다
 */
export function cityInfoCenters<T extends InfoCenter>(
  all: readonly T[],
  city: string,
  mine: GuideLang | null,
  onlyMine = false,
): T[] {
  const has = (c: T) => mine !== null && langsOf(c.lang).includes(mine);
  let list = all.filter((c) => c.city === city);
  if (onlyMine && mine) list = list.filter(has);
  return list.sort(
    (a, b) =>
      Number(has(b)) - Number(has(a)) ||
      Number(isRestArea(a)) - Number(isRestArea(b)) ||
      compare(a.name, b.name),
  );
}

/** 그 도시에서 내 언어 안내가 있는 곳 수(PoC nMine). 한국어 화면은 0 */
export function mineCount(
  all: readonly InfoCenter[],
  city: string,
  mine: GuideLang | null,
): number {
  if (!mine) return 0;
  return all.filter((c) => c.city === city && langsOf(c.lang).includes(mine))
    .length;
}

/** 전화 링크(PoC telHref: 숫자만 남긴다) */
export function telHref(tel: string): string {
  return `tel:${tel.replace(/[^\d]/g, "")}`;
}

/** 카카오맵 지도 링크(PoC map: 이름 · 위도 · 경도) */
export function kakaoMapLink(c: Pick<InfoCenter, "name" | "lat" | "lng">) {
  return `https://map.kakao.com/link/map/${encodeURIComponent(c.name)},${c.lat},${c.lng}`;
}

/** 처음 보이는 수와 「더 보기」 한 번에 더 보이는 수(PoC ticLimit 6 · +10) */
export const TIC_INITIAL = 6;
export const TIC_STEP = 10;
