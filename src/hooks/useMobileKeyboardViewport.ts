"use client";

import { useEffect, useState } from "react";
import { useIsNarrowViewport } from "./useIsNarrowViewport";

// TSP-FRIEND-QA-MOBILE-VISUAL-VIEWPORT-001: opening the on-screen keyboard
// shrinks the *visible* area without reliably resizing the layout viewport
// -- `100dvh` behavior for the keyboard case is inconsistent across
// browsers/OSes. `window.visualViewport` is the one API that reports what's
// actually visible, so the editor shell sizes itself against that instead.
//
// This threshold only distinguishes a keyboard-sized shrink from an
// ordinary browser-chrome change (e.g. Safari's URL bar collapsing, usually
// well under 100px) -- it is never used to size anything, so no specific
// device's keyboard height is assumed.
const KEYBOARD_SHRINK_THRESHOLD_PX = 150;

export interface MobileKeyboardViewport {
  /** Current visible viewport height in px, or null when unavailable or outside mobile scope (caller falls back to CSS `100dvh`). */
  visibleHeight: number | null;
  /** Heuristically true while a software keyboard appears to be open. */
  keyboardActive: boolean;
}

export const INACTIVE_KEYBOARD_VIEWPORT: MobileKeyboardViewport = {
  visibleHeight: null,
  keyboardActive: false,
};

// TSP-FQ04-SHELL-VISIBLE-HEIGHT-FIX-006: the Editor shell used to receive
// `visibleHeight` only indirectly -- as a `--tsp-visible-vh` CSS custom
// property set via inline style, consumed by a separate `var(--tsp-visible-vh,
// 100dvh)` rule in globals.css under a `@media` block. Production diagnostics
// proved that indirection unreliable on at least one real device: the hook's
// own React state updated correctly (`visibleHeight` read back as the fresh,
// shrunk value), but the shell's rendered height and the custom property's
// own `getComputedStyle` value both stayed pinned to the pre-keyboard number.
// No competing rule, duplicate selector, `!important`, `@property`
// registration, or CSS transition was found on `--tsp-visible-vh` anywhere in
// the codebase (grepped) -- this hook's own inline style is the only place
// that ever sets it -- so the indirection layer itself (JS state -> inline
// custom property -> external stylesheet `var()` lookup) is the broken
// boundary, not a cascade fight or a stale hook value. This helper replaces
// that indirection with a plain `height` inline style: the single highest-
// specificity, zero-indirection mechanism available, so there is no separate
// stylesheet rule left to trace or for a future change to silently break.
export function mobileShellHeightStyle(visibleHeight: number | null): { height?: string } {
  return { height: visibleHeight != null ? `${visibleHeight}px` : undefined };
}

interface VisualViewportLike {
  height: number;
  addEventListener(type: "resize", listener: () => void): void;
  removeEventListener(type: "resize", listener: () => void): void;
}

interface KeyboardViewportWindowLike {
  innerHeight: number;
  visualViewport: VisualViewportLike | null | undefined;
}

/**
 * Pure, DOM-injectable core behind `useMobileKeyboardViewport` -- exercised
 * directly in tests against a stub window-like object (no jsdom needed),
 * the same pattern `createJsonLocalStorageHook.ts` uses for its store.
 * Calls `notify` once immediately, then again on every `resize` (covers
 * both keyboard open/close and orientation change, which both fire
 * `visualViewport`'s `resize`). Returns an unsubscribe function.
 */
export function subscribeToKeyboardViewport(
  win: KeyboardViewportWindowLike,
  notify: (state: MobileKeyboardViewport) => void
): () => void {
  const vv = win.visualViewport;
  if (!vv) {
    notify(INACTIVE_KEYBOARD_VIEWPORT);
    return () => {};
  }

  const measure = () => {
    const visibleHeight = vv.height;
    const keyboardActive = win.innerHeight - visibleHeight > KEYBOARD_SHRINK_THRESHOLD_PX;
    notify({ visibleHeight, keyboardActive });
  };

  measure();
  vv.addEventListener("resize", measure);
  return () => vv.removeEventListener("resize", measure);
}

/**
 * Tracks `window.visualViewport` height, mobile-only (gated on the same
 * `(max-width: 767px)` breakpoint as `useIsNarrowViewport`) and only where
 * the API exists. Desktop and unsupported browsers get
 * `INACTIVE_KEYBOARD_VIEWPORT` and `subscribeToKeyboardViewport` is never
 * even called, so no listener is ever attached outside mobile scope.
 */
export function useMobileKeyboardViewport(): MobileKeyboardViewport {
  const isNarrow = useIsNarrowViewport();
  const [state, setState] = useState<MobileKeyboardViewport>(INACTIVE_KEYBOARD_VIEWPORT);

  useEffect(() => {
    if (!isNarrow || typeof window === "undefined") return;
    return subscribeToKeyboardViewport(window, setState);
  }, [isNarrow]);

  // Masked (rather than reset via a setState call in the effect above) so a
  // stale narrow-mode measurement can never leak out the instant `isNarrow`
  // flips false -- e.g. rotating past the breakpoint mid-keyboard-open.
  return isNarrow ? state : INACTIVE_KEYBOARD_VIEWPORT;
}
