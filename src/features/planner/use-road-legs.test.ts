import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoadLegQuery } from "./course-map";
import { ROAD_PARALLEL, roadLegFetcher } from "./use-road-legs";

// 도로 경로 문지기(roadLegFetcher, 앱 road_route.dart RoadRouteGate와 같다). 테스트 환경은 밖에 나가지 못해 fetch를 가짜로 바꾼다
const leg = (k: number): RoadLegQuery => ({
  from: { lat: 35.8, lng: 129.2 + k / 1000 },
  to: { lat: 35.81, lng: 129.2 + k / 1000 },
});
const ok = () =>
  Response.json({
    km: 1.2,
    min: 4,
    path: [
      [35.8, 129.2],
      [35.81, 129.2],
    ],
  });

/** 부를 때마다 멈춰 두고, 손으로 답을 돌려준다 */
function stubFetch() {
  const pending: ((res: Response) => void)[] = [];
  const fn = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        void input;
        void init;
        pending.push(resolve);
      }),
  );
  vi.stubGlobal("fetch", fn);
  return { fn, pending };
}

/** 기다리던 일(마이크로태스크)을 다 돌린다 */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("도로 경로 문지기 (roadLegFetcher)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("첫 답 전에는 하나만, 그 뒤로는 ROAD_PARALLEL개까지 보낸다. 시간 제한은 보낼 때 건다(기다린 시간은 넣지 않는다)", async () => {
    const { fn, pending } = stubFetch();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const get = roadLegFetcher();
    const out = Array.from({ length: 20 }, (_, k) => get(leg(k)));
    await settle();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    pending.shift()!(ok());
    await settle();
    expect(pending).toHaveLength(ROAD_PARALLEL);
    expect(fn).toHaveBeenCalledTimes(1 + ROAD_PARALLEL);
    expect(timeout).toHaveBeenCalledTimes(1 + ROAD_PARALLEL);
    // 하나 끝나면 하나 더(함께 가는 수는 ROAD_PARALLEL 그대로)
    pending.shift()!(ok());
    await settle();
    expect(pending).toHaveLength(ROAD_PARALLEL);
    expect(fn).toHaveBeenCalledTimes(2 + ROAD_PARALLEL);
    while (pending.length > 0) {
      pending.shift()!(ok());
      await settle();
    }
    expect(fn).toHaveBeenCalledTimes(20);
    const legs = await Promise.all(out);
    expect(legs[19]).toEqual({
      km: 1.2,
      min: 4,
      points: [
        { lat: 35.8, lng: 129.2 },
        { lat: 35.81, lng: 129.2 },
      ],
    });
  });

  it("첫 답이 503(키 없음 · 카카오내비 권한 없음)이면 기다리던 구간 · 그 뒤 구간은 부르지 않고 null", async () => {
    const { fn, pending } = stubFetch();
    const get = roadLegFetcher();
    const out = Array.from({ length: 30 }, (_, k) => get(leg(k)));
    await settle();
    expect(fn).toHaveBeenCalledTimes(1);
    pending.shift()!(
      Response.json({ message: "not configured" }, { status: 503 }),
    );
    expect(await Promise.all(out)).toEqual(Array(30).fill(null));
    expect(await get(leg(99))).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("경로 없음 · 502 · 네트워크 오류는 null이고 다음 구간은 그대로 부른다", async () => {
    const answers = [
      () => Response.json({ empty: true }),
      () => Response.json({ message: "upstream" }, { status: 502 }),
      () => Promise.reject(new TypeError("network")),
      ok,
    ];
    const fn = vi.fn(async () => answers[fn.mock.calls.length - 1]());
    vi.stubGlobal("fetch", fn);
    const get = roadLegFetcher();
    const out = await Promise.all(answers.map((_, k) => get(leg(k))));
    expect(out.slice(0, 3)).toEqual([null, null, null]);
    expect(out[3]?.km).toBe(1.2);
    expect(fn).toHaveBeenCalledTimes(4);
  });
});
