import { describe, expect, it, vi } from "vitest";
import {
  applyMediaSession,
  audioMetadata,
  clearMediaSession,
  mediaSessionOf,
  nextAudioIndex,
  setPlaybackState,
} from "./audio-session";

describe("오디오 이어듣기 · Media Session", () => {
  it("다음 카드 번호는 끝에서 null", () => {
    expect(nextAudioIndex(0, 3)).toBe(1);
    expect(nextAudioIndex(2, 3)).toBeNull();
    expect(nextAudioIndex(0, 1)).toBeNull();
  });

  it("잠금 화면 제목 · 출처 · 칸 이름", () => {
    const labels = { album: "오디오 가이드", odii: "오디", story: "스토리" };
    expect(audioMetadata({ title: "천왕문", source: "odii" }, labels)).toEqual({
      title: "천왕문",
      artist: "오디",
      album: "오디오 가이드",
    });
    expect(audioMetadata({ title: "", source: "story" }, labels)).toEqual({
      title: "오디오 가이드",
      artist: "스토리",
      album: "오디오 가이드",
    });
  });

  it("mediaSession이 없는 환경은 null", () => {
    expect(mediaSessionOf({})).toBeNull();
    expect(mediaSessionOf(undefined)).toBeNull();
    const s = { metadata: null, setActionHandler: () => {} };
    expect(mediaSessionOf({ mediaSession: s })).toBe(s);
  });

  it("버튼을 잇고(다음 · 이전은 있을 때만) 상태를 알리고 푼다. 지원하지 않는 action은 무시", () => {
    const calls: [string, unknown][] = [];
    const session = {
      metadata: null as unknown,
      playbackState: "none",
      setActionHandler: vi.fn((a: string, h: unknown) => {
        if (a === "previoustrack") throw new TypeError("unsupported");
        calls.push([a, h]);
      }),
    };
    const play = () => {};
    const pause = () => {};
    const next = () => {};
    applyMediaSession(
      session,
      { title: "t", artist: "a", album: "b" },
      { play, pause, next },
      (m) => ({ made: m }),
    );
    expect(session.metadata).toEqual({
      made: { title: "t", artist: "a", album: "b" },
    });
    expect(calls).toEqual([
      ["play", play],
      ["pause", pause],
      ["nexttrack", next],
    ]);
    setPlaybackState(session, "playing");
    expect(session.playbackState).toBe("playing");
    calls.length = 0;
    clearMediaSession(session);
    expect(calls.map(([a, h]) => [a, h])).toEqual([
      ["play", null],
      ["pause", null],
      ["nexttrack", null],
    ]);
    expect(session.playbackState).toBe("none");
  });
});
