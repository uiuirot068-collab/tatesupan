import type { ActivityDelta } from "./model";

export const WORK_SESSION_STORAGE_KEY = "tatespun:work-sessions:v1";
export const WORK_SESSION_HISTORY_LIMIT = 100;

/** Per-document key; the JSON payload format remains v1-compatible. */
export function workSessionStorageKey(scopeKey: string): string {
  return `${WORK_SESSION_STORAGE_KEY}:${encodeURIComponent(scopeKey)}`;
}

type LocalStorageLike = Pick<Storage, "getItem" | "setItem">;

export type WorkSessionStatus = "active" | "paused";

export interface ActiveWorkSession {
  id: string;
  startedAt: number;
  writtenCharacterCount: number;
  status: WorkSessionStatus;
  pausedAt: number | null;
  accumulatedPausedMs: number;
}

export interface CompletedWorkSession {
  id: string;
  startedAt: number;
  writtenCharacterCount: number;
  endedAt: number;
  durationMs: number;
}

export interface WorkSessionState {
  active: ActiveWorkSession | null;
  history: readonly CompletedWorkSession[];
}

export const EMPTY_WORK_SESSION_STATE: WorkSessionState = Object.freeze({
  active: null,
  history: Object.freeze([]),
});

export interface WorkSessionStore {
  read: () => WorkSessionState;
  subscribe: (listener: () => void) => () => void;
  start: (startedAt?: number) => ActiveWorkSession;
  pause: (pausedAt?: number) => ActiveWorkSession | null;
  resume: (resumedAt?: number) => ActiveWorkSession | null;
  record: (delta: ActivityDelta) => void;
  end: (endedAt?: number) => CompletedWorkSession | null;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSessionId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

function parseActive(value: unknown): ActiveWorkSession | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ActiveWorkSession>;
  const legacyCandidate = value as { editingActivity?: unknown };
  const writtenCharacterCount = isNonNegativeSafeInteger(candidate.writtenCharacterCount)
    ? candidate.writtenCharacterCount
    : legacyCandidate.editingActivity;
  if (
    !isSessionId(candidate.id) ||
    !isNonNegativeSafeInteger(candidate.startedAt) ||
    !isNonNegativeSafeInteger(writtenCharacterCount)
  ) {
    return null;
  }
  const accumulatedPausedMs = isNonNegativeSafeInteger(candidate.accumulatedPausedMs)
    ? candidate.accumulatedPausedMs
    : 0;
  const persistedPausedAt = isNonNegativeSafeInteger(candidate.pausedAt)
    ? candidate.pausedAt
    : null;
  const isValidPause =
    candidate.status === "paused" &&
    persistedPausedAt !== null &&
    persistedPausedAt >= candidate.startedAt;
  return {
    id: candidate.id,
    startedAt: candidate.startedAt,
    writtenCharacterCount,
    status: isValidPause ? "paused" : "active",
    pausedAt: isValidPause ? persistedPausedAt : null,
    accumulatedPausedMs,
  };
}

function parseCompleted(value: unknown): CompletedWorkSession | null {
  const active = parseActive(value);
  if (!active || !value || typeof value !== "object") return null;
  const candidate = value as Partial<CompletedWorkSession>;
  if (
    !isNonNegativeSafeInteger(candidate.endedAt) ||
    !isNonNegativeSafeInteger(candidate.durationMs) ||
    candidate.endedAt < active.startedAt
  ) {
    return null;
  }
  return {
    id: active.id,
    startedAt: active.startedAt,
    writtenCharacterCount: active.writtenCharacterCount,
    endedAt: candidate.endedAt,
    durationMs: candidate.durationMs,
  };
}

/** Active work time excludes every completed pause and the current pause. */
export function activeWorkDurationMs(session: ActiveWorkSession, now: number): number {
  const safeNow = Math.max(now, session.startedAt);
  const currentPauseMs = session.status === "paused" && session.pausedAt !== null
    ? Math.max(0, safeNow - session.pausedAt)
    : 0;
  return Math.max(
    0,
    safeNow - session.startedAt - session.accumulatedPausedMs - currentPauseMs
  );
}

function parseState(raw: string | null): WorkSessionState {
  if (raw === null) return EMPTY_WORK_SESSION_STATE;
  try {
    const value = JSON.parse(raw) as { active?: unknown; history?: unknown };
    const active = parseActive(value.active);
    const history = Array.isArray(value.history)
      ? value.history
          .map(parseCompleted)
          .filter((record): record is CompletedWorkSession => record !== null)
          .slice(-WORK_SESSION_HISTORY_LIMIT)
      : [];
    if (active === null && history.length === 0) return EMPTY_WORK_SESSION_STATE;
    return { active, history };
  } catch {
    return EMPTY_WORK_SESSION_STATE;
  }
}

