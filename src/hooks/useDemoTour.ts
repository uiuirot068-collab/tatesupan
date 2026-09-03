"use client";

import { useCallback, useState } from "react";
import { DEMO_STEPS } from "@/constants/demoData";

/**
 * TSP-LOOP-024 — tutorial-only state for the 10-step おためしデモ.
 *
 * Owns NOTHING about the manuscript: the real editor stays canonical. This is
 * plain in-memory `useState` (no localStorage / IndexedDB) so the demo is
 * trivially restartable and can never masquerade as a saved project.
 *
 * `next` NEVER checks whether the user completed the step's optional action —
 * every step is skippable.
 */
export function useDemoTour() {
  const total = DEMO_STEPS.length;
  const [index, setIndex] = useState(0); // 0-based
  const step = DEMO_STEPS[index];

  const next = useCallback(
    () => setIndex((i) => Math.min(i + 1, total - 1)),
    [total]
  );
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const goTo = useCallback(
    (n: number) => setIndex(Math.max(0, Math.min(n - 1, total - 1))),
    [total]
  );
  const restart = useCallback(() => setIndex(0), []);

  return {
    step,
    stepNumber: index + 1,
    total,
    isFirst: index === 0,
    isLast: index === total - 1,
    next,
    prev,
    goTo,
    restart,
  };
}
