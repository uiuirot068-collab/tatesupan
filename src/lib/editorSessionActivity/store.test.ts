import { describe, expect, it } from "vitest";
import { createEditorSessionActivityStore, SESSION_ACTIVITY_STORAGE_KEY } from "./store";

class FakeSessionStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("11-B sessionStorage persistence", () => {
  it("starts at zero, persists reload, and preserves the same total across document switches", () => {
    const storage = new FakeSessionStorage();
    const firstEditorMount = createEditorSessionActivityStore(() => storage);
    expect(firstEditorMount.read().totalActivity).toBe(0);
    firstEditorMount.record({ insertedCodePoints: 7, deletedCodePoints: 2 });

    // A new store instance models a full reload in the same tab.
    const afterReload = createEditorSessionActivityStore(() => storage);
    expect(afterReload.read()).toEqual({ insertedCodePoints: 7, deletedCodePoints: 2, totalActivity: 9 });

    // No document id participates in the key or API: switching documents in
    // the same tab records into the same session value.
    afterReload.record({ insertedCodePoints: 1, deletedCodePoints: 3 });
    expect(afterReload.read()).toEqual({ insertedCodePoints: 8, deletedCodePoints: 5, totalActivity: 13 });
    expect(Array.from(storage.values.keys())).toEqual([SESSION_ACTIVITY_STORAGE_KEY]);
  });

  it("a future browser-tab session with fresh sessionStorage starts from zero", () => {
    const oldTab = new FakeSessionStorage();
    createEditorSessionActivityStore(() => oldTab).record({ insertedCodePoints: 10, deletedCodePoints: 5 });
    const futureTab = createEditorSessionActivityStore(() => new FakeSessionStorage());
    expect(futureTab.read().totalActivity).toBe(0);
  });

  it("stores only counts in sessionStorage and never requires localStorage, cloud, or a database", () => {
    const storage = new FakeSessionStorage();
    createEditorSessionActivityStore(() => storage).record({ insertedCodePoints: 2, deletedCodePoints: 1 });
    expect(JSON.parse(storage.values.get(SESSION_ACTIVITY_STORAGE_KEY) as string)).toEqual({
      insertedCodePoints: 2,
      deletedCodePoints: 1,
      totalActivity: 3,
    });
  });

  it("rejects corrupted or negative persisted values deterministically", () => {
    const storage = new FakeSessionStorage();
    storage.values.set(SESSION_ACTIVITY_STORAGE_KEY, '{"insertedCodePoints":-1,"deletedCodePoints":2}');
    expect(createEditorSessionActivityStore(() => storage).read().totalActivity).toBe(0);
    storage.values.set(SESSION_ACTIVITY_STORAGE_KEY, "not-json");
    expect(createEditorSessionActivityStore(() => storage).read().totalActivity).toBe(0);
  });
});
