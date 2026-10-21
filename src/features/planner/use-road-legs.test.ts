import {
  environmentManager,
  focusManager,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadLegQuery } from "./course-map";
import {
  ROAD_PARALLEL,
  ROAD_RETRY,
  ROAD_RETRY_MS,
  roadLegFetcher,
  roadLegOptions,
} from "./use-road-legs";

// 도로 경로 문지기(roadLegFetcher, 앱 road_route.dart RoadRouteGate와 같다)와 조회 옵션(roadLegOptions, 앱 roadRouteProvider와 같은 규칙).
// 테스트 환경은 밖에 나가지 못해 fetch를 가짜로 바꾼다
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
const okLeg = {
  km: 1.2,
  min: 4,
  points: [
    { lat: 35.8, lng: 129.2 },
    { lat: 35.81, lng: 129.2 },
  ],
};
const status = (code: number, message: string) => () =>
  Response.json({ message }, { status: code });

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

/** 부른 차례대로 answers의 답을 돌려준다 */
function answerFetch(...answers: (() => Response | Promise<Response>)[]) {
  const fn = vi.fn(async () => {
    const next = answers.shift();
    if (!next) throw new Error("답을 더 준비하지 않았다");
    return next();
  });
  vi.stubGlobal("fetch", fn);
  return fn;
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
    expect(legs[19]).toEqual(okLeg);
  });

  it("첫 답이 503 not configured(키 없음 · 카카오내비 권한 없음)면 기다리던 구간 · 그 뒤 구간은 부르지 않고 null", async () => {
    const { fn, pending } = stubFetch();
    const get = roadLegFetcher();
    const out = Array.from({ length: 30 }, (_, k) => get(leg(k)));
    await settle();
    expect(fn).toHaveBeenCalledTimes(1);
    pending.shift()!(status(503, "not configured")());
    expect(await Promise.all(out)).toEqual(Array(30).fill(null));
    expect(await get(leg(99))).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("경로 없음 · 400 · 403 · 그 밖의 4xx는 null(다시 부르지 않는다), 잠깐의 실패는 ROAD_RETRY. 어느 쪽이든 다음 구간은 그대로 부른다", async () => {
    const cases: [() => Response | Promise<Response>, unknown][] = [
      [() => Response.json({ empty: true }), null],
      [status(400, "invalid from/to"), null],
      [status(400, "too far"), null],
      [status(403, "forbidden"), null],
      [status(404, "not found"), null],
      [status(429, "too many requests"), ROAD_RETRY],
      [status(502, "upstream"), ROAD_RETRY],
      [status(500, "internal"), ROAD_RETRY],
      [status(504, "gateway timeout"), ROAD_RETRY],
      // not configured가 아닌 503(앞단 프록시 등)은 끄지 않는다
      [status(503, "unavailable"), ROAD_RETRY],
      [() => new Response("<html>busy</html>", { status: 503 }), ROAD_RETRY],
      // 2xx인데 JSON이 아님(가로챈 페이지 등) · 모양이 다름 · 점이 2개 미만
      [() => new Response("<html>login</html>", { status: 200 }), ROAD_RETRY],
      [() => Response.json({ km: 1.2, min: 4 }), ROAD_RETRY],
      [
        () =>
          Response.json({
            km: "1.2",
            min: 4,
            path: [
              [35.8, 129.2],
              [35.81, 129.2],
            ],
          }),
        ROAD_RETRY,
      ],
      [
        () => Response.json({ km: 1.2, min: 4, path: [[35.8, 129.2]] }),
        ROAD_RETRY,
      ],
      [
        () => Response.json({ km: 1.2, min: 4, path: [[35.8, 129.2], "x"] }),
        ROAD_RETRY,
      ],
      [() => Promise.reject(new TypeError("network")), ROAD_RETRY],
      [
        () => Promise.reject(new DOMException("timeout", "TimeoutError")),
        ROAD_RETRY,
      ],
      [ok, okLeg],
    ];
    const fn = answerFetch(...cases.map(([a]) => a));
    const get = roadLegFetcher();
    const out = await Promise.all(cases.map((_, k) => get(leg(k))));
    expect(out).toEqual(cases.map(([, want]) => want));
    expect(fn).toHaveBeenCalledTimes(cases.length);
  });
});

