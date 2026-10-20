import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clientIp,
  distM,
  kakaoDirectionsUrl,
  parseLatLng,
  parseRouteQuery,
  ROUTE_IP_BURST,
  ROUTE_IP_PER_HOUR,
  type RoadRoute,
  type RouteQuery,
  resetRouteLimit,
  roadRouteResponse,
  routeVertices,
  simplifyPath,
  simplifyTolerance,
  takeRouteToken,
  toRoadRoute,
} from "./road-route";

// 카카오모빌리티 자동차 길찾기 응답 모양(developers.kakaomobility.com 「자동차 길찾기」): routes[0].result_code 0이 성공,
// summary.distance(m) · duration(초), sections[].roads[].vertexes = [x1, y1, x2, y2, …](x 경도 · y 위도).
// 테스트 환경은 외부에 나가지 못해 fetch를 가짜로 바꾼다
const kakao = (
  roads: number[][],
  { distance = 2400, duration = 600, code = 0 } = {},
) => ({
  trans_id: "test",
  routes: [
    {
      result_code: code,
      result_msg: code === 0 ? "길찾기 성공" : "길찾기 결과를 찾을 수 없음",
      summary: { distance, duration },
      sections: [{ roads: roads.map((vertexes) => ({ vertexes })) }],
    },
  ],
});

// 경주 대릉원 → 첨성대 근처(약 1km)
const FROM = { lat: 35.83811, lng: 129.21118 };
const TO = { lat: 35.83469, lng: 129.21901 };
const query = (priority: RouteQuery["priority"] = "RECOMMEND"): RouteQuery => ({
  from: FROM,
  to: TO,
  priority,
});

describe("쿼리 검사 (parseRouteQuery)", () => {
  const parse = (qs: string) => parseRouteQuery(new URLSearchParams(qs));

  it("from · to는 「위도,경도」 소수, 소수 5자리로 반올림한다. by 없음 → RECOMMEND, by=distance → DISTANCE", () => {
    expect(parse("from=35.838114,129.211184&to=35.83469,129.21901")).toEqual({
      from: { lat: 35.83811, lng: 129.21118 },
      to: { lat: 35.83469, lng: 129.21901 },
      priority: "RECOMMEND",
    });
    expect(parse("from=35.8,129.2&to=35.9,129.3&by=distance")).toMatchObject({
      priority: "DISTANCE",
    });
    expect(parseLatLng(" 37.5 , 127 ")).toEqual({ lat: 37.5, lng: 127 });
  });

  it("숫자가 아님 · 빠짐 · 순서가 틀린 값은 invalid from/to", () => {
    const bad = [
      "to=35.9,129.3",
      "from=35.8,129.2",
      "from=abc&to=35.9,129.3",
      "from=35.8&to=35.9,129.3",
      "from=35.8,129.2,1&to=35.9,129.3",
      "from=35.8,&to=35.9,129.3",
      "from=1e1,129.2&to=35.9,129.3",
      "from=0x20,129.2&to=35.9,129.3",
      "from=Infinity,129.2&to=35.9,129.3",
      // 경도 · 위도를 뒤집어 보내면 범위 밖
      "from=129.2,35.8&to=35.9,129.3",
    ];
    for (const qs of bad)
      expect(parse(qs)).toEqual({ error: "invalid from/to" });
  });

  it("한국 범위(위도 32.5–39.5 · 경도 124–132.5) 밖이면 invalid from/to, 경계는 받는다", () => {
    expect(parse("from=32.4,127&to=35.9,129.3")).toEqual({
      error: "invalid from/to",
    });
    expect(parse("from=39.6,127&to=35.9,129.3")).toEqual({
      error: "invalid from/to",
    });
    expect(parse("from=35,123.9&to=35.9,129.3")).toEqual({
      error: "invalid from/to",
    });
    expect(parse("from=35,132.6&to=35.9,129.3")).toEqual({
      error: "invalid from/to",
    });
    expect(parse("from=32.5,124&to=39.5,132.5")).not.toHaveProperty("error");
  });

  it("by가 distance가 아니면 invalid by (빈 값 포함)", () => {
    for (const by of ["time", "", "DISTANCE", "recommend"])
      expect(parse(`from=35.8,129.2&to=35.9,129.3&by=${by}`)).toEqual({
        error: "invalid by",
      });
  });
});

