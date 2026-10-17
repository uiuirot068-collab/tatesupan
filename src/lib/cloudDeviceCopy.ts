/**
 * TSP-SAFE-001: a cloud work opened in this browser is kept here too, as ONE
 * "device copy" (an ordinary work on この端末の本棚, linked to the cloud work).
 *
 * Before this, a work opened from the cloud lived only on the screen: no
 * autosave, and closing the tab lost everything not sent with クラウドに保存.
 *
 * Opening the same cloud work again reuses its device copy (never a new copy
 * per open). The copy remembers which cloud version it last matched
 * (`CloudSyncRecord`), so opening can tell whether it holds text not yet sent
 * to the cloud, and never overwrites such text silently.
 */

/** Which cloud version the device copy last matched (opened or saved). */
export interface CloudSyncRecord {
  projectId: string;
  /** projects.updated_at of that version (set by the database). */
  updatedAt: string | null;
  /** contentHash(title, content) of that version. */
  hash: string;
}

/**
 * Small, fast fingerprint of a manuscript (cyrb53). Used only to tell "same
 * text as last time" from "changed", never as a security measure.
 */
export function contentHash(title: string, content: string): string {
  const text = `${title}\u0000${content}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${text.length.toString(36)}-${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`;
}

export type DeviceCopyDecision =
  /** No device copy yet: make one from the cloud version. */
  | "create"
  /** The copy has nothing unsent: bring it to the cloud version. */
  | "replace"
  /** The copy has unsent text and the cloud did not change since: open the copy as it is. */
  | "keep-local"
  /** Both changed: keep the copy's text as a separate work, then bring the copy to the cloud version. */
  | "rescue-then-replace";

export function decideDeviceCopy(
  local: { hash: string; sync: CloudSyncRecord | null } | null,
  cloud: { updatedAt: string | null; hash: string }
): DeviceCopyDecision {
  if (!local) return "create";
  if (local.hash === cloud.hash) return "replace";
  const sync = local.sync;
  // Without a record of the last matched version, the copy may hold unsent
  // text: never overwrite it silently.
  if (!sync) return "rescue-then-replace";
  const hasUnsent = local.hash !== sync.hash;
  if (!hasUnsent) return "replace";
  const cloudUnchanged = sync.updatedAt !== null && cloud.updatedAt === sync.updatedAt && cloud.hash === sync.hash;
  return cloudUnchanged ? "keep-local" : "rescue-then-replace";
}

// Which local work is the device copy of a cloud work (reverse of
// lib/cloudLink.ts). Per browser, like the forward link.
const deviceCopyKey = (projectId: string) => `tatespun:device-copy:cloud:${projectId}`;

type CopyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): CopyStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readDeviceCopyId(projectId: string, storage: CopyStorage | null = defaultStorage()): number | null {
  try {
    const value = storage?.getItem(deviceCopyKey(projectId));
    const id = value ? Number(value) : NaN;
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

export function writeDeviceCopyId(projectId: string, docId: number, storage: CopyStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(deviceCopyKey(projectId), String(docId));
  } catch {
    // best effort: without it, the copy is found by its CloudSyncRecord
  }
}
