"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  EMPTY_WORK_SESSION_STATE,
  workSessionStoreFor,
  type ActivityDelta,
  type CompletedWorkSession,
  type WorkSessionState,
} from "@/lib/editorSessionActivity";

const subscribeEmpty = () => () => {};
const readEmpty = () => EMPTY_WORK_SESSION_STATE;

export function useEditorSessionActivity(scopeKey: string | null): {
  workSession: WorkSessionState;
  recordActivity: (delta: ActivityDelta) => void;
  startWorkSession: () => void;
  pauseWorkSession: () => void;
  resumeWorkSession: () => void;
  endWorkSession: () => CompletedWorkSession | null;
} {
  const store = useMemo(
    () => scopeKey === null ? null : workSessionStoreFor(scopeKey),
    [scopeKey],
  );
  const workSession = useSyncExternalStore(
    store?.subscribe ?? subscribeEmpty,
    store?.read ?? readEmpty,
    () => EMPTY_WORK_SESSION_STATE
  );
  const recordActivity = useCallback((delta: ActivityDelta) => {
    store?.record(delta);
  }, [store]);
  const startWorkSession = useCallback(() => {
    store?.start();
  }, [store]);
  const pauseWorkSession = useCallback(() => {
    store?.pause();
  }, [store]);
  const resumeWorkSession = useCallback(() => {
    store?.resume();
  }, [store]);
  const endWorkSession = useCallback(() => store?.end() ?? null, [store]);
  return {
    workSession,
    recordActivity,
    startWorkSession,
    pauseWorkSession,
    resumeWorkSession,
    endWorkSession,
  };
}
