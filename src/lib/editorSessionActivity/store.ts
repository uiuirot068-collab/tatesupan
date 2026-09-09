import { addActivity, type ActivityDelta, type SessionActivity, ZERO_ACTIVITY } from "./model";

export const SESSION_ACTIVITY_STORAGE_KEY = "tatespun:editor-session-activity:v1";

type SessionStorageLike = Pick<Storage, "getItem" | "setItem">;

export interface EditorSessionActivityStore {
  read: () => SessionActivity;
  subscribe: (listener: () => void) => () => void;
  record: (delta: ActivityDelta) => void;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseActivity(raw: string | null): SessionActivity {
  if (raw === null) return ZERO_ACTIVITY;
  try {
    const value = JSON.parse(raw) as Partial<SessionActivity>;
    if (
      !isNonNegativeSafeInteger(value.insertedCodePoints) ||
      !isNonNegativeSafeInteger(value.deletedCodePoints)
    ) {
      return ZERO_ACTIVITY;
    }
    return {
      insertedCodePoints: value.insertedCodePoints,
      deletedCodePoints: value.deletedCodePoints,
      totalActivity: value.insertedCodePoints + value.deletedCodePoints,
    };
  } catch {
    return ZERO_ACTIVITY;
  }
}

function browserSessionStorage(): SessionStorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** React-free sessionStorage store, injectable for deterministic Node tests. */
export function createEditorSessionActivityStore(
  getStorage: () => SessionStorageLike | null = browserSessionStorage
): EditorSessionActivityStore {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cachedValue: SessionActivity = ZERO_ACTIVITY;

  function read(): SessionActivity {
    let storage: SessionStorageLike | null = null;
    let raw: string | null = null;
    try {
      storage = getStorage();
      if (!storage) return cachedRaw === undefined ? ZERO_ACTIVITY : cachedValue;
      raw = storage.getItem(SESSION_ACTIVITY_STORAGE_KEY);
    } catch {
      return cachedRaw === undefined ? ZERO_ACTIVITY : cachedValue;
    }
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    cachedValue = parseActivity(raw);
    return cachedValue;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function record(delta: ActivityDelta): void {
    if (delta.insertedCodePoints === 0 && delta.deletedCodePoints === 0) return;
    const next = addActivity(read(), delta);
    const raw = JSON.stringify(next);
    try {
      getStorage()?.setItem(SESSION_ACTIVITY_STORAGE_KEY, raw);
    } catch {
      // The current in-memory session remains usable if storage is disabled.
    }
    cachedRaw = raw;
    cachedValue = next;
    listeners.forEach((listener) => listener());
  }

  return { read, subscribe, record };
}

export const editorSessionActivityStore = createEditorSessionActivityStore();
