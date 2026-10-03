import {
  canonicalPlaceId,
  findPlace,
  isPlannerPlace,
  type PlannerPlace,
} from "./data";
import { extraPlace } from "./extra-places";

// 앱 장소(places.json)와 브라우저가 기억해 둔 신규 관광지(extra-places.ts)를 함께 찾는다. 코스 탭 · 코스 담기가 쓴다

/** 앱 장소 또는 기억해 둔 신규 관광지 */
export function findAnyPlace(id: string): PlannerPlace | undefined {
  return findPlace(id) ?? extraPlace(id);
}

/** 코스에 남길 수 있는 id인지(앱 장소 · 기억해 둔 신규 관광지). 담은 코스에서 모르는 장소를 거를 때 쓴다 */
export function isKnownPlace(id: string): boolean {
  return isPlannerPlace(id) || extraPlace(id) !== undefined;
}

/** 코스에 남길 id. 합쳐서 뺀 옛 id는 남긴 장소 id로 바꾼다(place-aliases.json), 신규 관광지 id는 그대로 */
export function canonicalKnownId(id: string): string {
  return canonicalPlaceId(id);
}
