"use client";

import { useEffect, useRef } from "react";

type ShortcutHandler = (event: KeyboardEvent) => void;

export interface ShortcutBinding {
  /** Key(s) that combine with Ctrl (Windows/Linux) or Cmd (Mac) to fire this shortcut. */
  key: string | string[];
  handler: ShortcutHandler;
  /** Call event.preventDefault() before invoking the handler. Default: true. */
  preventDefault?: boolean;
}

// "+"/"-" require Shift on most layouts and have a separate numpad code, so a
// single logical key needs to match several physical key reports.
function matchesKey(event: KeyboardEvent, key: string): boolean {
  if (key === "+") {
    return event.key === "+" || event.key === "=" || event.code === "NumpadAdd";
  }
  if (key === "-") {
    return event.key === "-" || event.code === "NumpadSubtract";
  }
  return event.key.toLowerCase() === key.toLowerCase();
}

/**
 * Registers global Ctrl/Cmd + key shortcuts on window. Bindings are read from
 * a ref so callers can pass a fresh array each render without re-attaching
 * the listener.
 */
export function useShortcuts(bindings: ShortcutBinding[]) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (!event.ctrlKey && !event.metaKey) return;

      for (const binding of bindingsRef.current) {
        const keys = Array.isArray(binding.key) ? binding.key : [binding.key];
        if (keys.some((key) => matchesKey(event, key))) {
          if (binding.preventDefault !== false) event.preventDefault();
          binding.handler(event);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
