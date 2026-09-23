"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createJsonLocalStorageHook } from "./createJsonLocalStorageHook";
import {
  DEFAULT_DESCRIPTION_CATEGORIES,
  filterCandidatesByCategories,
  migrateDescriptionPrefs,
  toggleDescriptionCategory,
  type DescriptionCategory,
  type DescriptionPrefs,
} from "../lib/descriptionCheck";
import {
  analyzeDescriptionSourceAsync,
  createDescriptionCache,
  type DescriptionMark,
} from "../lib/descriptionCheckManuscript";

/**
 * Browser-local preference (never part of the manuscript / cloud data). Default: OFF, categories A only.
 * Stored shape: { enabled, categories: { A, B, C } }. Values written by the first B5 build
 * ({ enabled, mode: "A" | "AB" | "ABC" }) are migrated on read (A -> A / AB -> A+B / ABC -> A+B+C) and are
 * replaced by the new shape on the next change; nothing else in local storage is touched.
 */
export const DESCRIPTION_CHECK_STORAGE_KEY = "tatespun.descriptionCheck.v1";
export const DESCRIPTION_CHECK_DEBOUNCE_MS = 450;

const usePrefsStorage = createJsonLocalStorageHook<unknown>(DESCRIPTION_CHECK_STORAGE_KEY, {
  enabled: false,
  categories: DEFAULT_DESCRIPTION_CATEGORIES,
});

/**
 * TSP-B5: enable flag + which categories are shown (persisted in this browser only) and the analysis of the
 * current manuscript.
 *
 * Disabled = no analysis at all (the effect returns before scheduling anything). Enabled =
 * debounced, time-sliced, per-paragraph-cached analysis that never blocks typing and is skipped
 * while an IME composition is open (`recheckKey` bumps when it ends). Marks are kept paired with
 * the exact text they were computed for (`analysisText`), so nothing is drawn at a stale offset.
 */
export function useDescriptionCheck(content: string, isComposing: () => boolean, recheckKey: number) {
  const [prefs, setPrefs] = usePrefsStorage();
  const { enabled, categories }: DescriptionPrefs = useMemo(() => migrateDescriptionPrefs(prefs), [prefs]);
  // Nothing selected = nothing to show, so nothing is analysed either.
  const anyCategory = categories.A || categories.B || categories.C;
  const [cache] = useState(() => createDescriptionCache());
  const [analysis, setAnalysis] = useState<{ text: string; marks: DescriptionMark[] }>({ text: "", marks: [] });

  useEffect(() => {
    if (!enabled || !anyCategory || isComposing()) return;
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
  }, [content, enabled, anyCategory, recheckKey, cache]);

  // candidate.category ∈ enabled categories; all three off = nothing shown (not an error).
  const marks = useMemo(() => filterCandidatesByCategories(analysis.marks, categories), [analysis.marks, categories]);
  const current = !anyCategory || analysis.text === content;

  const setEnabled = useCallback((next: boolean) => setPrefs({ enabled: next, categories }), [categories, setPrefs]);
  const toggleCategory = useCallback(
    (category: DescriptionCategory) => setPrefs({ enabled, categories: toggleDescriptionCategory(categories, category) }),
    [enabled, categories, setPrefs],
  );

  return { enabled, categories, setEnabled, toggleCategory, marks, current, analysisText: analysis.text } as const;
}
