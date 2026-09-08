"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Factory shared by the 文章チェック設定 persistence hooks (わたしの辞書 /
 * NGワード / rule-config+preset) -- the same localStorage +
 * `useSyncExternalStore` + cross-instance-notify pattern
 * `useWritingCheckEnabled.ts` already established for the single boolean
 * case, generalized to an arbitrary JSON-serializable value so it is not
 * copy-pasted three times over.
 *
 * Browser-local only, per TSP-LOOP-004 / Phase 3's own privacy
 * requirement: the value never leaves localStorage, never transmitted.
 */
export function createJsonLocalStorageHook<T>(storageKey: string, defaultValue: T) {
  const listeners = new Set<() => void>();

  function read(): T {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  function subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }

  return function useJsonLocalStorageState() {
    const value = useSyncExternalStore(subscribe, read, () => defaultValue);

    const setValue = useCallback((next: T) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore storage write failures (private browsing, disabled storage).
      }
      listeners.forEach((listener) => listener());
    }, []);

    return [value, setValue] as const;
  };
}
