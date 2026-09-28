import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import ko from "../../../messages/ko.json";
import { THEME_COURSE_ID } from "../../features/theme/datalab";
import {
  DATALAB_REGION_IDS,
  datalabRegionId,
  datalabRegionsOfCourse,
  datalabRows,
  parseCourseList,
  parseStayTime,
  parseTfi,
  type StayTimeResponse,
  type TfiResponse,
  tfiBars,
} from "./datalab";

// /api/v1/tfi · /api/v1/staytime 응답 일부(2026-09-27)
const TFI: TfiResponse = {
  themes: ["herit", "heal", "activity", "food"],
  themeLabels: {
    herit: "역사·문화유산",
    heal: "자연·힐링",
    activity: "체험·활동",
    food: "미식",
  },
  regions: ["거제", "경주", "영월"],
  tfi: {
    경주: { herit: 1.0, heal: 0.0, activity: 0.7078, food: 0.4674 },
    거제: { herit: 0.0, heal: 1.0, activity: 0.6538, food: 0.0 },
    영월: { herit: 0.8633, heal: 0.1179, activity: 0.9469, food: 0.617 },
  },
};

const stayRow = (region: string) => ({
  region,
  tier: "기초",
  subUnits: 1,
  subUnitNames: [],
  stayMinutes: 1222,
  lodgingDays: 2.52,
  index: 1.011,
  appPlaces: 45,
  appStayMinSum: 3200,
  appStayMinMean: 71.1,
  visitsToSeeAll: 2.62,
});

const STAY: StayTimeResponse = {
  latestYear: "2025",
  source: "전국 다운로드",
  regions: ["거제", "경주", "영월", "대전", "수원"].map(stayRow),
};

const course = (regions: string[]) => ({
  courseId: "rescene-route",
  title: "RESCENE",
  file: "",
  regions,
  count: 0,
  stayMinSum: 0,
});

describe("데이터랩", () => {
  it("TFI 막대는 테마 순서대로 이름 · 값을 낸다", () => {
    expect(tfiBars(TFI, "경주")).toEqual([
      { key: "herit", label: "역사·문화유산", value: 1.0 },
      { key: "heal", label: "자연·힐링", value: 0.0 },
      { key: "activity", label: "체험·활동", value: 0.7078 },
      { key: "food", label: "미식", value: 0.4674 },
    ]);
    expect(tfiBars(TFI, "강릉")).toBeNull();
  });

  it("코스 지역 중 TFI · 체류시간이 있는 지역만 고른다 (RESCENE → 거제 · 경주)", () => {
    expect(
      datalabRegionsOfCourse(
        course(["거제", "경주", "대전", "동해", "수원", "정선", "충주"]),
        TFI,
        STAY,
      ),
    ).toEqual(["거제", "경주"]);
    expect(datalabRegionsOfCourse(undefined, TFI, STAY)).toEqual([]);
  });

  it("지역 이름 ↔ id", () => {
    expect(datalabRegionId("영월")).toBe("yeongwol");
    expect(datalabRegionId("대전")).toBeUndefined();
  });

  it("모든 데이터랩 지역 · TFI 테마에 ko · en 문구가 있다", () => {
    for (const messages of [ko, en]) {
      for (const id of DATALAB_REGION_IDS) {
        expect(messages.Datalab.regions[id]).toBeTruthy();
      }
      for (const key of TFI.themes) {
        expect(
          (messages.Datalab.themes as Record<string, string>)[key],
        ).toBeTruthy();
      }
    }
    // ko 테마 이름은 API themeLabels 그대로다
    expect(ko.Datalab.themes).toEqual(TFI.themeLabels);
  });

  it("테마마다 백엔드 코스 id가 있다", () => {
    expect(THEME_COURSE_ID).toEqual({
      "kings-warden": "kings-warden-route",
      "kpop-demon-hunters": "kpop-demon-hunters-route",
      "rescene-route": "rescene-route",
      "jeju-k-drama": "jeju-k-drama-route",
      "busan-film-trip": "busan-cinema-route",
    });
  });
});

