"use client";

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_REVIEW_HUB_FOOTER_TOOLS,
  moveReviewHubFooterTool,
  normalizeReviewHubFooterTools,
  REVIEW_HUB_FOOTER_MAX,
  REVIEW_HUB_FOOTER_STORAGE_KEY,
  toggleReviewHubFooterTool,
  type ReviewHubFooterToolId,
} from "../lib/reviewHubFooterPins";

const CHANGE_EVENT = "tatespun:review-hub-footer-tools-change";
const DEFAULT_SNAPSHOT = JSON.stringify(
  DEFAULT_REVIEW_HUB_FOOTER_TOOLS,
);

function getClientSnapshot(): string {
  if (typeof window === "undefined") return DEFAULT_SNAPSHOT;

  try {
    return (
      window.localStorage.getItem(REVIEW_HUB_FOOTER_STORAGE_KEY) ??
      DEFAULT_SNAPSHOT
    );
  } catch {
    return DEFAULT_SNAPSHOT;
  }
}

function getServerSnapshot(): string {
  return DEFAULT_SNAPSHOT;
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onChange = () => onStoreChange();
  const onStorage = (event: StorageEvent) => {
    if (event.key === REVIEW_HUB_FOOTER_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function parseSnapshot(snapshot: string): ReviewHubFooterToolId[] {
  try {
    return normalizeReviewHubFooterTools(JSON.parse(snapshot));
  } catch {
    return [...DEFAULT_REVIEW_HUB_FOOTER_TOOLS];
  }
}

export function useReviewHubFooterPins() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const pins = useMemo(
    () => parseSnapshot(snapshot),
    [snapshot],
  );

  const persist = useCallback((next: ReviewHubFooterToolId[]) => {
    const normalized = normalizeReviewHubFooterTools(next);

    try {
      window.localStorage.setItem(
        REVIEW_HUB_FOOTER_STORAGE_KEY,
        JSON.stringify(normalized),
      );
    } catch {
      // Browser-local UI preference is best-effort only.
    }

    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const togglePin = useCallback(
    (toolId: ReviewHubFooterToolId) => {
      persist(toggleReviewHubFooterTool(pins, toolId));
    },
    [pins, persist],
  );

  const movePin = useCallback(
    (toolId: ReviewHubFooterToolId, direction: -1 | 1) => {
      persist(moveReviewHubFooterTool(pins, toolId, direction));
    },
    [pins, persist],
  );

  return {
    pins,
    isPinned: (toolId: ReviewHubFooterToolId) => pins.includes(toolId),
    canPin: (toolId: ReviewHubFooterToolId) =>
      pins.includes(toolId) || pins.length < REVIEW_HUB_FOOTER_MAX,
    togglePin,
    movePin,
  };
}
