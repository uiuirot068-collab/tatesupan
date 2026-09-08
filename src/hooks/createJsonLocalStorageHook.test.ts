/**
 * Regression coverage for the useSyncExternalStore snapshot-identity bug
 * found in real Human QA (checkpoint `2d7f544`): selecting a Writing
 * Check preset persisted JSON to localStorage, and every subsequent
 * `getSnapshot()` call then reparsed it into a NEW object, which React
 * treats as "the snapshot changed every render" -> "The result of
 * getSnapshot should be cached to avoid an infinite loop".
 *
 * Exercises `createJsonLocalStorageStore` directly -- the pure store
 * behind the React hook -- against a plain stub `window` (no jsdom, no
 * new dependency): only `localStorage.getItem/setItem` and
 * `addEventListener/removeEventListener("storage", ...)` are ever
 * touched by this module.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createJsonLocalStorageStore } from "./createJsonLocalStorageHook";

class FakeLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

type StorageListener = (event: { key: string | null }) => void;

function installFakeWindow(): { storageListeners: StorageListener[] } {
  const storageListeners: StorageListener[] = [];
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: new FakeLocalStorage(),
    addEventListener: (type: string, fn: StorageListener) => {
      if (type === "storage") storageListeners.push(fn);
    },
    removeEventListener: (type: string, fn: StorageListener) => {
      if (type !== "storage") return;
      const i = storageListeners.indexOf(fn);
      if (i >= 0) storageListeners.splice(i, 1);
    },
  };
  return { storageListeners };
}

let fakeWindow: ReturnType<typeof installFakeWindow>;

beforeEach(() => {
  fakeWindow = installFakeWindow();
});

describe("createJsonLocalStorageStore -- snapshot identity", () => {
  it("1. same stored JSON string -> read() returns the SAME object identity across calls", () => {
    const store = createJsonLocalStorageStore<{ n: number }>("k1", { n: 0 });
    store.write({ n: 5 });
    const a = store.read();
    const b = store.read();
    const c = store.read();
    expect(Object.is(a, b)).toBe(true);
    expect(Object.is(b, c)).toBe(true);
  });

  it("2. changed stored JSON -> a NEW snapshot identity", () => {
    const store = createJsonLocalStorageStore<{ n: number }>("k2", { n: 0 });
    store.write({ n: 1 });
    const first = store.read();
    store.write({ n: 2 });
    const second = store.read();
    expect(Object.is(first, second)).toBe(false);
  });

  it("3. a changed value is correctly parsed back", () => {
    const store = createJsonLocalStorageStore<{ n: number }>("k3", { n: 0 });
    store.write({ n: 1 });
    expect(store.read()).toEqual({ n: 1 });
    store.write({ n: 42 });
    expect(store.read()).toEqual({ n: 42 });
  });

  it("4. a missing localStorage key returns a stable snapshot (the same defaultValue reference every call)", () => {
    const defaultValue = { n: 0 };
    const store = createJsonLocalStorageStore<{ n: number }>("k4-missing", defaultValue);
    const a = store.read();
    const b = store.read();
    expect(Object.is(a, defaultValue)).toBe(true);
    expect(Object.is(a, b)).toBe(true);
  });

  it("5. invalid JSON in localStorage falls back to the default value, stably (no repeated parse attempts / no thrown error)", () => {
    const defaultValue = { n: 0 };
    const store = createJsonLocalStorageStore<{ n: number }>("k5-invalid", defaultValue);
    window.localStorage.setItem("k5-invalid", "{not valid json");
    const a = store.read();
    const b = store.read();
    expect(a).toEqual(defaultValue);
    expect(Object.is(a, b)).toBe(true);
  });

  it("6. array (わたしの辞書 shape) snapshot is stable across repeated reads", () => {
    const store = createJsonLocalStorageStore<Array<{ id: string; preferred: string; variants: string[] }>>("k6-dict", []);
    store.write([{ id: "d1", preferred: "サーバー", variants: ["サーバ"] }]);
    const a = store.read();
    const b = store.read();
    expect(Object.is(a, b)).toBe(true);
    expect(a).toEqual([{ id: "d1", preferred: "サーバー", variants: ["サーバ"] }]);
  });

  it("7. array (NGワード shape) snapshot is stable across repeated reads", () => {
    const store = createJsonLocalStorageStore<Array<{ id: string; term: string }>>("k7-ng", []);
    store.write([{ id: "n1", term: "禁止語" }]);
    const a = store.read();
    const b = store.read();
    expect(Object.is(a, b)).toBe(true);
  });

  it("8. object (rule-config/preset shape) snapshot is stable across repeated reads -- the exact real-world repro (記号だけ preset selection)", () => {
    const store = createJsonLocalStorageStore<{ presetId: string | null; ruleOverrides: Record<string, boolean> }>("k8-ruleconfig", {
      presetId: "submission-recommended",
      ruleOverrides: {},
    });
    store.write({ presetId: "symbols-only", ruleOverrides: { "R1-bracket": true, "R6-trailing-whitespace": false } });
    const a = store.read();
    const b = store.read();
    const c = store.read();
    expect(Object.is(a, b)).toBe(true);
    expect(Object.is(b, c)).toBe(true);
  });

  it("9. setter/subscriber semantics: write() persists, notifies subscribers, and unsubscribe stops further notifications", () => {
    const store = createJsonLocalStorageStore<{ n: number }>("k9", { n: 0 });
    let notifyCount = 0;
    const unsubscribe = store.subscribe(() => {
      notifyCount += 1;
    });

    store.write({ n: 1 });
    expect(notifyCount).toBe(1);
    expect(store.read()).toEqual({ n: 1 });

    unsubscribe();
    store.write({ n: 2 });
    expect(notifyCount).toBe(1); // no further notification after unsubscribe
    expect(store.read()).toEqual({ n: 2 }); // read() itself still reflects the latest value
  });

  it("9b. a cross-tab storage event for a DIFFERENT key does not notify; for THIS key does", () => {
    const store = createJsonLocalStorageStore<{ n: number }>("k9b", { n: 0 });
    let notifyCount = 0;
    store.subscribe(() => {
      notifyCount += 1;
    });

    fakeWindow.storageListeners.forEach((fn) => fn({ key: "some-other-key" }));
    expect(notifyCount).toBe(0);

    fakeWindow.storageListeners.forEach((fn) => fn({ key: "k9b" }));
    expect(notifyCount).toBe(1);
  });

  it("10. no infinite render-triggering snapshot churn: 100 consecutive reads after one write all return the identical reference", () => {
    const store = createJsonLocalStorageStore<{ n: number }>("k10", { n: 0 });
    store.write({ n: 7 });
    const first = store.read();
    for (let i = 0; i < 100; i++) {
      expect(Object.is(store.read(), first)).toBe(true);
    }
  });
});
