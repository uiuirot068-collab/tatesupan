"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { computeReviewHubMaxHeight, isReviewHubVisible, shouldCloseReviewHubOnKey } from "@/lib/reviewHub";

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
  paneRef: RefObject<HTMLElement | null>
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
  const toggle = useCallback(() => setRequestedOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setRequestedOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
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
      const wrapper = wrapperRef.current;
      const focusWasInPanel = !!wrapper?.querySelector("[data-review-hub-panel]")?.contains(document.activeElement);
      setRequestedOpen(false);
      if (!focusWasInPanel) return;
      // Two triggers exist in the DOM (expanded + mobile-collapsed footer); only one is displayed.
      const triggers = wrapper?.querySelectorAll<HTMLElement>("[data-editor-review-hub-trigger]") ?? [];
      Array.from(triggers).find((trigger) => trigger.offsetParent !== null)?.focus();
    },
    [open]
  );

  return { open, toggle, close, wrapperRef, onKeyDown, maxHeightPx } as const;
}
