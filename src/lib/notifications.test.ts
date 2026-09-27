import { describe, expect, it } from "vitest";
import { buildNotifications, markRead, unreadCount } from "./notifications";

const CITYTOUR = { tours: 280, regions: 72, date: "2026-07-01" };

describe("buildNotifications", () => {
  it("정보가 없으면 시티투어 알림 하나만", () => {
    const list = buildNotifications({
      recommendation: null,
      plannerPlaceIds: [],
      savedAt: [],
      citytour: CITYTOUR,
    });
    expect(list.map((n) => n.kind)).toEqual(["citytour"]);
    expect(list[0].href).toBe("/#home-citytour");
  });

  it("있는 정보만 추천 → 플래너 → 저장 → 시티투어 순으로", () => {
    const list = buildNotifications({
      recommendation: { a: "q1.20s", type: "C1" },
      plannerPlaceIds: ["gj2", "gj3"],
      savedAt: [10, 30],
      citytour: CITYTOUR,
    });
    expect(list.map((n) => [n.kind, n.href])).toEqual([
      ["recommend", "/recommend/result?a=q1.20s"],
      ["planner", "/planner?tab=course"],
      ["saved", "/me"],
      ["citytour", "/#home-citytour"],
    ]);
    expect(list[2].id).toBe("saved:2:30");
  });

  it("내용이 바뀌면 id가 바뀐다", () => {
    const base = {
      recommendation: null,
      savedAt: [],
      citytour: CITYTOUR,
    };
    const a = buildNotifications({ ...base, plannerPlaceIds: ["x"] });
    const b = buildNotifications({ ...base, plannerPlaceIds: ["x", "y"] });
    expect(a[0].id).not.toBe(b[0].id);
  });
});

describe("unreadCount · markRead", () => {
  const list = buildNotifications({
    recommendation: { a: "q1.20s", type: "C1" },
    plannerPlaceIds: [],
    savedAt: [],
    citytour: CITYTOUR,
  });

  it("읽은 id를 빼고 센다", () => {
    expect(unreadCount(list, [])).toBe(2);
    expect(unreadCount(list, [list[0].id])).toBe(1);
  });

  it("읽음 표시는 지금 없는 알림의 id를 버린다", () => {
    expect(markRead(list, ["old"], [list[1].id])).toEqual([list[1].id]);
    expect(
      unreadCount(
        list,
        markRead(
          list,
          [],
          list.map((n) => n.id),
        ),
      ),
    ).toBe(0);
  });
});
