"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * TSP-Review-UI (Revision 3): where the pinned Review tools (音読β / 描写・修飾チェックβ) live.
 *   "rail"    — a dedicated vertical sidebar beside the manuscript (desktop, plenty of width).
 *   "compact" — a one-line mini bar under the manuscript; full controls open in a Bottom Sheet
 *               (used for both phone and the narrower "tablet" / split-screen desktop widths —
 *               a half-width side rail there would crush the editor or the preview).
 */
export type ReviewSurface = "rail" | "compact";

/**
 * Measured, not a viewport media query: `<main>`'s own rendered width. This is stable regardless
 * of whether the rail is currently mounted (the rail is a flex CHILD of `<main>`; `<main>`'s own
 * box size comes from its parent shell, never from its children), so there is no measure/render
 * feedback loop.
 *
 * Threshold derived from real measurements of this layout (`next dev`, editor+preview 50/50 split):
 *   viewport 1024 → main  952px   viewport 1100 → main 1028px   (both would crush a rail)
 *   viewport 1180 → main 1108px   viewport 1280 → main 1208px   (rail leaves ~410–460px per pane)
 * i.e. the rail (≈272px + gap) only appears once editor and preview can each keep at least ~400px
 * beside it — comfortably above the ~335–400px two-pane floor this app already supports (see
 * `tests/e2e/headerTabletDensity.e2e.mjs`'s 770–900px split-screen scenarios).
 */
export const REVIEW_RAIL_MIN_MAIN_WIDTH_PX = 1100;

export function reviewSurfaceForMainWidth(mainWidthPx: number): ReviewSurface {
  return mainWidthPx >= REVIEW_RAIL_MIN_MAIN_WIDTH_PX ? "rail" : "compact";
}

/** `"compact"` until measured (matches the mobile-first default and avoids an SSR/hydration mismatch). */
export function useReviewSurface(containerRef: RefObject<HTMLElement | null>): ReviewSurface {
  const [surface, setSurface] = useState<ReviewSurface>("compact");

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const update = () => setSurface(reviewSurfaceForMainWidth(node.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);

  return surface;
}
