import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ko from "../../../messages/ko.json";
import { THEME_COURSE_ID } from "../../features/theme/datalab";
import {
  DATALAB_REGION_IDS,
  datalabRegionId,
  datalabRegionsOfCourse,
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
        expect(messages.Recommend.questions.q15.options[id]).toBeTruthy();
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
