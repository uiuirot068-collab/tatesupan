"use client";

import { useCallback, useSyncExternalStore } from "react";

// TSP-RC-LATIN-AND-MOBILE-COMPACT-001: whether the 文章チェックβ + 作業
// カウンター footer area is shown collapsed (one compact line) or expanded
// (today's full detail). Per-device UI preference only -- lives in
// localStorage, is NEVER written into Supabase or the document/manuscript
// data, and never gates the underlying Writing Check / work-session
// features themselves (see useMobileFocusMode.ts for the identical pattern
// this mirrors). Default is expanded (OFF); any stored value other than
// "on" (missing, malformed, stale) falls back to expanded.
const STORAGE_KEY = "tatespun_editor_footer_collapsed";

const listeners = new Set<() => void>();

function readCollapsed(): boolean {
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
 * Whether the editor footer (文章チェックβ + 作業カウンター) is collapsed to
 * one compact line, backed by localStorage. `useSyncExternalStore` keeps
 * this SSR-safe with no hydration mismatch: the server snapshot is always
 * expanded, and React reconciles the client's real stored value after
 * hydration.
 */
export function useEditorFooterCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  const setCollapsed = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Ignore storage write failures (private browsing, disabled storage).
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [collapsed, setCollapsed] as const;
}
