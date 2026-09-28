import { api } from "./client";

// 한국관광 데이터랩 조회(TFI · 체류시간)와 코스 지역. 테마 화면(여행 정보 탭 features/theme/DatalabSection)이 쓴다.
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
 * 데이터랩 지역 id(messages Datalab.regions 키) → API 지역 이름.
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

/** API 지역 이름 → 지역 id. 모르는 지역이면 undefined */
export function datalabRegionId(name: string): DatalabRegionId | undefined {
  return DATALAB_REGION_IDS.find((id) => DATALAB_REGIONS[id] === name);
}

// 공개 조회 공통 옵션: 토큰 없음 · 시간 제한 · 1시간마다 다시 받기
const datalabInit = () => ({
  auth: false,
  signal: AbortSignal.timeout(API_TIMEOUT_MS),
  next: { revalidate: DATALAB_REVALIDATE_SECONDS },
});

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const text = (v: unknown): string =>
  typeof v === "string" ? v : isNum(v) ? String(v) : "";
const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);

// 응답 모양 검사. 화면이 쓰는 필드(배열 · 객체)가 틀리면 null이고, 부르는 함수가 실패로 던진다.
// 없어도 되는 필드는 빈 값으로 채운다. 백엔드 응답이 조금 달라도 페이지 전체가 500이 되지 않게 한다

/** TFI 응답 검사. themes(문자열 배열) · tfi(지역 → 테마 → 숫자 객체)가 틀리면 null */
export function parseTfi(data: unknown): TfiResponse | null {
  if (!isObject(data) || !Array.isArray(data.themes) || !isObject(data.tfi))
    return null;
  const tfi: Record<string, Record<string, number>> = {};
  for (const [region, row] of Object.entries(data.tfi)) {
    if (!isObject(row)) return null;
    tfi[region] = Object.fromEntries(
      Object.entries(row).filter((e): e is [string, number] => isNum(e[1])),
    );
  }
  const labels: Record<string, string> = {};
  if (isObject(data.themeLabels)) {
    for (const [k, v] of Object.entries(data.themeLabels))
      if (typeof v === "string") labels[k] = v;
  }
  return {
    themes: strings(data.themes),
    themeLabels: labels,
    regions: strings(data.regions),
    tfi,
  };
}

/** 체류시간 응답 검사. regions(배열, 행마다 region 문자열 · stayMinutes · index 숫자)가 틀리면 null */
export function parseStayTime(data: unknown): StayTimeResponse | null {
  if (!isObject(data) || !Array.isArray(data.regions)) return null;
  const regions: StayTimeRegionResponse[] = [];
  for (const r of data.regions as unknown[]) {
    if (
      !isObject(r) ||
      typeof r.region !== "string" ||
      !isNum(r.stayMinutes) ||
      !isNum(r.index)
    )
      return null;
    regions.push({
      region: r.region,
      tier: text(r.tier),
      subUnits: isNum(r.subUnits) ? r.subUnits : 0,
      subUnitNames: strings(r.subUnitNames),
      stayMinutes: r.stayMinutes,
      lodgingDays: isNum(r.lodgingDays) ? r.lodgingDays : 0,
      index: r.index,
      appPlaces: isNum(r.appPlaces) ? r.appPlaces : 0,
      appStayMinSum: numOrNull(r.appStayMinSum),
      appStayMinMean: numOrNull(r.appStayMinMean),
      visitsToSeeAll: numOrNull(r.visitsToSeeAll),
    });
  }
  return {
    latestYear: text(data.latestYear),
    source: text(data.source),
    regions,
  };
}

/** 코스 목록 응답 검사. courses(배열, 코스마다 courseId 문자열)가 틀리면 null. 코스의 regions가 없으면 빈 배열 */
export function parseCourseList(data: unknown): CourseListResponse | null {
  if (!isObject(data) || !Array.isArray(data.courses)) return null;
  const courses: CourseResponse[] = [];
  for (const c of data.courses as unknown[]) {
    if (!isObject(c) || typeof c.courseId !== "string") return null;
    courses.push({
      courseId: c.courseId,
      title: text(c.title),
      file: text(c.file),
      regions: strings(c.regions),
      count: isNum(c.count) ? c.count : 0,
      stayMinSum: isNum(c.stayMinSum) ? c.stayMinSum : 0,
    });
  }
  return { count: isNum(data.count) ? data.count : courses.length, courses };
}

/** 받은 값을 검사하고, 모양이 틀리면 던진다(부르는 쪽의 .catch · try가 실패 문구로 바꾼다) */
async function checked<T>(
  path: string,
  parse: (data: unknown) => T | null,
): Promise<T> {
  const parsed = parse(await api<unknown>(path, datalabInit()));
  if (parsed === null) throw new Error(`Unexpected response: ${path}`);
  return parsed;
}

// 지역 없이 전체를 받아 쓰는 쪽에서 고른다. 예전에 /api/v1/tfi?region=…이 502였다(2026-09-28 백엔드 수정으로 해결, docs/api.md)
export function getTfi(): Promise<TfiResponse> {
  return checked("/api/v1/tfi", parseTfi);
}

export function getStayTime(): Promise<StayTimeResponse> {
  return checked("/api/v1/staytime", parseStayTime);
}

export function getCourses(): Promise<CourseListResponse> {
  return checked("/api/v1/courses?withPlaces=false", parseCourseList);
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

/** 여행 정보 탭 데이터랩 블록의 지역 한 줄: TFI 막대 · 체류시간 행 */
export type DatalabRow = {
  region: string;
  bars: TfiBar[];
  stay: StayTimeRegionResponse;
};

/**
 * 테마 코스(courseId)가 지나는 지역 중 TFI · 체류시간이 모두 있는 지역마다 막대와 체류시간 행을 묶는다(코스 순서 그대로).
 * 코스가 없거나 맞는 지역이 없으면 빈 배열
 */
export function datalabRows(
  courseId: string,
  courses: CourseListResponse,
  tfi: TfiResponse,
  stay: StayTimeResponse,
): DatalabRow[] {
  const course = courses.courses.find((c) => c.courseId === courseId);
  return datalabRegionsOfCourse(course, tfi, stay).flatMap((region) => {
    const row = stay.regions.find((s) => s.region === region);
    return row ? [{ region, bars: tfiBars(tfi, region) ?? [], stay: row }] : [];
  });
}
