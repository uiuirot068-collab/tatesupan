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

export interface JsonLocalStorageStore<T> {
  /** `useSyncExternalStore`'s own client `getSnapshot` -- see its own doc for the identity-caching contract this must satisfy. */
  read: () => T;
  subscribe: (onChange: () => void) => () => void;
  write: (next: T) => void;
}

/**
 * The pure, React-free store behind `createJsonLocalStorageHook` below --
 * split out so its snapshot-identity contract can be tested directly
 * (with a plain stub `window`, no jsdom) without going through React at
 * all.
 *
 * `useSyncExternalStore` requires `getSnapshot()` to return the SAME
 * object identity across calls whenever the underlying store hasn't
 * actually changed -- a `getSnapshot` that reparses (and so reallocates)
 * on every call is treated by React as "the snapshot changed on every
 * render", which is exactly the "The result of getSnapshot should be
 * cached to avoid an infinite loop" failure. `read()` here caches by the
 * raw serialized string: a JSON.parse only ever runs again once the
 * string itself has actually changed.
 */
export function createJsonLocalStorageStore<T>(storageKey: string, defaultValue: T): JsonLocalStorageStore<T> {
  const listeners = new Set<() => void>();
  let hasCached = false;
  let cachedRaw: string | null = null;
  let cachedParsed: T = defaultValue;

  function read(): T {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(storageKey);
    } catch {
      raw = null;
    }

    if (hasCached && raw === cachedRaw) return cachedParsed;

    if (raw === null) {
      cachedParsed = defaultValue;
    } else {
      try {
        cachedParsed = JSON.parse(raw) as T;
      } catch {
        // Invalid JSON (corrupted/foreign write) -- fall back deterministically,
        // and still cache against THIS raw string so a repeated read of the
        // same invalid value doesn't keep re-attempting the parse.
        cachedParsed = defaultValue;
      }
    }
    cachedRaw = raw;
    hasCached = true;
    return cachedParsed;
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

  function write(next: T): void {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore storage write failures (private browsing, disabled storage).
    }
    listeners.forEach((listener) => listener());
  }

  return { read, subscribe, write };
}

export function createJsonLocalStorageHook<T>(storageKey: string, defaultValue: T) {
  const store = createJsonLocalStorageStore(storageKey, defaultValue);

  return function useJsonLocalStorageState() {
    // `getServerSnapshot` (3rd arg) is the SAME constant `defaultValue`
    // reference every call -- React never invokes `store.read` during SSR
    // for this hook (useSyncExternalStore only calls the client snapshot
    // after hydration), so no `typeof window` guard is needed here, matching
    // `useWritingCheckEnabled.ts`'s own established SSR-safety approach.
    const value = useSyncExternalStore(store.subscribe, store.read, () => defaultValue);

    const setValue = useCallback((next: T) => store.write(next), []);

    return [value, setValue] as const;
  };
}
