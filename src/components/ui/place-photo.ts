// 장소 시트가 부르는 대표 사진(GET /api/tour/photo)의 응답 타입과 캐시 값. 서버 쪽 찾기 규칙은 lib/tour-photo.ts(서버 전용)에 있고,
// 클라이언트는 이 파일만 import한다(서버 전용 모듈에 닿지 않게, lib/tour-api.test.ts).

/** 사진 출처(messages PlaceSheet.photoSources) */
export type PlacePhotoSource =
  "kto" | "ktoGallery" | "wikipedia" | "commons" | "khs" | "kakaomap" | "kakao";

/** GET /api/tour/photo 응답 */
export type PlacePhotoResponse =
  | {
      src: string;
      source: PlacePhotoSource;
      /** 위키미디어 공용 사진의 작성자 · 라이선스(표시 의무), 카카오 이미지 검색 사진의 원 사이트 이름. 다른 출처는 없다 */
      author?: string;
      license?: string;
    }
  | { empty: true };

/** 호출 시간 제한(ms). 서버가 최대 여섯 곳(관광정보 · 관광사진 · 위키백과 · 위키미디어 공용 · 국가유산청 · 카카오맵)을 차례로 부른다 */
export const PHOTO_TIMEOUT_MS = 30000;
/** 한 번 찾은 사진은 하루 동안 다시 부르지 않는다(서버는 7일 캐시) */
export const PHOTO_STALE_MS = 24 * 3600 * 1000;