describe("도로 경로 조회 (roadLegOptions): 받은 답은 1시간, 잠깐의 실패는 5분 뒤 다시", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    // 노드는 서버로 보고 staleTime · refetchInterval 타이머를 걸지 않는다. 브라우저처럼 건다
    environmentManager.setIsServer(() => false);
    client = new QueryClient();
  });

  afterEach(() => {
    client.clear();
    client.unmount();
    focusManager.setFocused(undefined);
    environmentManager.setIsServer(() => typeof window === "undefined");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** 구간 하나를 화면에 둔다(지도 · 코스 탭이 useRoadLegs로 보고 있는 것과 같다) */
  function watch(q: RoadLegQuery, get: ReturnType<typeof roadLegFetcher>) {
    const observer = new QueryObserver(client, roadLegOptions(q, get));
    const stop = observer.subscribe(() => {});
    return { data: () => observer.getCurrentResult().data, stop };
  }

  /** 기다리던 일을 돌린다(가짜 시계는 그대로) */
  const flush = () => vi.advanceTimersByTimeAsync(0);

  it("502면 지금은 ROAD_RETRY, 보고 있으면 5분 뒤 다시 부르고 경로를 받으면 멈춘다", async () => {
    const fn = answerFetch(status(502, "upstream"), ok);
    const w = watch(leg(0), roadLegFetcher());
    await flush();
    expect(w.data()).toBe(ROAD_RETRY);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(ROAD_RETRY_MS - 1000);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(w.data()).toEqual(okLeg);
    await vi.advanceTimersByTimeAsync(ROAD_RETRY_MS * 11);
    expect(fn).toHaveBeenCalledTimes(2);
    w.stop();
  });

  it("429(too many requests)도 잠깐의 실패: 받을 때까지 5분마다 다시 부른다", async () => {
    const fn = answerFetch(
      status(429, "too many requests"),
      status(429, "too many requests"),
      ok,
    );
    const w = watch(leg(0), roadLegFetcher());
    await flush();
    expect(w.data()).toBe(ROAD_RETRY);
    await vi.advanceTimersByTimeAsync(ROAD_RETRY_MS);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(w.data()).toBe(ROAD_RETRY);
    await vi.advanceTimersByTimeAsync(ROAD_RETRY_MS);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(w.data()).toEqual(okLeg);
    await vi.advanceTimersByTimeAsync(ROAD_RETRY_MS * 6);
    expect(fn).toHaveBeenCalledTimes(3);
    w.stop();
  });

  it("보지 않는 구간은 5분이 지난 뒤 다시 볼 때 부른다(5분 안에 다시 보면 부르지 않는다)", async () => {
    const fn = answerFetch(status(502, "upstream"), ok);
    const get = roadLegFetcher();
    const first = watch(leg(0), get);
    await flush();
    first.stop();
    await vi.advanceTimersByTimeAsync(ROAD_RETRY_MS - 1000);
    const early = watch(leg(0), get);
    await flush();
    expect(early.data()).toBe(ROAD_RETRY);
    early.stop();
    await vi.advanceTimersByTimeAsync(ROAD_RETRY_MS);
    expect(fn).toHaveBeenCalledTimes(1);
    const late = watch(leg(0), get);
    await flush();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(late.data()).toEqual(okLeg);
    late.stop();
  });

  it("400 · 경로 없음 · 403은 null이고 보고 있어도 · 창에 돌아와도 · 다시 봐도 1시간 안에는 부르지 않는다", async () => {
    const fn = answerFetch(
      status(400, "too far"),
      () => Response.json({ empty: true }),
      status(403, "forbidden"),
    );
    client.mount();
    const get = roadLegFetcher();
    const ws = [0, 1, 2].map((k) => watch(leg(k), get));
    await flush();
    expect(ws.map((w) => w.data())).toEqual([null, null, null]);
    expect(fn).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(ROAD_RETRY_MS * 11);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    const again = [0, 1, 2].map((k) => watch(leg(k), get));
    await flush();
    expect(again.map((w) => w.data())).toEqual([null, null, null]);
    expect(fn).toHaveBeenCalledTimes(3);
    for (const w of [...ws, ...again]) w.stop();
  });

  it("1시간 뒤 다시 물었을 때 잠깐의 실패(429 · 502 · 연결 없음)면 받은 경로를 그대로 두고 1시간 더 쓴다", async () => {
    const fn = answerFetch(
      ok,
      status(429, "too many requests"),
      status(502, "upstream"),
      () => Promise.reject(new TypeError("network")),
    );
    client.mount();
    const w = watch(leg(0), roadLegFetcher());
    await flush();
    expect(w.data()).toEqual(okLeg);
    const hour = 3600 * 1000;
    // 보고 있어도 저절로 다시 묻지는 않는다. 1시간이 지난 뒤 창에 돌아오면 묻는다
    await vi.advanceTimersByTimeAsync(hour + 1000);
    expect(fn).toHaveBeenCalledTimes(1);
    for (let n = 2; n <= 4; n++) {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await flush();
      expect(fn).toHaveBeenCalledTimes(n);
      expect(w.data()).toEqual(okLeg);
      // 경로로 남아 5분마다 다시 묻지 않고, 1시간 안에 창에 돌아와도 묻지 않는다
      await vi.advanceTimersByTimeAsync(ROAD_RETRY_MS * 11);
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await flush();
      expect(fn).toHaveBeenCalledTimes(n);
      await vi.advanceTimersByTimeAsync(ROAD_RETRY_MS + 1000);
    }
    w.stop();
  });

  it("503 not configured를 받으면 null이고 그 뒤로는 어느 구간도 서버에 묻지 않는다", async () => {
    const fn = answerFetch(status(503, "not configured"));
    const get = roadLegFetcher();
    const ws = [0, 1, 2].map((k) => watch(leg(k), get));
    await flush();
    expect(ws.map((w) => w.data())).toEqual([null, null, null]);
    await vi.advanceTimersByTimeAsync(ROAD_RETRY_MS * 12);
    const later = watch(leg(3), get);
    await flush();
    expect(later.data()).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
    for (const w of [...ws, later]) w.stop();
  });
});
