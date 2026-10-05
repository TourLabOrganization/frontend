// 장소 대표 사진 점검: 사진이 없는 플래너 장소마다 대표 사진 찾기(lib/tour-photo.ts findPhoto)를 실제로 돌려
// 어느 단계(① 관광공사 관광정보 · ② 관광사진 · ③ 위키백과 · ④ 위키미디어 공용 · ⑤ 카카오맵 · 그 장소 이름으로 좁힌 카카오 이미지 검색)에서 찾았는지 표로 남긴다.
// ⑤ 카카오 이미지 검색으로 떨어진 장소는 엉뚱한 사진일 수 있어 사람이 눈으로 확인한다(2026-10-05).
//
// 외부 API를 수천 번 부르므로 평소 `npm run test`에서는 건너뛴다. 키와 인터넷이 있는 곳에서만:
//   PHOTO_AUDIT=1 DATA_GO_KR_KEY=… KAKAO_REST_KEY=… npx vitest run scripts/photo-audit.test.ts
//   선택: PHOTO_AUDIT_CITY=전주(한 도시만) · PHOTO_AUDIT_LIMIT=200(앞에서 몇 곳) · PHOTO_AUDIT_OUT=파일(기본 photo-audit.csv)
//   · PHOTO_AUDIT_CONCURRENCY=4(동시 호출 수, 공공데이터포털 하루 호출 한도에 주의)
// 결과 CSV 열: id · city · ko · cat · step(1–5, 못 찾으면 none) · source · src · author · license
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import addedPlaces from "../src/features/planner/data/added-places.json";
import details from "../src/features/planner/data/place-details.json";
import places from "../src/features/planner/data/places.json";
import { tourApiKey, tourPlace } from "../src/lib/tour-api";
import { findPhoto, type TourPhoto } from "../src/lib/tour-photo";

const RUN = process.env.PHOTO_AUDIT === "1";

/** 출처 → 단계 번호 */
export const PHOTO_STEP: Readonly<Record<TourPhoto["source"], number>> = {
  kto: 1,
  ktoGallery: 2,
  wikipedia: 3,
  commons: 4,
  kakaomap: 5,
  kakao: 5,
};

type Row = {
  id: string;
  city: string;
  ko: string;
  cat: string;
  step: string;
  source: string;
  src: string;
  author: string;
  license: string;
};

const cell = (v: string) =>
  /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

/** 사진이 없는 장소(시트가 /api/tour/photo를 부르는 장소). city · limit로 줄인다 */
export function auditTargets(city?: string, limit?: number) {
  const det = details as Record<string, { img?: string }>;
  const all = [...places, ...addedPlaces] as {
    id: string;
    ko: string;
    cat: string;
    locKo?: string;
    pickCity?: string;
  }[];
  const out = all.filter(
    (p) => !det[p.id]?.img && (!city || (p.pickCity ?? p.locKo) === city),
  );
  return limit ? out.slice(0, limit) : out;
}

describe("장소 대표 사진 점검(PHOTO_AUDIT=1일 때만)", () => {
  it("점검 대상은 사진이 없는 장소다", () => {
    const t = auditTargets();
    const det = details as Record<string, { img?: string }>;
    expect(t.length).toBeGreaterThan(0);
    expect(t.every((p) => !det[p.id]?.img)).toBe(true);
    expect(PHOTO_STEP.kakao).toBe(5);
  });

  it.skipIf(!RUN)(
    "사진이 없는 장소마다 찾기를 돌려 단계별로 적는다",
    async () => {
      const targets = auditTargets(
        process.env.PHOTO_AUDIT_CITY || undefined,
        Number(process.env.PHOTO_AUDIT_LIMIT) || undefined,
      );
      const key = tourApiKey();
      const rows: Row[] = [];
      const width = Number(process.env.PHOTO_AUDIT_CONCURRENCY) || 4;
      let next = 0;
      const worker = async () => {
        while (next < targets.length) {
          const p = targets[next++];
          const place = tourPlace(p.id);
          const photo = place ? await findPhoto(place, key) : null;
          rows.push({
            id: p.id,
            city: p.pickCity ?? p.locKo ?? "",
            ko: p.ko,
            cat: p.cat,
            step: photo ? String(PHOTO_STEP[photo.source]) : "none",
            source: photo?.source ?? "",
            src: photo?.src ?? "",
            author: photo?.author ?? "",
            license: photo?.license ?? "",
          });
        }
      };
      await Promise.all(Array.from({ length: width }, worker));
      rows.sort(
        (a, b) => a.step.localeCompare(b.step) || a.id.localeCompare(b.id),
      );
      const cols = Object.keys(rows[0] ?? { id: "" }) as (keyof Row)[];
      const out = process.env.PHOTO_AUDIT_OUT || "photo-audit.csv";
      writeFileSync(
        out,
        "﻿" +
          [
            cols.join(","),
            ...rows.map((r) => cols.map((c) => cell(r[c])).join(",")),
          ].join("\n") +
          "\n",
        "utf8",
      );
      const count: Record<string, number> = {};
      for (const r of rows) count[r.step] = (count[r.step] ?? 0) + 1;
      console.log(
        `사진 점검 ${rows.length}곳 → ${out}\n` +
          ["1", "2", "3", "4", "5", "none"]
            .map(
              (s) =>
                `  ${s === "none" ? "못 찾음" : `${s}단계`}: ${count[s] ?? 0}`,
            )
            .join("\n"),
      );
      if (!key) console.log("  (DATA_GO_KR_KEY가 없어 ①②를 건너뛰었다)");
      if (!process.env.KAKAO_REST_KEY)
        console.log("  (KAKAO_REST_KEY가 없어 ⑤를 건너뛰었다)");
      expect(rows.length).toBe(targets.length);
    },
    60 * 60 * 1000,
  );
});
