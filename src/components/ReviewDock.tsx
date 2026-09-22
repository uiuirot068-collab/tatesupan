"use client";

import type { ReactNode } from "react";

/**
 * TSP-B4/B5 (Revision 2) Review Dock: the deliberate region between the manuscript and the editor's own footer /
 * navigation rows where pinned Review tools live as cards. Visual contract:
 *   manuscript  ·  breathing room + separator  ·  Review Dock (cards)  ·  the existing footer rows
 * Two cards (the B2 maximum) sit side by side when the column is wide enough and stack when it is not; there is no
 * horizontal scrolling and nothing is squeezed onto one line. The container itself never scrolls.
 */
export default function ReviewDock({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      data-review-dock=""
      aria-label="見直しツール"
      className={`mt-1 flex min-w-0 flex-none flex-wrap gap-1.5 border-t border-ink/15 bg-ink/[0.03] px-2 py-1.5 ${className}`}
    >
      {children}
    </section>
  );
}