describe("카카오 주소 (kakaoDirectionsUrl)", () => {
  it("origin · destination은 경도,위도 순, 대안 · 도로 상세 · 요약만 끔", () => {
    expect(kakaoDirectionsUrl(query("DISTANCE"))).toBe(
      "https://apis-navi.kakaomobility.com/v1/directions" +
        "?origin=129.21118,35.83811&destination=129.21901,35.83469&priority=DISTANCE" +
        "&alternatives=false&road_details=false&summary=false",
    );
  });
});

describe("경로 다듬기 (toRoadRoute)", () => {
  it("vertexes는 x 경도 · y 위도 순, 구간 · 도로 순서대로 잇는다. km 소수 1자리 · min 반올림", () => {
    const body = kakao([
      [129.21118, 35.83811, 129.215, 35.837],
      [129.215, 35.837, 129.21901, 35.83469],
    ]);
    const out = toRoadRoute(body, query()) as RoadRoute;
    expect(out.km).toBe(2.4);
    expect(out.min).toBe(10);
    // 같은 점(129.215, 35.837)은 한 번, 양 끝이 핀과 같아 덧붙이지 않는다
    expect(out.path).toEqual([
      [35.83811, 129.21118],
      [35.837, 129.215],
      [35.83469, 129.21901],
    ]);
    expect(
      (
        toRoadRoute(
          kakao([[129.2, 35.8, 129.3, 35.9]], { distance: 1249, duration: 89 }),
          {
            from: { lat: 35.8, lng: 129.2 },
            to: { lat: 35.9, lng: 129.3 },
            priority: "RECOMMEND",
          },
        ) as RoadRoute
      ).km,
    ).toBe(1.2);
  });

  it("바로 앞과 같은 점 · 한국 범위 밖 점 · 숫자가 아닌 값은 버린다", () => {
    const route = kakao([
      [129.21, 35.83, 129.21, 35.83, 140, 35.83, 129.22, 20, 129.22, 35.84],
      [Number.NaN as unknown as number, 35.85, 129.23, 35.85, 129.24],
    ]).routes[0];
    expect(routeVertices(route)).toEqual([
      { lat: 35.83, lng: 129.21 },
      { lat: 35.84, lng: 129.22 },
      { lat: 35.85, lng: 129.23 },
    ]);
    expect(routeVertices({ sections: "x" })).toEqual([]);
    expect(routeVertices(null)).toEqual([]);
  });

  it("도로 끝이 핀에서 1m 넘게 떨어져 있으면 핀을 앞 · 뒤에 붙인다(1m 안이면 붙이지 않는다)", () => {
    // 첫 점은 핀에서 약 50m, 끝 점은 핀에서 약 0.3m
    const body = kakao([
      [129.2117, 35.8383, 129.215, 35.837, 129.219013, 35.834692],
    ]);
    const out = toRoadRoute(body, query()) as RoadRoute;
    expect(out.path[0]).toEqual([FROM.lat, FROM.lng]);
    expect(out.path[1]).toEqual([35.8383, 129.2117]);
    expect(out.path.at(-1)).toEqual([35.83469, 129.21901]);
    expect(out.path).toHaveLength(4);
  });

  it("좌표는 소수 5자리로 반올림한다", () => {
    const body = kakao([
      [129.211181, 35.838111, 129.2150004, 35.8370004, 129.219009, 35.834691],
    ]);
    expect((toRoadRoute(body, query()) as RoadRoute).path).toEqual([
      [35.83811, 129.21118],
      [35.837, 129.215],
      [35.83469, 129.21901],
    ]);
  });

  it("result_code가 0이 아니거나(길 없음 · 섬) routes가 없으면 경로 없음", () => {
    expect(
      toRoadRoute(kakao([[129.2, 35.8, 129.3, 35.9]], { code: 104 }), query()),
    ).toEqual({
      empty: true,
    });
    expect(toRoadRoute({ trans_id: "x", routes: [] }, query())).toEqual({
      empty: true,
    });
    expect(toRoadRoute({ trans_id: "x" }, query())).toEqual({ empty: true });
    // 도로 꼭짓점이 2개 미만이면 핀 두 개만 잇는 가짜 선이 되므로 경로 없음
    expect(toRoadRoute(kakao([[129.215, 35.837]]), query())).toEqual({
      empty: true,
    });
  });

  it("본문이 객체가 아니거나 summary가 숫자가 아니면 null(502)", () => {
    expect(toRoadRoute(null, query())).toBeNull();
    expect(toRoadRoute([1, 2], query())).toBeNull();
    const noSummary = kakao([[129.2, 35.8, 129.3, 35.9]]);
    (noSummary.routes[0] as { summary?: unknown }).summary = undefined;
    expect(toRoadRoute(noSummary, query())).toBeNull();
  });
});

