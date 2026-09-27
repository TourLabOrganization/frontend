// 두 점 사이 길찾기 새 창 주소(코스 탭 「도착 후」 구간, PoC arrOpen).
// 한국어는 카카오맵 길찾기(공식 형식 https://map.kakao.com/link/from/이름,위도,경도/to/이름,위도,경도),
// 그 밖의 언어는 Google 지도 길찾기(PoC arrOpen 주소, 언어 hl은 숙소 지도 검색과 같은 규칙: zh → zh-CN, 모르는 언어는 en)

type NamedPoint = { name: string; lat: number; lng: number };

const kakaoLabel = (p: NamedPoint) =>
  `${encodeURIComponent(p.name.replace(/,/g, " "))},${p.lat},${p.lng}`;

export function directionsBetweenUrl(
  from: NamedPoint,
  to: NamedPoint,
  mode: "transit" | "driving",
  locale: string,
): string {
  if (locale === "ko")
    return `https://map.kakao.com/link/from/${kakaoLabel(from)}/to/${kakaoLabel(to)}`;
  const hl0 = locale === "zh" ? "zh-CN" : locale;
  const hl = ["en", "zh-CN", "ja", "es"].includes(hl0) ? hl0 : "en";
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=${mode}&hl=${hl}`;
}
