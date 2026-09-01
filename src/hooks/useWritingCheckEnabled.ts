"use client";

import { useCallback, useSyncExternalStore } from "react";

// TSP-LOOP-004: the 「文章チェック β」 on/off preference is a per-device UI
// setting only — it lives in localStorage and is NEVER written into the
// document data. Default is ON.
const STORAGE_KEY = "tatespun_writing_check";

const listeners = new Set<() => void>();

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Whether the local 文章チェック β overlay is shown, backed by localStorage.
 *
 * `useSyncExternalStore` keeps this SSR-safe without a hydration mismatch:
 * the server snapshot is always the default (ON), and React reconciles the
 * client's real stored value after hydration. Writing also notifies every
 * other hook instance in the tab so the footer checkbox and the overlay stay
 * in sync.
 */
export function useWritingCheckEnabled() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => true);

  const setEnabled = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Ignore storage write failures (private browsing, disabled storage).
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [enabled, setEnabled] as const;
}