describe("경로 줄이기 (simplifyPath · Douglas–Peucker)", () => {
  // 위도 35.8에서 경도 0.00001 ≈ 0.9m, 위도 0.00001 ≈ 1.1m
  const line = (offsetM: number) => {
    const dLat = offsetM / 111195;
    return [
      { lat: 35.8, lng: 129.2 },
      { lat: 35.8 + dLat, lng: 129.205 },
      { lat: 35.8, lng: 129.21 },
    ];
  };

  it("허용 오차 = km × 0.5m, 3 ~ 40m", () => {
    expect(simplifyTolerance(0.5)).toBe(3);
    expect(simplifyTolerance(10)).toBe(5);
    expect(simplifyTolerance(80)).toBe(40);
    expect(simplifyTolerance(500)).toBe(40);
  });

  it("직선에서 허용 오차보다 덜 벗어난 점은 빼고, 더 벗어난 점은 남긴다(위도 보정 m)", () => {
    expect(simplifyPath(line(4), 5)).toHaveLength(2);
    expect(simplifyPath(line(6), 5)).toHaveLength(3);
    // 일직선 위 점은 모두 빠지고 양 끝만 남는다
    const straight = Array.from({ length: 50 }, (_, i) => ({
      lat: 35.8 + i * 0.001,
      lng: 129.2 + i * 0.001,
    }));
    expect(simplifyPath(straight, 3)).toEqual([straight[0], straight[49]]);
  });

  it("경도 차이는 위도 보정해서 잰다(위도 38에서 경도 0.0001 ≈ 8.8m)", () => {
    const pts = [
      { lat: 38, lng: 127 },
      { lat: 38.001, lng: 127.0001 },
      { lat: 38.002, lng: 127 },
    ];
    expect(simplifyPath(pts, 8)).toHaveLength(3);
    expect(simplifyPath(pts, 9)).toHaveLength(2);
  });

  it("긴 경로(4만 점)도 재귀 없이 줄인다", () => {
    // 굽은 길(사인 곡선) 4만 점 → 양 끝을 남기고 수백 점으로
    const curve = Array.from({ length: 40000 }, (_, i) => ({
      lat: 35 + 0.5 * Math.sin(i / 2000),
      lng: 127 + i * 0.0001,
    }));
    const out = simplifyPath(curve, 40);
    expect(out[0]).toEqual(curve[0]);
    expect(out.at(-1)).toEqual(curve.at(-1));
    expect(out.length).toBeGreaterThan(10);
    expect(out.length).toBeLessThan(1000);
  });

  it("toRoadRoute는 경로 km로 정한 허용 오차를 쓴다(2.4km → 3m · 80km → 40m)", () => {
    // 핀 두 개를 잇는 곧은 선 위 점(경도 129.215)을 위도로 m만큼 옮긴다. 선이 비스듬해 직선까지 거리는 약 0.88배
    const t = (129.215 - FROM.lng) / (TO.lng - FROM.lng);
    const onLine = FROM.lat + (TO.lat - FROM.lat) * t;
    const body = (m: number, distance: number) =>
      kakao(
        [[FROM.lng, FROM.lat, 129.215, onLine + m / 111195, TO.lng, TO.lat]],
        { distance },
      );
    const points = (m: number, distance: number) =>
      (toRoadRoute(body(m, distance), query()) as RoadRoute).path.length;
    expect(points(2, 2400)).toBe(2);
    expect(points(6, 2400)).toBe(3);
    expect(points(20, 2400)).toBe(3);
    expect(points(20, 80000)).toBe(2);
    expect(points(50, 80000)).toBe(3);
  });
});

