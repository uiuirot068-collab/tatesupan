"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createJsonLocalStorageHook } from "./createJsonLocalStorageHook";
import {
  DEFAULT_DESCRIPTION_MODE,
  filterCandidatesByMode,
  normalizeDescriptionMode,
  type DescriptionMode,
} from "../lib/descriptionCheck";
import {
  analyzeDescriptionSourceAsync,
  createDescriptionCache,
  type DescriptionMark,
} from "../lib/descriptionCheckManuscript";

/** Browser-local preference (never part of the manuscript / cloud data). Default: OFF, mode A. */
export const DESCRIPTION_CHECK_STORAGE_KEY = "tatespun.descriptionCheck.v1";
export const DESCRIPTION_CHECK_DEBOUNCE_MS = 450;

interface StoredPrefs {
  enabled?: unknown;
  mode?: unknown;
}
const usePrefsStorage = createJsonLocalStorageHook<StoredPrefs>(DESCRIPTION_CHECK_STORAGE_KEY, {
  enabled: false,
  mode: DEFAULT_DESCRIPTION_MODE,
});

/**
 * TSP-B5: enable flag + detection mode (persisted in this browser only) and the analysis of the
 * current manuscript.
 *
 * Disabled = no analysis at all (the effect returns before scheduling anything). Enabled =
 * debounced, time-sliced, per-paragraph-cached analysis that never blocks typing and is skipped
 * while an IME composition is open (`recheckKey` bumps when it ends). Marks are kept paired with
 * the exact text they were computed for (`analysisText`), so nothing is drawn at a stale offset.
 */
export function useDescriptionCheck(content: string, isComposing: () => boolean, recheckKey: number) {
  const [prefs, setPrefs] = usePrefsStorage();
  const enabled = prefs?.enabled === true;
  const mode: DescriptionMode = normalizeDescriptionMode(prefs?.mode);
  const [cache] = useState(() => createDescriptionCache());
  const [analysis, setAnalysis] = useState<{ text: string; marks: DescriptionMark[] }>({ text: "", marks: [] });

  useEffect(() => {
    if (!enabled || isComposing()) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void analyzeDescriptionSourceAsync(content, { cache, isCancelled: () => cancelled }).then((marks) => {
        if (!cancelled && marks) setAnalysis({ text: content, marks });
      });
    }, DESCRIPTION_CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // isComposing reads a ref; recheckKey re-runs the effect when a composition ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, enabled, recheckKey, cache]);

  const marks = useMemo(() => filterCandidatesByMode(analysis.marks, mode), [analysis.marks, mode]);
  const current = analysis.text === content;

  const setEnabled = useCallback((next: boolean) => setPrefs({ enabled: next, mode }), [mode, setPrefs]);
  const setMode = useCallback((next: DescriptionMode) => setPrefs({ enabled, mode: next }), [enabled, setPrefs]);

  return { enabled, mode, setEnabled, setMode, marks, current, analysisText: analysis.text } as const;
}
