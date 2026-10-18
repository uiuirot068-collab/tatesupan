/**
 * TSP-SAFE-004: rules of the bookshelf's ゴミ箱 (trash) and of the
 * illustrations a removed work leaves. Pure; the IndexedDB side is in db.ts.
 */

/** A deleted work stays in the trash this long, then is removed for good. */
export const TRASH_KEEP_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function trashExpiresAt(trashedAt: number): number {
  return trashedAt + TRASH_KEEP_DAYS * DAY_MS;
}

export function isTrashExpired(trashedAt: number, now: number): boolean {
  return now >= trashExpiresAt(trashedAt);
}

/**
 * Whole days left before the work is removed for good: never below 0, and
 * never above TRASH_KEEP_DAYS (PC QA: a clock a little behind showed 31).
 */
export function trashDaysLeft(trashedAt: number, now: number): number {
  const left = Math.ceil((trashExpiresAt(trashedAt) - now) / DAY_MS);
  return Math.min(TRASH_KEEP_DAYS, Math.max(0, left));
}

/**
 * Which of `imageIds` no work mentions anywhere. A work is searched as a
 * whole (text, memo, settings such as the cover), so an image used in any
 * way — including ways added later — is never taken for unused.
 */
export function unreferencedImageIds(imageIds: Iterable<string>, works: Iterable<unknown>): string[] {
  const haystacks = Array.from(works, (work) => JSON.stringify(work) ?? "");
  const unused: string[] = [];
  for (const id of imageIds) {
    if (!id) continue;
    if (!haystacks.some((text) => text.includes(id))) unused.push(id);
  }
  return unused;
}

// TSP-SAFE-004 QA: illustrations of works saved to the cloud are never tidied
// away from this browser while the cloud work exists — the cloud keeps its
// copy only 72 hours, and the work can be opened from the cloud again. Kept
// per browser (localStorage) by cloud work, and released when that cloud
// work is deleted from 保存作品一覧 (QA2: before, the list only grew).
const CLOUD_WORK_IMAGES_KEY = "tatespun:cloud-work-images";

type KeepStorage = Pick<Storage, "getItem" | "setItem">;

function keepStorage(): KeepStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readKept(storage: KeepStorage | null): Record<string, string[]> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(CLOUD_WORK_IMAGES_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string[]> = {};
    for (const [projectId, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(ids)) out[projectId] = ids.filter((id): id is string => typeof id === "string");
    }
    return out;
  } catch {
    return {};
  }
}

export function keptCloudWorkImageIds(storage: KeepStorage | null = keepStorage()): Set<string> {
  return new Set(Object.values(readKept(storage)).flat());
}

export function keepCloudWorkImages(projectId: string, ids: readonly string[], storage: KeepStorage | null = keepStorage()): void {
  if (ids.length === 0) return;
  try {
    const kept = readKept(storage);
    kept[projectId] = [...new Set([...(kept[projectId] ?? []), ...ids])];
    storage?.setItem(CLOUD_WORK_IMAGES_KEY, JSON.stringify(kept));
  } catch {
    // best effort
  }
}

export function releaseCloudWorkImages(projectId: string, storage: KeepStorage | null = keepStorage()): void {
  try {
    const kept = readKept(storage);
    if (!(projectId in kept)) return;
    delete kept[projectId];
    storage?.setItem(CLOUD_WORK_IMAGES_KEY, JSON.stringify(kept));
  } catch {
    // best effort
  }
}
