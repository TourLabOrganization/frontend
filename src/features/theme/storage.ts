import { useLocalValue, writeLocal } from "@/lib/local-store";

// 테마별 북마크 · 스탬프(체크인). localStorage에 장소 id 배열(JSON)로 둔다.
//   tn.bookmarks.{slug} · tn.stamps.{slug}
// 체크인은 목업처럼 사용자가 직접 누르는 토글이다(위치 확인 없음).

export type IdListKind = "bookmarks" | "stamps";

function storageKey(kind: IdListKind, slug: string): string {
  return `tn.${kind}.${slug}`;
}

export function parseIdList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/** 저장된 id 목록과 토글 · 지우기. 서버 렌더와 하이드레이션 중에는 빈 목록 */
export function useIdList(kind: IdListKind, slug: string) {
  const key = storageKey(kind, slug);
  const ids = parseIdList(useLocalValue(key));
  const write = (next: readonly string[]) =>
    writeLocal(key, JSON.stringify(next));
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) =>
      write(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
    remove: (id: string) => write(ids.filter((x) => x !== id)),
  };
}
