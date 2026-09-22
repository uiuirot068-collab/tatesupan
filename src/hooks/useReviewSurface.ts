"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * TSP-Review-UI (Revision 4): where the pinned Review tools (音読β / 描写・修飾チェックβ) live.
 *   "desktop"  — a compact one-line Review Bar at the BOTTOM of the Preview pane; its daily
 *                controls (and the full Review Hub) open as a small popover ABOVE that bar,
 *                overlaying Preview without resizing it. Revision 3 used a dedicated third-column
 *                sidebar ("Review Rail") here instead — Human QA rejected it (editor/Review felt
 *                too far apart, and it ate into Preview's width); this surface value keeps the
 *                same "desktop has room to spare" measurement but a different presentation.
 *   "compact"  — a one-line mini bar under the manuscript; full controls open in a Bottom Sheet
 *               (used for both phone and the narrower "tablet" / split-screen desktop widths --
 *               a bottom-of-preview bar has nowhere comfortable to sit there either).
 */
export type ReviewSurface = "desktop" | "compact";

/**
 * Measured, not a viewport media query: `<main>`'s own rendered width. This is stable regardless
 * of what -- if anything -- the Review surface currently mounts as a flex child of `<main>`, so
 * there is no measure/render feedback loop.
 *
 * Threshold derived from real measurements of this layout (`next dev`, editor+preview 50/50 split):
 *   viewport 1024 → main  952px   viewport 1100 → main 1028px   (kept "compact" -- Human QA asked
 *   viewport 1180 → main 1108px   viewport 1280 → main 1208px    770/900-1024 to stay compact too)
 * The Preview-bottom Review Bar itself does not need extra horizontal width the way the old Rail
 * did, but the threshold is kept unchanged from Revision 3 rather than re-derived, because Human QA
 * explicitly asked for 770 and 900-1024 to keep the "safest compact presentation" regardless.
 */
export const REVIEW_DESKTOP_MIN_MAIN_WIDTH_PX = 1100;

export function reviewSurfaceForMainWidth(mainWidthPx: number): ReviewSurface {
  return mainWidthPx >= REVIEW_DESKTOP_MIN_MAIN_WIDTH_PX ? "desktop" : "compact";
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
