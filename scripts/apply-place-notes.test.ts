import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./apply-badge-lists.mjs";
import { appendSentence, applyNotes } from "./apply-place-notes.mjs";
import details from "../src/features/planner/data/place-details.json";
import aliases from "../src/features/planner/data/place-aliases.json";

const notes = parseCsv(
  readFileSync(new URL("./data/place-notes.csv", import.meta.url), "utf8"),
);

describe("장소 명단 문장(식객 · 한식당 100선)", () => {
  it("설명 끝에 한 번만 붙이고, 설명이 없으면 문장만", () => {
    expect(appendSentence("국밥집. ", "식객에 나온 식당이다.")).toBe(
      "국밥집. 식객에 나온 식당이다.",
    );
    expect(
      appendSentence("국밥집. 식객에 나온 식당이다.", "식객에 나온 식당이다."),
    ).toBe("국밥집. 식객에 나온 식당이다.");
    expect(appendSentence(undefined, "식객에 나온 식당이다.")).toBe(
      "식객에 나온 식당이다.",
    );
    const d: Record<string, { desc?: { ko?: string; en?: string } }> = {
      b: { desc: { ko: "국밥집." } },
    };
    const rows = [{ id: "a", ko: "문장.", en: "Sentence." }];
    expect(applyNotes(d, rows, { a: "b" })).toBe(1);
    expect(applyNotes(d, rows, { a: "b" })).toBe(0);
    expect(d.b.desc).toEqual({ ko: "국밥집. 문장.", en: "Sentence." });
  });

  it("표의 문장이 데이터 설명에 들어가 있다", () => {
    const all = details as Record<string, { desc?: { ko?: string } }>;
    const alias = aliases as Record<string, string>;
    for (const n of notes) {
      const id = alias[n.id] ?? n.id;
      expect(all[id]?.desc?.ko, id).toContain(n.ko.trim());
    }
  });
});