describe("응답 모양 검사", () => {
  it("정상 응답은 그대로 돌려준다", () => {
    expect(parseTfi(TFI)).toEqual(TFI);
    expect(parseStayTime(STAY)).toEqual(STAY);
    const list = { count: 1, courses: [course(["경주"])] };
    expect(parseCourseList(list)).toEqual(list);
  });

  it("TFI: themes · tfi가 틀리면 null, themeLabels · regions가 빠지면 빈 값", () => {
    expect(parseTfi(null)).toBeNull();
    expect(parseTfi({ ...TFI, themes: null })).toBeNull();
    expect(parseTfi({ ...TFI, tfi: null })).toBeNull();
    expect(parseTfi({ ...TFI, tfi: { 경주: null } })).toBeNull();
    expect(parseTfi({ ...TFI, tfi: [] })).toBeNull();
    expect(parseTfi({ ...TFI, themeLabels: undefined, regions: null })).toEqual(
      { ...TFI, themeLabels: {}, regions: [] },
    );
  });

  it("체류시간: regions · 행의 숫자가 틀리면 null, visitsToSeeAll은 없으면 null", () => {
    expect(parseStayTime(null)).toBeNull();
    expect(parseStayTime({ ...STAY, regions: null })).toBeNull();
    expect(parseStayTime({ ...STAY, regions: [null] })).toBeNull();
    expect(
      parseStayTime({
        ...STAY,
        regions: [{ ...stayRow("경주"), stayMinutes: null }],
      }),
    ).toBeNull();
    expect(
      parseStayTime({ ...STAY, regions: [{ ...stayRow("경주"), index: "1" }] }),
    ).toBeNull();
    const { visitsToSeeAll: _omit, ...row } = stayRow("경주");
    void _omit;
    expect(parseStayTime({ ...STAY, regions: [row] })?.regions[0]).toEqual({
      ...row,
      visitsToSeeAll: null,
    });
  });

  it("코스: courses가 틀리면 null, 코스의 regions가 빠지면 빈 배열", () => {
    expect(parseCourseList(null)).toBeNull();
    expect(parseCourseList({ count: 1, courses: null })).toBeNull();
    expect(parseCourseList({ count: 1, courses: [null] })).toBeNull();
    expect(
      parseCourseList({ count: 1, courses: [{ courseId: 1 }] }),
    ).toBeNull();
    expect(
      parseCourseList({
        count: 1,
        courses: [{ ...course(["경주"]), regions: null }],
      })?.courses[0].regions,
    ).toEqual([]);
  });
});

describe("datalabRows", () => {
  const list = {
    count: 1,
    courses: [{ ...course(["거제", "경주", "대전"]), courseId: "c1" }],
  };

  it("코스 지역마다 TFI 막대와 체류시간 행을 묶는다", () => {
    const rows = datalabRows("c1", list, TFI, STAY);
    expect(rows.map((r) => r.region)).toEqual(["거제", "경주"]);
    expect(rows[1].bars[0]).toEqual({
      key: "herit",
      label: "역사·문화유산",
      value: 1.0,
    });
    expect(rows[1].stay.stayMinutes).toBe(1222);
  });

  it("코스가 없으면 빈 배열", () => {
    expect(datalabRows("nope", list, TFI, STAY)).toEqual([]);
  });
});

describe("조회 함수 (가짜 fetch)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(data: unknown) {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://backend.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ code: "API_SUCCESS", message: "ok", data }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    vi.resetModules();
    return import("./datalab");
  }

  it("정상 응답은 그대로 돌려준다", async () => {
    const { getTfi } = await load(TFI);
    await expect(getTfi()).resolves.toEqual(TFI);
  });

  it("모양이 틀린 응답(필드 빠짐 · null)은 실패로 던진다", async () => {
    await expect(
      (await load({ ...TFI, tfi: null })).getTfi(),
    ).rejects.toThrow();
    await expect(
      (await load({ ...STAY, regions: undefined })).getStayTime(),
    ).rejects.toThrow();
    await expect((await load(null)).getCourses()).rejects.toThrow();
  });
});
