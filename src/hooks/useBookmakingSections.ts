"use client";

import { useCallback, useSyncExternalStore } from "react";

// CST-PORT-011B: which accordions inside the ▶本づくり drawer (本づくり /
// 原稿ファイル) are open. Per-device UI preference only -- lives in
// localStorage, is NEVER written into Supabase or the manuscript data
// (same pattern as useEditorFooterCollapsed.ts). Default is both closed;
// once a section is opened it stays open the next time the drawer opens,
// until the user closes it again. Missing / malformed values fall back to
// all closed.
const STORAGE_KEY = "tatespun_bookmaking_sections";

export type BookmakingSection = "book" | "files";
export type BookmakingSectionState = Record<BookmakingSection, boolean>;

const CLOSED: BookmakingSectionState = { book: false, files: false };

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedState: BookmakingSectionState = CLOSED;

export function parseBookmakingSections(raw: string | null): BookmakingSectionState {
  if (!raw) return CLOSED;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return CLOSED;
    const value = parsed as Partial<Record<BookmakingSection, unknown>>;
    return { book: value.book === true, files: value.files === true };
  } catch {
    return CLOSED;
  }
}

function readState(): BookmakingSectionState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  // useSyncExternalStore needs a stable snapshot between identical reads.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = parseBookmakingSections(raw);
  }
  return cachedState;
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
 * Open/closed state of the ▶本づくり drawer's two accordions, backed by
 * localStorage. The server snapshot is always all-closed, and React
 * reconciles the stored value after hydration.
 */
export function useBookmakingSections() {
  const sections = useSyncExternalStore(subscribe, readState, () => CLOSED);

  const setSectionOpen = useCallback((section: BookmakingSection, open: boolean) => {
    const next = { ...readState(), [section]: open };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write failures (private browsing, disabled storage).
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [sections, setSectionOpen] as const;
}
