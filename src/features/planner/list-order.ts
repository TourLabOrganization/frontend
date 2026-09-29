import type { PlannerPlace } from "./data";

// 플래너 장소 목록 순서. 대표 결정(2026-09-28, 팀 요청 「자주 방문한 순위로」): 「인기 먼저 + 나머지 가나다」.
//  - 도시 안: 데이터랩 인기관광지 순위(popRank)가 있는 곳을 순위 오름차순으로 먼저, 나머지는 이름순. 같은 순위는 이름순
//  - 전국: 도시 이름순 → 도시 안에서 위와 같다
// data-server 문서는 popRank로 정렬하지 말라고 권한다(6개 지역 173곳만 값이 있어 나머지가 한 덩어리로 밀린다).
// 그래서 순위는 정렬 키가 아니라 「앞에 세우는 표시」로만 쓰고, 순위 없는 곳은 지금처럼 이름순을 지킨다

/** 코드 포인트 순서 비교. 서버와 브라우저의 Intl 차이로 하이드레이션이 어긋나지 않게 Collator를 쓰지 않는다 */
export function compareText(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

type SortOptions<P> = {
  /** 전국 목록이면 도시 이름으로 먼저 묶는다 */
  nation: boolean;
  /** 화면 언어의 장소 이름 */
  name: (p: P) => string;
  /** 화면 언어의 도시 이름 */
  city: (p: P) => string;
};

/** 인기 먼저 + 나머지 이름순. 원래 배열은 바꾸지 않는다 */
export function sortPlaces<P extends Pick<PlannerPlace, "popRank">>(
  places: readonly P[],
  { nation, name, city }: SortOptions<P>,
): P[] {
  const rank = (p: P) => p.popRank ?? Number.POSITIVE_INFINITY;
  return [...places].sort(
    (a, b) =>
      (nation ? compareText(city(a), city(b)) : 0) ||
      (rank(a) === rank(b) ? 0 : rank(a) < rank(b) ? -1 : 1) ||
      compareText(name(a), name(b)),
  );
}