function browserLocalStorage(): LocalStorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let fallbackIdSequence = 0;

function createStableId(startedAt: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackIdSequence += 1;
  return `${startedAt}-${fallbackIdSequence}`;
}

/** React-free localStorage store, injectable for deterministic Node tests. */
export function createWorkSessionStore(
  getStorage: () => LocalStorageLike | null = browserLocalStorage,
  createId: (startedAt: number) => string = createStableId,
  storageKey: string = WORK_SESSION_STORAGE_KEY,
): WorkSessionStore {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cachedValue: WorkSessionState = EMPTY_WORK_SESSION_STATE;
  let storageUnavailable = false;

  function read(): WorkSessionState {
    if (storageUnavailable) return cachedValue;
    try {
      const storage = getStorage();
      if (!storage) return cachedRaw === undefined ? EMPTY_WORK_SESSION_STATE : cachedValue;
      const raw = storage.getItem(storageKey);
      if (raw === cachedRaw) return cachedValue;
      cachedRaw = raw;
      cachedValue = parseState(raw);
      return cachedValue;
    } catch {
      storageUnavailable = true;
      return cachedRaw === undefined ? EMPTY_WORK_SESSION_STATE : cachedValue;
    }
  }

  function publish(next: WorkSessionState): void {
    const raw = JSON.stringify(next);
    cachedRaw = raw;
    cachedValue = next;
    try {
      const storage = getStorage();
      if (storage) {
        storage.setItem(storageKey, raw);
        storageUnavailable = false;
      }
    } catch {
      storageUnavailable = true;
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function start(startedAt = Date.now()): ActiveWorkSession {
    const current = read();
    if (current.active) return current.active;
    const active = {
      id: createId(startedAt),
      startedAt,
      writtenCharacterCount: 0,
      status: "active" as const,
      pausedAt: null,
      accumulatedPausedMs: 0,
    };
    publish({ active, history: current.history });
    return active;
  }

  function pause(pausedAt = Date.now()): ActiveWorkSession | null {
    const current = read();
    if (!current.active) return null;
    if (current.active.status === "paused") return current.active;
    const active: ActiveWorkSession = {
      ...current.active,
      status: "paused",
      pausedAt: Math.max(pausedAt, current.active.startedAt),
    };
    publish({ active, history: current.history });
    return active;
  }

  function resume(resumedAt = Date.now()): ActiveWorkSession | null {
    const current = read();
    if (!current.active) return null;
    if (current.active.status === "active") return current.active;
    const pausedAt = current.active.pausedAt ?? current.active.startedAt;
    const safeResumedAt = Math.max(resumedAt, pausedAt);
    const active: ActiveWorkSession = {
      ...current.active,
      status: "active",
      pausedAt: null,
      accumulatedPausedMs:
        current.active.accumulatedPausedMs + (safeResumedAt - pausedAt),
    };
    publish({ active, history: current.history });
    return active;
  }

  function record(delta: ActivityDelta): void {
    const writtenCharacters = delta.insertedCodePoints;
    if (writtenCharacters <= 0) return;
    const current = read();
    if (!current.active || current.active.status !== "active") return;
    publish({
      active: {
        ...current.active,
        writtenCharacterCount: current.active.writtenCharacterCount + writtenCharacters,
      },
      history: current.history,
    });
  }

  function end(endedAt = Date.now()): CompletedWorkSession | null {
    const current = read();
    if (!current.active) return null;
    const safeEndedAt = Math.max(
      endedAt,
      current.active.startedAt,
      current.active.pausedAt ?? 0
    );
    const completed: CompletedWorkSession = {
      id: current.active.id,
      startedAt: current.active.startedAt,
      writtenCharacterCount: current.active.writtenCharacterCount,
      endedAt: safeEndedAt,
      durationMs: activeWorkDurationMs(current.active, safeEndedAt),
    };
    publish({
      active: null,
      history: [...current.history, completed].slice(-WORK_SESSION_HISTORY_LIMIT),
    });
    return completed;
  }

  return { read, subscribe, start, pause, resume, record, end };
}

export const workSessionStore = createWorkSessionStore();

const scopedStores = new Map<string, WorkSessionStore>();

/** Stable store instance for React subscriptions, isolated by document. */
export function workSessionStoreFor(scopeKey: string): WorkSessionStore {
  const storageKey = workSessionStorageKey(scopeKey);
  const existing = scopedStores.get(storageKey);
  if (existing) return existing;
  const store = createWorkSessionStore(browserLocalStorage, createStableId, storageKey);
  scopedStores.set(storageKey, store);
  return store;
}
