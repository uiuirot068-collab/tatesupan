"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  EMPTY_WORK_SESSION_STATE,
  workSessionStore,
  type ActivityDelta,
  type CompletedWorkSession,
  type WorkSessionState,
} from "@/lib/editorSessionActivity";

export function useEditorSessionActivity(): {
  workSession: WorkSessionState;
  recordActivity: (delta: ActivityDelta) => void;
  startWorkSession: () => void;
  endWorkSession: () => CompletedWorkSession | null;
} {
  const workSession = useSyncExternalStore(
    workSessionStore.subscribe,
    workSessionStore.read,
    () => EMPTY_WORK_SESSION_STATE
  );
  const recordActivity = useCallback((delta: ActivityDelta) => {
    workSessionStore.record(delta);
  }, []);
  const startWorkSession = useCallback(() => {
    workSessionStore.start();
  }, []);
  const endWorkSession = useCallback(() => workSessionStore.end(), []);
  return { workSession, recordActivity, startWorkSession, endWorkSession };
}
