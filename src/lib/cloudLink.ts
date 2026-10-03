// CST-PORT-014: which cloud work a local work (このブラウザの本棚) was saved to.
//
// Before this, every editor screen started unlinked, so 「クラウドに保存」 from a
// reopened local work — or the same work in a second tab — created a NEW cloud
// work each time, and the newer-version check never ran. The link is kept per
// browser (localStorage), keyed by the local work's id. Storage can be
// unavailable (private mode, blocked site data): then it behaves as before.

const keyFor = (docId: number) => `tatespun:cloud-link:local:${docId}`;

type LinkStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): LinkStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readCloudLink(docId: number, storage: LinkStorage | null = defaultStorage()): string | null {
  try {
    const value = storage?.getItem(keyFor(docId));
    return value ? value : null;
  } catch {
    return null;
  }
}

export function writeCloudLink(docId: number, projectId: string, storage: LinkStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(keyFor(docId), projectId);
  } catch {
    // best effort
  }
}

export function clearCloudLink(docId: number, storage: LinkStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(keyFor(docId));
  } catch {
    // best effort
  }
}