describe("IP마다 상한 (takeRouteToken · clientIp)", () => {
  afterEach(() => resetRouteLimit());

  it("한꺼번에 ROUTE_IP_BURST개, 그 뒤로는 시간당 ROUTE_IP_PER_HOUR개(12초에 하나). IP마다 따로 센다", () => {
    expect(ROUTE_IP_BURST).toBe(160);
    expect(ROUTE_IP_PER_HOUR).toBe(300);
    const t0 = 1_000_000;
    for (let i = 0; i < ROUTE_IP_BURST; i++)
      expect(takeRouteToken("203.0.113.7", t0)).toBe(true);
    expect(takeRouteToken("203.0.113.7", t0)).toBe(false);
    expect(takeRouteToken("203.0.113.8", t0)).toBe(true);
    expect(takeRouteToken("203.0.113.7", t0 + 11_000)).toBe(false);
    expect(takeRouteToken("203.0.113.7", t0 + 12_000)).toBe(true);
    expect(takeRouteToken("203.0.113.7", t0 + 12_000)).toBe(false);
    // 오래 쉬어도 ROUTE_IP_BURST개까지만 찬다
    const later = t0 + 24 * 3600 * 1000;
    for (let i = 0; i < ROUTE_IP_BURST; i++)
      expect(takeRouteToken("203.0.113.7", later)).toBe(true);
    expect(takeRouteToken("203.0.113.7", later)).toBe(false);
  });

  it("하루 내내 불러도 IP 하나는 무료 일일 쿼터(약 1만 건)를 다 쓰지 못한다", () => {
    let n = 0;
    for (let s = 0; s < 24 * 3600; s++)
      if (takeRouteToken("203.0.113.9", s * 1000)) n++;
    expect(n).toBeLessThan(10000);
    expect(n).toBeGreaterThan(ROUTE_IP_BURST + 24 * ROUTE_IP_PER_HOUR - 5);
  });

  it("IP는 x-forwarded-for 첫 값 → x-real-ip, 없으면 빈 글자", () => {
    const req = (headers: Record<string, string>) =>
      new Request("http://localhost/api/route", { headers });
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
    expect(clientIp(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(req({}))).toBe("");
  });
});

describe("GET /api/route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetRouteLimit();
  });
  const KEY = "SECRET-REST-KEY";
  const call = (qs: string, headers?: Record<string, string>) =>
    roadRouteResponse(
      new Request(`http://localhost/api/route?${qs}`, { headers }),
    );
  const qs = `from=${FROM.lat},${FROM.lng}&to=${TO.lat},${TO.lng}`;
  const stubKakao = (res: () => Response | Promise<Response>) => {
    const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return res();
    });
    vi.stubGlobal("fetch", fn);
    return fn;
  };

  it("길을 찾으면 { km, min, path }, 캐시는 브라우저 · 앱만 1시간. 카카오는 키 헤더 · no-store로 부른다", async () => {
    vi.stubEnv("KAKAO_REST_KEY", KEY);
    const fn = stubKakao(() =>
      Response.json(
        kakao([[129.21118, 35.83811, 129.215, 35.837, 129.21901, 35.83469]]),
      ),
    );
    const res = await call(`${qs}&by=distance`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
    const text = await res.text();
    expect(text).not.toContain(KEY);
    expect(JSON.parse(text)).toEqual({
      km: 2.4,
      min: 10,
      path: [
        [35.83811, 129.21118],
        [35.837, 129.215],
        [35.83469, 129.21901],
      ],
    });
    expect(fn).toHaveBeenCalledTimes(1);
    const [url, init] = fn.mock.calls[0];
    expect(String(url)).toBe(
      kakaoDirectionsUrl({ from: FROM, to: TO, priority: "DISTANCE" }),
    );
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      `KakaoAK ${KEY}`,
    );
  });

  it("20m 안의 두 점은 카카오를 부르지 않고 경로 없음(키가 없어도)", async () => {
    const fn = stubKakao(() => Response.json({}));
    vi.stubEnv("KAKAO_REST_KEY", "");
    const res = await call("from=35.8,129.2&to=35.80015,129.2");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ empty: true });
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(fn).not.toHaveBeenCalled();
    expect(
      distM({ lat: 35.8, lng: 129.2 }, { lat: 35.80015, lng: 129.2 }),
    ).toBeLessThan(20);
  });

  it("좌표 · by가 틀리면 400, 700km 넘으면 400 too far (저장하지 않는다)", async () => {
    vi.stubEnv("KAKAO_REST_KEY", KEY);
    const fn = stubKakao(() => Response.json({}));
    const bad = await call("from=1,2&to=35.9,129.3");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ message: "invalid from/to" });
    expect(bad.headers.get("Cache-Control")).toBe("no-store");
    const by = await call(`${qs}&by=time`);
    expect(by.status).toBe(400);
    expect(await by.json()).toEqual({ message: "invalid by" });
    // 범위 남서쪽 끝 → 북동쪽 끝(둘 다 범위 안, 직선 약 1,000km)
    const far = await call("from=32.6,124.1&to=39.4,132.4");
    expect(far.status).toBe(400);
    expect(await far.json()).toEqual({ message: "too far" });
    expect(far.headers.get("Cache-Control")).toBe("no-store");
    expect(fn).not.toHaveBeenCalled();
  });

  it("키가 없으면 503 not configured", async () => {
    vi.stubEnv("KAKAO_REST_KEY", "");
    const fn = stubKakao(() => Response.json({}));
    const res = await call(qs);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ message: "not configured" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fn).not.toHaveBeenCalled();
  });

  it("카카오 401 · 403(카카오내비 권한 없음)은 503 not configured, 카카오 오류 문구 · 키는 내보내지 않는다", async () => {
    vi.stubEnv("KAKAO_REST_KEY", KEY);
    for (const status of [401, 403]) {
      stubKakao(() =>
        Response.json(
          { code: -401, msg: `wrong appKey(${KEY}) format` },
          { status },
        ),
      );
      const res = await call(qs);
      expect(res.status).toBe(503);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ message: "not configured" });
      expect(text).not.toContain(KEY);
      expect(text).not.toContain("appKey");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("카카오 500 · 시간 초과 · JSON 아님 · 모양 다름은 502 upstream", async () => {
    vi.stubEnv("KAKAO_REST_KEY", KEY);
    const cases: (() => Response | Promise<Response>)[] = [
      () => Response.json({ msg: `internal ${KEY}` }, { status: 500 }),
      () => Promise.reject(new DOMException("timed out", "TimeoutError")),
      () => new Response("<html>bad gateway</html>", { status: 200 }),
      () => Response.json(null),
    ];
    for (const res of cases) {
      stubKakao(res);
      const out = await call(qs);
      expect(out.status).toBe(502);
      const text = await out.text();
      expect(JSON.parse(text)).toEqual({ message: "upstream" });
      expect(text).not.toContain(KEY);
      expect(out.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("길이 없으면(result_code ≠ 0) 200 경로 없음, 1시간 캐시", async () => {
    vi.stubEnv("KAKAO_REST_KEY", KEY);
    stubKakao(() => Response.json(kakao([], { code: 102 })));
    const res = await call(qs);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ empty: true });
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });

  it("다른 사이트 페이지의 브라우저 요청(Sec-Fetch-Site: cross-site)은 카카오를 부르지 않고 403", async () => {
    vi.stubEnv("KAKAO_REST_KEY", KEY);
    const fn = stubKakao(() =>
      Response.json(kakao([[129.21118, 35.83811, 129.21901, 35.83469]])),
    );
    const res = await call(qs, { "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "forbidden" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fn).not.toHaveBeenCalled();
    // 우리 화면(same-origin) · 같은 사이트 · 주소창(none) · 앱(헤더 없음)은 받는다
    for (const site of ["same-origin", "same-site", "none"])
      expect((await call(qs, { "sec-fetch-site": site })).status).toBe(200);
    expect((await call(qs)).status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("한 IP가 상한을 넘으면 카카오를 부르지 않고 429. 다른 IP는 그대로, 카카오를 부르지 않는 응답은 세지 않는다", async () => {
    vi.stubEnv("KAKAO_REST_KEY", KEY);
    const fn = stubKakao(() =>
      Response.json(kakao([[129.21118, 35.83811, 129.21901, 35.83469]])),
    );
    const ip = { "x-forwarded-for": "203.0.113.7" };
    // 20m 안 · 좌표가 틀림은 카카오를 부르지 않아 세지 않는다
    for (let i = 0; i < 5; i++) {
      await call("from=35.8,129.2&to=35.80015,129.2", ip);
      await call("from=1,2&to=35.9,129.3", ip);
    }
    for (let i = 0; i < ROUTE_IP_BURST; i++)
      expect((await call(qs, ip)).status).toBe(200);
    const res = await call(qs, ip);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ message: "too many requests" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fn).toHaveBeenCalledTimes(ROUTE_IP_BURST);
    expect((await call(qs, { "x-forwarded-for": "203.0.113.8" })).status).toBe(
      200,
    );
  });
});
