import type { ActivityDelta } from "./model";

export const WORK_SESSION_STORAGE_KEY = "tatespun:work-sessions:v1";
export const WORK_SESSION_HISTORY_LIMIT = 100;

type LocalStorageLike = Pick<Storage, "getItem" | "setItem">;

export interface ActiveWorkSession {
  id: string;
  startedAt: number;
  writtenCharacterCount: number;
}

export interface CompletedWorkSession extends ActiveWorkSession {
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
  return {
    id: candidate.id,
    startedAt: candidate.startedAt,
    writtenCharacterCount,
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
    ...active,
    endedAt: candidate.endedAt,
    durationMs: candidate.durationMs,
  };
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
  createId: (startedAt: number) => string = createStableId
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
      const raw = storage.getItem(WORK_SESSION_STORAGE_KEY);
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
        storage.setItem(WORK_SESSION_STORAGE_KEY, raw);
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
    };
    publish({ active, history: current.history });
    return active;
  }

  function record(delta: ActivityDelta): void {
    const writtenCharacters = delta.insertedCodePoints;
    if (writtenCharacters <= 0) return;
    const current = read();
    if (!current.active) return;
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
    const safeEndedAt = Math.max(endedAt, current.active.startedAt);
    const completed: CompletedWorkSession = {
      ...current.active,
      endedAt: safeEndedAt,
      durationMs: safeEndedAt - current.active.startedAt,
    };
    publish({
      active: null,
      history: [...current.history, completed].slice(-WORK_SESSION_HISTORY_LIMIT),
    });
    return completed;
  }

  return { read, subscribe, start, record, end };
}

export const workSessionStore = createWorkSessionStore();
