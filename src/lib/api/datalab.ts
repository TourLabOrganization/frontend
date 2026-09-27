import { api } from "./client";

// 한국관광 데이터랩 조회(TFI · 체류시간)와 코스 지역. 추천 결과 화면과 테마 화면(여행 정보 탭)이 함께 쓴다.
// 로그인 없는 공개 API라 서버 컴포넌트에서 바로 부른다(docs/api.md).
// 필드 설명은 백엔드 명세(/v3/api-docs)의 description을 옮겼다.

/** 백엔드 호출 시간 제한(ms) */
export const API_TIMEOUT_MS = 8000;
/** 자주 바뀌지 않는 조회(TFI · 체류시간 · 코스)를 다시 받는 간격(초) */
export const DATALAB_REVALIDATE_SECONDS = 3600;

/** 지역×테마 강도 지수(TFI). 데이터랩 지역별 현황에서 계산한다 */
export type TfiResponse = {
  /** 테마 키 목록 */
  themes: string[];
  /** 테마 키 → 한글 이름 */
  themeLabels: Record<string, string>;
  /** 계산된 지역 목록 */
  regions: string[];
  /** 지역 → (테마 → 0~1 강도) */
  tfi: Record<string, Record<string, number>>;
};

/** 지역 체류시간 */
export type StayTimeRegionResponse = {
  /** 지역 */
  region: string;
  /** 행정 단위 */
  tier: string;
  /** 합산한 하위 행정구역 수 */
  subUnits: number;
  /** 합산한 하위 행정구역 이름 */
  subUnitNames: string[];
  /** 방문당 체류시간(분) */
  stayMinutes: number;
  /** 숙박일수 */
  lodgingDays: number;
  /** 전국 대비 지수. 1.0이 전국 평균 */
  index: number;
  /** 앱에 등록된 장소 수 */
  appPlaces: number;
  /** 앱 장소 체류시간 합(분) */
  appStayMinSum: number | null;
  /** 앱 장소 평균 체류시간(분) */
  appStayMinMean: number | null;
  /** 앱 장소를 다 보는 데 필요한 방문 횟수 */
  visitsToSeeAll: number | null;
};

/** 지역 체류시간과 전국 대비 지수 */
export type StayTimeResponse = {
  /** 기준 연도 */
  latestYear: string;
  /** 원자료 출처 */
  source: string;
  /** 지역 목록 */
  regions: StayTimeRegionResponse[];
};

/** 영상 IP를 따라 도는 코스 (withPlaces=false로 부르므로 places는 없다) */
export type CourseResponse = {
  /** 코스 식별자 */
  courseId: string;
  /** 코스 이름 */
  title: string;
  /** 원본 프로토타입 파일 */
  file: string;
  /** 코스가 지나는 지역 */
  regions: string[];
  /** 장소 수 */
  count: number;
  /** 체류 시간 합(분) */
  stayMinSum: number;
};

/** 코스 목록 */
export type CourseListResponse = {
  /** 코스 수 */
  count: number;
  /** 코스 목록 */
  courses: CourseResponse[];
};

/**
 * 데이터랩 지역. 설문 Q15 보기 id → API 지역 이름.
 * 출처: GET /api/v1/tfi 의 regions (2026-09-27 확인: 거제 · 경주 · 부산 · 서울 · 영월 · 제주)
 */
export const DATALAB_REGIONS = {
  seoul: "서울",
  busan: "부산",
  gyeongju: "경주",
  jeju: "제주",
  geoje: "거제",
  yeongwol: "영월",
} as const;

export type DatalabRegionId = keyof typeof DATALAB_REGIONS;

export const DATALAB_REGION_IDS = Object.keys(
  DATALAB_REGIONS,
) as DatalabRegionId[];

/** API 지역 이름 → 보기 id. 모르는 지역이면 undefined */
export function datalabRegionId(name: string): DatalabRegionId | undefined {
  return DATALAB_REGION_IDS.find((id) => DATALAB_REGIONS[id] === name);
}

// 공개 조회 공통 옵션: 토큰 없음 · 시간 제한 · 1시간마다 다시 받기
const datalabInit = () => ({
  auth: false,
  signal: AbortSignal.timeout(API_TIMEOUT_MS),
  next: { revalidate: DATALAB_REVALIDATE_SECONDS },
});

// /api/v1/tfi?region=… 는 백엔드에서 502가 난다(2026-09-27). 지역 없이 전체를 받아 쓰는 쪽에서 고른다
export function getTfi(): Promise<TfiResponse> {
  return api<TfiResponse>("/api/v1/tfi", datalabInit());
}

export function getStayTime(): Promise<StayTimeResponse> {
  return api<StayTimeResponse>("/api/v1/staytime", datalabInit());
}

export function getCourses(): Promise<CourseListResponse> {
  return api<CourseListResponse>(
    "/api/v1/courses?withPlaces=false",
    datalabInit(),
  );
}

/** 한 지역의 TFI 테마 강도. 테마 순서는 TfiResponse.themes. 지역이 없으면 null */
export type TfiBar = { key: string; label: string; value: number };

export function tfiBars(tfi: TfiResponse, region: string): TfiBar[] | null {
  const row = tfi.tfi[region];
  if (!row) return null;
  return tfi.themes
    .filter((key) => typeof row[key] === "number")
    .map((key) => ({
      key,
      label: tfi.themeLabels[key] ?? key,
      value: row[key],
    }));
}

/** 코스가 지나는 지역 중 TFI · 체류시간이 모두 있는 지역(코스 순서 그대로) */
export function datalabRegionsOfCourse(
  course: CourseResponse | undefined,
  tfi: TfiResponse,
  stay: StayTimeResponse,
): string[] {
  if (!course) return [];
  return course.regions.filter(
    (r) => tfi.tfi[r] && stay.regions.some((s) => s.region === r),
  );
}
