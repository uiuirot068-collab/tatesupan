"use client";

import { useCallback, useSyncExternalStore } from "react";

// TSP-LOOP-012: the mobile-only「集中モード」(focus mode) preference is a
// per-device UI setting only — it lives in localStorage and is NEVER written
// into Supabase or the document/manuscript data. Default is OFF; any stored
// value other than "on" (missing, malformed, stale) falls back to OFF.
const STORAGE_KEY = "tatespun_mobile_focus";

const listeners = new Set<() => void>();

function readFocus(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
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
 * Whether the narrow-viewport focus mode is active, backed by localStorage.
 *
 * `useSyncExternalStore` keeps this SSR-safe with no hydration mismatch: the
 * server snapshot is always OFF, and React reconciles the client's real stored
 * value after hydration. Writing also notifies every other hook instance in the
 * tab so the toggle stays in sync.
 */
export function useMobileFocusMode() {
  const focusMode = useSyncExternalStore(subscribe, readFocus, () => false);

  const setFocusMode = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Ignore storage write failures (private browsing, disabled storage).
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [focusMode, setFocusMode] as const;
}
