import { describe, expect, it } from "vitest";
import {
  OVERVIEW_RADIUS_M,
  overviewService,
  overviewText,
  pickOverviewItem,
} from "./tour-overview";

const at = { name: "Gyeonggijeon Shrine", lat: 35.8153, lng: 127.1498 };
/** 장소에서 북쪽으로 m미터 떨어진 항목 */
const item = (title: string, m: number, contentid = "1") => ({
  title,
  contentid,
  mapy: String(at.lat + m / 111195),
  mapx: String(at.lng),
});

describe("다국어 관광정보 소개문 고르기", () => {
  it("언어 → 서비스(한국어는 없음)", () => {
    expect(overviewService("en")).toBe("EngService2");
    expect(overviewService("ja")).toBe("JpnService2");
    expect(overviewService("zh")).toBe("ChsService2");
    expect(overviewService("es")).toBe("SpnService2");
    expect(overviewService("ko")).toBeNull();
  });

  it("반경 안에서 이름이 서로를 품는 가장 가까운 곳 → 없으면 50m 안의 가장 가까운 곳", () => {
    expect(
      pickOverviewItem(
        [
          item("Cafe", 10, "a"),
          item("Gyeonggijeon", 200, "b"),
          item("Gyeonggijeon Shrine (Jeonju)", 120, "c"),
        ],
        at,
      )?.contentid,
    ).toBe("c");
    expect(pickOverviewItem([item("Cafe", 40, "a")], at)?.contentid).toBe("a");
    expect(pickOverviewItem([item("Cafe", 80, "a")], at)).toBeNull();
    // 반경 밖 · 한글 제목 · contentid 없음은 버린다
    expect(
      pickOverviewItem(
        [
          item("Gyeonggijeon", OVERVIEW_RADIUS_M + 50),
          item("경기전", 5),
          { ...item("Gyeonggijeon", 5), contentid: "" },
        ],
        at,
      ),
    ).toBeNull();
  });

  it("소개문 HTML → 글자", () => {
    expect(overviewText("A&amp;B<br />C &lt;D&gt;<p>E</p>")).toBe(
      "A&B\nC <D>E",
    );
    expect(overviewText(undefined)).toBe("");
  });
});
