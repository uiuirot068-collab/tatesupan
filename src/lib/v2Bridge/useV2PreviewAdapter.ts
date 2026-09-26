"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import type { PageSettings } from "../pageLayout";
import type { V2LayoutResult } from "./composeV2Document";
import { CompositionGate, type V2CompositionInput } from "./compositionRevision";
import type { PaintDocument } from "../../../typesetting-v2/renderer/preview/paintModel";

export {
  buildV2PreviewDocument,
  PAGE_CARD_PREVIEW_SCALE_MULTIPLIER,
} from "./buildV2PreviewDocument";

export interface V2PreviewAdapterState {
  bridge: V2LayoutResult | null;
  preview: PaintDocument | null;
  error: string | null;
  loading: boolean;
  /** The exact input `bridge`/`preview` were composed from (Phase 3 revision contract). */
  input: V2CompositionInput | null;
}

export interface V2PreviewAdapter extends V2PreviewAdapterState {
  /**
   * Resolves with the layout composed from exactly `input` — immediately when
   * that is the current layout, otherwise when the pipeline finishes it.
   * Rejects if that composition fails or the caller supersedes it.
   */
  awaitComposition: (input: V2CompositionInput) => Promise<V2LayoutResult>;
  /** Rejects pending waits whose input is no longer `current`. */
  supersedePendingCompositions: (current: V2CompositionInput) => void;
}

const DISABLED_STATE: V2PreviewAdapterState = {
  bridge: null,
  preview: null,
  error: null,
  loading: false,
  input: null,
};

/** Async browser bridge; it never falls back to fake measurements. */
export function useV2PreviewAdapter(
  enabled: boolean,
  input: { content: string; settings: PageSettings; title: string; images: Record<string, string> }
): V2PreviewAdapter {
  const [state, setState] = useState<V2PreviewAdapterState>({
    bridge: null,
    preview: null,
    error: null,
    loading: enabled,
    input: null,
  });
  const [gate] = useState(() => new CompositionGate<V2LayoutResult>());

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const composing: V2CompositionInput = {
      content: input.content,
      settings: input.settings,
      title: input.title,
      images: input.images,
    };
    // Same manuscript/settings as the layout already on screen (e.g. a new
    // but equal settings object): nothing to recompute.
    if (gate.currentFor(composing)) return;
    let cancelled = false;
    let worker: Worker | null = null;
    const timer = window.setTimeout(() => {
      worker = new Worker(new URL("../../workers/v2Preview.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<{
        type: "complete" | "error";
        bridge?: V2LayoutResult;
        preview?: PaintDocument;
        message?: string;
      }>) => {
        if (cancelled) return;
        if (event.data.type === "complete" && event.data.bridge && event.data.preview) {
          const bridge = event.data.bridge;
          const preview = event.data.preview;
          startTransition(() => {
            setState({ bridge, preview, error: null, loading: false, input: composing });
          });
          gate.complete(composing, bridge);
        } else {
          const failed: V2PreviewAdapterState = { bridge: null, preview: null, error: `V2 HOLD: ${event.data.message ?? "Preview worker failed"}`, loading: false, input: null };
          setState(failed);
          gate.fail(composing, new Error(failed.error ?? "V2 HOLD"));
        }
        worker?.terminate();
        worker = null;
      };
      worker.onerror = (event) => {
        if (!cancelled) {
          const failed: V2PreviewAdapterState = { bridge: null, preview: null, error: `V2 HOLD: ${event.message || "Preview worker failed"}`, loading: false, input: null };
          setState(failed);
          gate.fail(composing, new Error(failed.error ?? "V2 HOLD"));
        }
        worker?.terminate();
        worker = null;
      };
      worker.postMessage({ type: "compose", input });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [enabled, gate, input.content, input.images, input.settings, input.title]);

  const awaitComposition = useCallback((wanted: V2CompositionInput) => gate.waitFor(wanted), [gate]);
  const supersedePendingCompositions = useCallback((current: V2CompositionInput) => gate.supersede(current), [gate]);

  return enabled
    ? { ...state, awaitComposition, supersedePendingCompositions }
    : { ...DISABLED_STATE, awaitComposition, supersedePendingCompositions };
}
