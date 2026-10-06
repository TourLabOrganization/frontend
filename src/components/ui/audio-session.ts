// 오디오 가이드 이어듣기 · 잠금 화면 제어(Media Session API)의 순수 계산과 얇은 브라우저 연결. 화면(PlaceTour의 AudioCards · AudioCard)이 붙인다.
// 해설 카드가 여럿일 때 한 건이 끝나면 다음 카드로 넘겨 이어서 재생하고, 잠금 화면 · 이어폰 버튼의 재생 · 일시정지 · 다음 · 이전이 플레이어를 움직인다(2026-10-03)

/** 다음에 이어 들을 카드 번호. 마지막이면 null(돌아가지 않는다) */
export function nextAudioIndex(index: number, total: number): number | null {
  return index + 1 < total ? index + 1 : null;
}

export type AudioMeta = { title: string; artist: string; album: string };

/** 잠금 화면에 보일 제목 · 출처 · 칸 이름. 제목이 없으면 칸 이름 */
export function audioMetadata(
  audio: { title: string; source: "odii" | "khs" | "story" },
  labels: { album: string; odii: string; khs: string; story: string },
): AudioMeta {
  return {
    title: audio.title || labels.album,
    artist: labels[audio.source],
    album: labels.album,
  };
}

export type MediaHandlers = {
  play: () => void;
  pause: () => void;
  next?: () => void;
  prev?: () => void;
};

type SessionLike = {
  metadata: unknown;
  playbackState?: string;
  setActionHandler: (action: string, handler: (() => void) | null) => void;
};

/** navigator.mediaSession이 있으면 돌려준다(없는 브라우저 · 서버에서는 null) */
export function mediaSessionOf(
  nav: unknown = globalThis.navigator,
): SessionLike | null {
  const s = (nav as { mediaSession?: SessionLike } | undefined)?.mediaSession;
  return s && typeof s.setActionHandler === "function" ? s : null;
}

/** 잠금 화면에 지금 해설을 올리고 버튼을 잇는다. 다음 · 이전은 있을 때만(없으면 버튼이 안 보인다) */
export function applyMediaSession(
  session: SessionLike,
  meta: AudioMeta,
  handlers: MediaHandlers,
  makeMetadata: ((meta: AudioMeta) => unknown) | null = typeof MediaMetadata ===
  "function"
    ? (m) => new MediaMetadata(m)
    : null,
): void {
  if (makeMetadata) session.metadata = makeMetadata(meta);
  const set = (action: string, h: (() => void) | undefined) => {
    try {
      session.setActionHandler(action, h ?? null);
    } catch {
      // 지원하지 않는 action은 무시
    }
  };
  set("play", handlers.play);
  set("pause", handlers.pause);
  set("nexttrack", handlers.next);
  set("previoustrack", handlers.prev);
}

/** 재생 상태를 잠금 화면에 알린다 */
export function setPlaybackState(
  session: SessionLike,
  state: "playing" | "paused" | "none",
): void {
  try {
    session.playbackState = state;
  } catch {
    // 읽기 전용인 구현은 무시
  }
}

/** 버튼 연결을 푼다(플레이어가 사라질 때) */
export function clearMediaSession(session: SessionLike): void {
  for (const action of ["play", "pause", "nexttrack", "previoustrack"])
    try {
      session.setActionHandler(action, null);
    } catch {
      // 무시
    }
  setPlaybackState(session, "none");
}
