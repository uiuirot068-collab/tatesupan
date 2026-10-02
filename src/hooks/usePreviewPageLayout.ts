"use client";

import { useCallback, useSyncExternalStore } from "react";
import { parsePreviewPageLayout, type PreviewPageLayout } from "@/lib/pageJump";

// CST-PORT-005: the preview's 「1P / 見開き」 choice. Per-device UI
// preference only -- lives in localStorage, is NEVER written into Supabase or
// the document data, and never changes pagination or export. Default is
// 見開き (the preview's behaviour before this switch existed); any stored value
// other than "single" falls back to 見開き.
const STORAGE_KEY = "tatespun_preview_page_layout";

const listeners = new Set<() => void>();

function readLayout(): PreviewPageLayout {
  try {
    return parsePreviewPageLayout(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "spread";
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
 * The preview's page layout (1ページ表示 or 見開き表示), backed by localStorage.
 * `useSyncExternalStore` keeps this SSR-safe: the server snapshot is always
 * 見開き and React reconciles the stored value after hydration.
 */
export function usePreviewPageLayout() {
  const layout = useSyncExternalStore(subscribe, readLayout, () => "spread" as const);

  const setLayout = useCallback((next: PreviewPageLayout) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage write failures (private browsing, disabled storage).
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [layout, setLayout] as const;
}
