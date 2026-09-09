import { describe, expect, it } from "vitest";
import {
  createWorkSessionStore,
  WORK_SESSION_HISTORY_LIMIT,
  WORK_SESSION_STORAGE_KEY,
} from "./store";

class FakeLocalStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function testStore(storage = new FakeLocalStorage()) {
  let id = 0;
  return {
    storage,
    store: createWorkSessionStore(() => storage, () => `work-${++id}`),
  };
}

describe("11-B explicit work-session lifecycle", () => {
  it("1. idle edits do not count or create persisted state", () => {
    const { store, storage } = testStore();
    store.record({ insertedCodePoints: 5, deletedCodePoints: 3 });
    expect(store.read()).toEqual({ active: null, history: [] });
    expect(storage.getItem(WORK_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("2. Start creates a stable active session beginning at zero", () => {
    const { store } = testStore();
    expect(store.start(1_000)).toEqual({ id: "work-1", startedAt: 1_000, editingActivity: 0 });
    expect(store.start(2_000)).toEqual({ id: "work-1", startedAt: 1_000, editingActivity: 0 });
  });

  it("3-8. active typing, deletion, replacement, IME commit, Undo, and Redo deltas all accumulate", () => {
    const { store } = testStore();
    store.start(1_000);
    for (const delta of [
      { insertedCodePoints: 3, deletedCodePoints: 0 },
      { insertedCodePoints: 0, deletedCodePoints: 2 },
      { insertedCodePoints: 5, deletedCodePoints: 3 },
      { insertedCodePoints: 2, deletedCodePoints: 0 },
      { insertedCodePoints: 0, deletedCodePoints: 4 },
      { insertedCodePoints: 4, deletedCodePoints: 0 },
    ]) {
      store.record(delta);
    }
    expect(store.read().active?.editingActivity).toBe(23);
  });

  it("9-10. End freezes the result and later idle edits cannot alter it", () => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 7, deletedCodePoints: 2 });
    const completed = store.end(61_000);
    expect(completed).toEqual({
      id: "work-1",
      startedAt: 1_000,
      endedAt: 61_000,
      durationMs: 60_000,
      editingActivity: 9,
    });
    store.record({ insertedCodePoints: 100, deletedCodePoints: 100 });
    expect(store.read()).toEqual({ active: null, history: [completed] });
  });

  it("11. a reload restores active id, start time, and aggregate activity", () => {
    const { store, storage } = testStore();
    store.start(10_000);
    store.record({ insertedCodePoints: 8, deletedCodePoints: 1 });
    const afterReload = createWorkSessionStore(() => storage, () => "must-not-be-used");
    expect(afterReload.read().active).toEqual({
      id: "work-1",
      startedAt: 10_000,
      editingActivity: 9,
    });
  });

  it("12. a new session starts at zero while prior history remains", () => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 12, deletedCodePoints: 0 });
    store.end(2_000);
    store.start(3_000);
    expect(store.read().active?.editingActivity).toBe(0);
    expect(store.read().history).toHaveLength(1);
    expect(store.read().history[0].editingActivity).toBe(12);
  });

  it("13. completed history persists across a reload", () => {
    const { store, storage } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 4, deletedCodePoints: 2 });
    const completed = store.end(4_000);
    const afterReload = createWorkSessionStore(() => storage);
    expect(afterReload.read().history).toEqual([completed]);
  });

  it("14-15. history is capped at 100 and evicts the oldest record first", () => {
    const { store } = testStore();
    for (let index = 0; index < WORK_SESSION_HISTORY_LIMIT + 1; index += 1) {
      const startedAt = index * 10 + 1;
      store.start(startedAt);
      store.record({ insertedCodePoints: index, deletedCodePoints: 0 });
      store.end(startedAt + 5);
    }
    const history = store.read().history;
    expect(history).toHaveLength(WORK_SESSION_HISTORY_LIMIT);
    expect(history[0].id).toBe("work-2");
    expect(history.at(-1)?.id).toBe("work-101");
  });

  it("17. persistence contains metadata only and never manuscript text", () => {
    const { store, storage } = testStore();
    const manuscript = "絶対に保存してはいけない原稿本文";
    store.start(1_000);
    store.record({ insertedCodePoints: Array.from(manuscript).length, deletedCodePoints: 0 });
    store.end(2_000);
    const raw = storage.getItem(WORK_SESSION_STORAGE_KEY) as string;
    expect(raw).not.toContain(manuscript);
    expect(JSON.parse(raw)).toEqual({
      active: null,
      history: [{
        id: "work-1",
        startedAt: 1_000,
        editingActivity: Array.from(manuscript).length,
        endedAt: 2_000,
        durationMs: 1_000,
      }],
    });
  });

  it("rejects corrupted persisted values without starting automatically", () => {
    const storage = new FakeLocalStorage();
    storage.setItem(WORK_SESSION_STORAGE_KEY, "not-json");
    expect(createWorkSessionStore(() => storage).read()).toEqual({ active: null, history: [] });
  });
});
