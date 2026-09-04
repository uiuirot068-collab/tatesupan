"use client";

import { useCallback, useSyncExternalStore } from "react";

// TSP-LOOP-028: after a successful PDF export TateSpun shows a short
// "check your 入稿 filename" reminder. Whether that reminder keeps appearing
// is a per-device UI preference only — it lives in localStorage and is NEVER
// written into manuscript / cloud-project data. Default (key absent) is ON.
//
// Mirrors `useWritingCheckEnabled` (same `tatespun_*` namespace, same
// SSR-safe useSyncExternalStore shape, same "off" sentinel).
const STORAGE_KEY = "tatespun_pdf_filename_notice";

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
 * Whether the post-PDF-export filename notice should be shown, backed by
 * localStorage. `[enabled, setEnabled]`, default ON. The server snapshot is
 * always ON so hydration never mismatches; React reconciles the stored value
 * on the client after hydration.
 */
export function useShowPdfFilenameNotice() {
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
