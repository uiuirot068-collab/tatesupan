"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_MASTER_PAGE_SETTINGS,
  DEFAULT_PAGE_SETTINGS,
  type PageSettings,
} from "@/lib/pageLayout";

const STORAGE_KEY = "tatespun_settings";

function loadStoredSettings(): PageSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PageSettings>;
    return {
      ...DEFAULT_PAGE_SETTINGS,
      ...parsed,
      masterPage: {
        ...DEFAULT_MASTER_PAGE_SETTINGS,
        ...parsed.masterPage,
      },
      pageOverrides: {},
    };
  } catch {
    return null;
  }
}

/**
 * Tracks the editor's typography/layout settings and mirrors every change to
 * localStorage, so the last-used settings become the starting point for new
 * documents (per-document overrides still come from IndexedDB via `db.ts`).
 */
export function useEditorSettings() {
  const [settings, setSettings] = useState<PageSettings>(
    () => loadStoredSettings() ?? DEFAULT_PAGE_SETTINGS
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage failures (e.g. private browsing quota exceeded).
    }
  }, [settings]);

  return [settings, setSettings] as const;
}
