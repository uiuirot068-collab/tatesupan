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
  pauseWorkSession: () => void;
  resumeWorkSession: () => void;
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
  const pauseWorkSession = useCallback(() => {
    workSessionStore.pause();
  }, []);
  const resumeWorkSession = useCallback(() => {
    workSessionStore.resume();
  }, []);
  const endWorkSession = useCallback(() => workSessionStore.end(), []);
  return {
    workSession,
    recordActivity,
    startWorkSession,
    pauseWorkSession,
    resumeWorkSession,
    endWorkSession,
  };
}
