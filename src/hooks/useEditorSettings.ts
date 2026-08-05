"use client";

import { useEffect, useRef, useState } from "react";
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
 *
 * The initial state must match between server and client render, so it
 * always starts as DEFAULT_PAGE_SETTINGS; stored settings are applied in an
 * effect after mount instead of in the useState initializer (reading
 * localStorage there would make the client's hydration render diverge from
 * the server-rendered HTML and trigger a hydration error).
 */
export function useEditorSettings() {
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const stored = loadStoredSettings();
    if (stored) setSettings(stored);
    hasLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage failures (e.g. private browsing quota exceeded).
    }
  }, [settings]);

  return [settings, setSettings] as const;
}
