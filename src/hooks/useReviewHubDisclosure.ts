"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { computeReviewHubMaxHeight, isReviewHubVisible, shouldCloseReviewHubOnKey } from "@/lib/reviewHub";
import { recordReviewHubOpen } from "@/lib/reviewHubUsage";

/**
 * TSP-B1: open/closed state of the Review Hub panel. Session-only by design —
 * it is never persisted (no localStorage key, no pin/favourite preference; that
 * is B2) and always starts closed.
 *
 * Behaviour contract:
 *  - opening never moves focus (no trap, no stealing of typing focus);
 *  - a press outside the wrapper closes it (same as WritingCheckBar's popover),
 *    so clicking back into the manuscript dismisses it;
 *  - Escape closes it only while focus is inside the wrapper and not mid-IME,
 *    and then returns focus to the visible trigger if focus was in the panel;
 *  - 集中モード / mobile keyboard-open force it closed (the footer is hidden
 *    there already; the Hub follows the same chrome rule);
 *  - while open, its height is capped to the space between the Editor pane's top
 *    (`paneRef`) and the footer, so it can never leave the pane or cover the
 *    global header, on any viewport height.
 */
export function useReviewHubDisclosure(
  chrome: { focusMode: boolean; keyboardActive: boolean },
  paneRef: RefObject<HTMLElement | null>,
  /**
   * TSP-Review-UI (Revision 4): the Review Hub panel can now be portalled somewhere other than
   * inside `wrapperRef` (the Desktop Review Bar at the bottom of Preview, instead of the manuscript
   * footer) -- a press inside that portalled content is still DOM-outside `wrapperRef`, so without
   * this it would be treated as an outside press and close the panel the instant it opens. Any of
   * these containers additionally counts as "inside" for the outside-press check.
   */
  extraContainmentRefs?: readonly RefObject<HTMLElement | null>[]
) {
  const suppressed = chrome.focusMode || chrome.keyboardActive;
  const [requestedOpen, setRequestedOpen] = useState(false);

  // Reset a pending "open" the moment the footer becomes hidden, so leaving
  // 集中モード / closing the keyboard never pops the panel back open.
  const [wasSuppressed, setWasSuppressed] = useState(suppressed);
  if (suppressed !== wasSuppressed) {
    setWasSuppressed(suppressed);
    if (suppressed) setRequestedOpen(false);
  }

  const open = isReviewHubVisible(requestedOpen, chrome);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [maxHeightPx, setMaxHeightPx] = useState<number | null>(null);

  const close = useCallback(() => setRequestedOpen(false), []);
  const toggle = useCallback(() => {
    if (!open) recordReviewHubOpen(); // B3: in-memory count only; see reviewHubUsage.ts
    setRequestedOpen((value) => !value);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (extraContainmentRefs?.some((ref) => ref.current?.contains(target))) return;
      setRequestedOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extraContainmentRefs is a ref array, not reactive state
  }, [open]);

  // Follow the pane/footer geometry (window, keyboard, rotation, footer folding).
  // The observer reports once on `observe`, so no synchronous setState is needed.
  useEffect(() => {
    const pane = paneRef.current;
    const footer = wrapperRef.current;
    if (!open || !pane || !footer || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const spaceAboveFooter = footer.getBoundingClientRect().top - pane.getBoundingClientRect().top;
      setMaxHeightPx(computeReviewHubMaxHeight(spaceAboveFooter));
    });
    observer.observe(pane);
    observer.observe(footer);
    return () => observer.disconnect();
  }, [open, paneRef]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!open || !shouldCloseReviewHubOnKey(event.key, event.nativeEvent.isComposing)) return;
      // TSP-Review-UI (Revision 4): the panel (and its trigger) may now be portalled outside
      // `wrapperRef`'s own DOM subtree (the Desktop Review Bar) -- there is only ever one of each
      // in the document, so a global lookup is correct regardless of where either is mounted.
      const focusWasInPanel = !!document.querySelector("[data-review-hub-panel]")?.contains(document.activeElement);
      setRequestedOpen(false);
      if (!focusWasInPanel) return;
      // Multiple triggers can exist in the DOM (expanded footer / mobile-collapsed footer / Desktop
      // Review Bar); only one is displayed at a time.
      const triggers = document.querySelectorAll<HTMLElement>("[data-editor-review-hub-trigger]");
      Array.from(triggers).find((trigger) => trigger.offsetParent !== null)?.focus();
    },
    [open]
  );

  return { open, toggle, close, wrapperRef, onKeyDown, maxHeightPx } as const;
}
