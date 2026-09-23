"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  READ_ALOUD_SERVER_STATE,
  createBrowserReadAloudEnv,
  createReadAloudController,
  type ReadAloudController,
  type ReadAloudSource,
  type ReadAloudState,
} from "../lib/readAloudEngine";
import type { ReadAloudMode } from "../lib/readAloud";

export interface UseReadAloud {
  state: ReadAloudState;
  /** What ▶ reads: 選択範囲 / 現在の段落 / 全文 (Review Dock + collapsed footer). Session-only; starts as the paragraph. */
  target: ReadAloudMode;
  setTarget: (mode: ReadAloudMode) => void;
  /** Reads the CURRENT selection / caret / manuscript at the moment of the press, and makes `mode` the target; never starts by itself. */
  start: (mode: ReadAloudMode) => void;
  /** Reads the chosen target (the footer's single ▶ action). */
  startTarget: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setRate: (rate: number) => void;
  setPreferredVoice: (voiceURI: string | null) => void;
}

/**
 * TSP-B4: binds one `ReadAloudController` to a component (EditorPane owns the
 * single instance so playback survives opening / closing the Review Hub and is
 * shared by the Hub section and the footer control).
 *
 * Lifecycle: speech is cancelled when the manuscript being edited changes
 * (`documentKey`: another project / a new one), when the page is hidden or
 * reloaded, and on unmount — the browser's own queue would otherwise keep
 * speaking after this UI is gone.
 */
export function useReadAloud(documentKey: string, getSource: () => ReadAloudSource): UseReadAloud {
  const [controller] = useState<ReadAloudController>(() => createReadAloudController(createBrowserReadAloudEnv()));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => READ_ALOUD_SERVER_STATE);
  const [target, setTarget] = useState<ReadAloudMode>("paragraph");

  // Another document: stop what was being read from the previous one.
  useEffect(() => () => controller.stop(), [controller, documentKey]);

  useEffect(() => {
    const stopOnHide = () => controller.stop();
    window.addEventListener("pagehide", stopOnHide);
    return () => {
      window.removeEventListener("pagehide", stopOnHide);
      controller.dispose();
    };
  }, [controller]);

  const start = useCallback(
    (mode: ReadAloudMode) => {
      setTarget(mode);
      controller.start(mode, getSource());
    },
    [controller, getSource],
  );
  const startTarget = useCallback(() => controller.start(target, getSource()), [controller, getSource, target]);

  return useMemo(
    () => ({
      state,
      target,
      setTarget,
      start,
      startTarget,
      pause: controller.pause,
      resume: controller.resume,
      stop: controller.stop,
      setRate: controller.setRate,
      setPreferredVoice: controller.setPreferredVoice,
    }),
    [state, target, start, startTarget, controller],
  );
}
