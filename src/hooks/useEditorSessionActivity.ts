"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  editorSessionActivityStore,
  type ActivityDelta,
  type SessionActivity,
  ZERO_ACTIVITY,
} from "@/lib/editorSessionActivity";

export function useEditorSessionActivity(): {
  activity: SessionActivity;
  recordActivity: (delta: ActivityDelta) => void;
} {
  const activity = useSyncExternalStore(
    editorSessionActivityStore.subscribe,
    editorSessionActivityStore.read,
    () => ZERO_ACTIVITY
  );
  const recordActivity = useCallback((delta: ActivityDelta) => {
    editorSessionActivityStore.record(delta);
  }, []);
  return { activity, recordActivity };
}
