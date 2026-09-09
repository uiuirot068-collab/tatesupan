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

describe("11-B newly written character counting", () => {
  it("idle input does not create or change a work session", () => {
    const { store, storage } = testStore();
    store.record({ insertedCodePoints: 5, deletedCodePoints: 0 });
    expect(store.read()).toEqual({ active: null, history: [] });
    expect(storage.getItem(WORK_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("1. typing 10 counts 10", () => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 10, deletedCodePoints: 0 });
    expect(store.read().active?.writtenCharacterCount).toBe(10);
  });

  it("2. deleting after typing does not increase or decrease the written count", () => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 10, deletedCodePoints: 0 });
    store.record({ insertedCodePoints: 0, deletedCodePoints: 10 });
    expect(store.read().active?.writtenCharacterCount).toBe(10);
  });

  it.each([
    ["3. Backspace", 1],
    ["4. Delete", 1],
    ["5. selection delete", 3],
    ["6. Cut", 4],
  ])("%s adds zero", (_operation, deletedCodePoints) => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 0, deletedCodePoints });
    expect(store.read().active?.writtenCharacterCount).toBe(0);
  });

  it("7. replacing 3 characters with 5 counts only the inserted 5", () => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 5, deletedCodePoints: 3 });
    expect(store.read().active?.writtenCharacterCount).toBe(5);
  });

  it("8. pasting 100 characters counts 100", () => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 100, deletedCodePoints: 0 });
    expect(store.read().active?.writtenCharacterCount).toBe(100);
  });

  it("9. pasting 100 over a 20-character selection still counts only 100", () => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 100, deletedCodePoints: 20 });
    expect(store.read().active?.writtenCharacterCount).toBe(100);
  });

  it("15. End freezes the final written count and idle mutations cannot alter it", () => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 7, deletedCodePoints: 2 });
    const completed = store.end(61_000);
    expect(completed).toEqual({
      id: "work-1",
      startedAt: 1_000,
      endedAt: 61_000,
      durationMs: 60_000,
      writtenCharacterCount: 7,
    });
    store.record({ insertedCodePoints: 100, deletedCodePoints: 0 });
    expect(store.read()).toEqual({ active: null, history: [completed] });
  });

  it("16. reload restores the same active written count", () => {
    const { store, storage } = testStore();
    store.start(10_000);
    store.record({ insertedCodePoints: 8, deletedCodePoints: 9 });
    const afterReload = createWorkSessionStore(() => storage, () => "must-not-be-used");
    expect(afterReload.read().active).toEqual({
      id: "work-1",
      startedAt: 10_000,
      writtenCharacterCount: 8,
    });
  });

  it("17. a new session starts at zero while prior history remains", () => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 12, deletedCodePoints: 8 });
    store.end(2_000);
    store.start(3_000);
    expect(store.read().active?.writtenCharacterCount).toBe(0);
    expect(store.read().history[0].writtenCharacterCount).toBe(12);
  });

  it("18. completed history persists the final written count", () => {
    const { store, storage } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 4, deletedCodePoints: 20 });
    const completed = store.end(4_000);
    const afterReload = createWorkSessionStore(() => storage);
    expect(afterReload.read().history).toEqual([completed]);
    expect(afterReload.read().history[0].writtenCharacterCount).toBe(4);
  });

  it("keeps the latest 100 records and evicts the oldest first", () => {
    const { store } = testStore();
    for (let index = 0; index < WORK_SESSION_HISTORY_LIMIT + 1; index += 1) {
      const startedAt = index * 10 + 1;
      store.start(startedAt);
      store.record({ insertedCodePoints: index, deletedCodePoints: index });
      store.end(startedAt + 5);
    }
    const history = store.read().history;
    expect(history).toHaveLength(WORK_SESSION_HISTORY_LIMIT);
    expect(history[0].id).toBe("work-2");
    expect(history.at(-1)?.id).toBe("work-101");
  });

  it("defensively migrates legacy editingActivity records without losing history", () => {
    const storage = new FakeLocalStorage();
    storage.setItem(WORK_SESSION_STORAGE_KEY, JSON.stringify({
      active: { id: "legacy-active", startedAt: 1_000, editingActivity: 7 },
      history: [{
        id: "legacy-completed",
        startedAt: 100,
        endedAt: 200,
        durationMs: 100,
        editingActivity: 9,
      }],
    }));
    expect(createWorkSessionStore(() => storage).read()).toEqual({
      active: { id: "legacy-active", startedAt: 1_000, writtenCharacterCount: 7 },
      history: [{
        id: "legacy-completed",
        startedAt: 100,
        endedAt: 200,
        durationMs: 100,
        writtenCharacterCount: 9,
      }],
    });
  });

  it("stores metadata only and never manuscript text", () => {
    const { store, storage } = testStore();
    const manuscript = "絶対に保存してはいけない原稿本文";
    store.start(1_000);
    store.record({ insertedCodePoints: Array.from(manuscript).length, deletedCodePoints: 0 });
    store.end(2_000);
    const raw = storage.getItem(WORK_SESSION_STORAGE_KEY) as string;
    expect(raw).not.toContain(manuscript);
    expect(raw).not.toContain("editingActivity");
    expect(JSON.parse(raw).history[0].writtenCharacterCount).toBe(Array.from(manuscript).length);
  });

  it("rejects corrupted persisted values without starting automatically", () => {
    const storage = new FakeLocalStorage();
    storage.setItem(WORK_SESSION_STORAGE_KEY, "not-json");
    expect(createWorkSessionStore(() => storage).read()).toEqual({ active: null, history: [] });
  });
});
