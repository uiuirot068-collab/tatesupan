/**
 * TSP-SAFE-004: rules of the bookshelf's ゴミ箱 (trash) and of tidying
 * illustrations nothing uses any more. Pure; the IndexedDB side is in db.ts.
 */

/** A deleted work stays in the trash this long, then is removed for good. */
export const TRASH_KEEP_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * An illustration no work uses is removed only after it is this old: a tab
 * that just added one saves the work a moment later (autosave), so a fresh
 * image without a work yet is not an orphan.
 */
export const ORPHAN_IMAGE_MIN_AGE_MS = 7 * DAY_MS;

export function trashExpiresAt(trashedAt: number): number {
  return trashedAt + TRASH_KEEP_DAYS * DAY_MS;
}

export function isTrashExpired(trashedAt: number, now: number): boolean {
  return now >= trashExpiresAt(trashedAt);
}

/** Whole days left before the work is removed for good (never below 0). */
export function trashDaysLeft(trashedAt: number, now: number): number {
  return Math.max(0, Math.ceil((trashExpiresAt(trashedAt) - now) / DAY_MS));
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
