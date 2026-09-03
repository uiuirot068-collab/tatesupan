"use client";

import { useSyncExternalStore } from "react";

// TSP-LOOP-020: "is this a phone-width viewport?" as an external store, so
// consumers stay SSR-safe with no hydration mismatch (server snapshot is
// always `false`) and no `setState`-in-effect. `768px` is the same `md`
// breakpoint every `md:` / `max-md:` Tailwind class in the editor uses.
const QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/** `true` while the viewport is phone-width (`< 768px`). */
export function useIsNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
