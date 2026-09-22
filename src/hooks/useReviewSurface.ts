"use client";

import { useEffect, useState, type RefObject } from "react";

export type ReviewSurface = "desktop" | "compact";

const MOBILE_REVIEW_QUERY = "(max-width: 767px)";

/**
 * Final Review placement contract:
 * - mobile (< Tailwind md / 768px): Editor-bottom one-line Review footer + Bottom Sheet
 * - md+ (Preview is a side-by-side workspace): Preview-bottom Review Bar + upward popovers
 *
 * The previous >=1100px <main>-width heuristic made ordinary desktop windows (~900-1100px
 * usable main width) look like "compact", which incorrectly put 見直し back under the Editor
 * and opened the oversized Bottom Sheet. Review placement now follows the app's actual
 * mobile/desktop workspace breakpoint instead.
 *
 * mainRef stays in the signature for API compatibility with TategakiEditor.
 */
export function useReviewSurface(mainRef: RefObject<HTMLElement | null>): ReviewSurface {
  void mainRef;
  const [surface, setSurface] = useState<ReviewSurface>("desktop");

  useEffect(() => {
    const media = window.matchMedia(MOBILE_REVIEW_QUERY);
    const sync = () => setSurface(media.matches ? "compact" : "desktop");
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  return surface;
}
