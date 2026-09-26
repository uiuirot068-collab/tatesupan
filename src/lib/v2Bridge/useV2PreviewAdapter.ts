"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import type { PageSettings } from "../pageLayout";
import type { V2LayoutResult } from "./composeV2Document";
import { CompositionGate, type V2CompositionInput } from "./compositionRevision";
import { referencedImages, ReusablePreviewWorker } from "./previewWorkerClient";
import type { PaintDocument } from "../../../typesetting-v2/renderer/preview/paintModel";

/**
 * The ONE intentional debounce before a V2 composition (Phase 7): it bounds
 * worker work for every input — manuscript text, live title typing, settings
 * sliders. The manuscript already arrives debounced from the Editor (a
 * React.memo boundary for PreviewPane), so there is no third stage.
 */
export const V2_COMPOSITION_DEBOUNCE_MS = 180;

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
  // Phase 7: one reusable layout worker (lib/v2Bridge/previewWorkerClient.ts).
  const [workerClient] = useState(() => new ReusablePreviewWorker(
    () => new Worker(new URL("../../workers/v2Preview.worker.ts", import.meta.url), { type: "module" })
  ));
  useEffect(() => () => workerClient.dispose(), [workerClient]);

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
    let cancelRequest: (() => void) | null = null;
    const fail = (message: string) => {
      const failed: V2PreviewAdapterState = { bridge: null, preview: null, error: `V2 HOLD: ${message}`, loading: false, input: null };
      setState(failed);
      gate.fail(composing, new Error(failed.error ?? "V2 HOLD"));
    };
    const timer = window.setTimeout(() => {
      // The layout depends only on the images the manuscript references;
      // the gate/export contract still compares the full `composing` input.
      const payload = { ...composing, images: referencedImages(composing.images, composing.content) };
      cancelRequest = workerClient.request(payload, (outcome) => {
        if (!outcome.ok) {
          fail(outcome.message);
          return;
        }
        const bridge = outcome.reply.bridge as V2LayoutResult | undefined;
        const preview = outcome.reply.preview as PaintDocument | undefined;
        if (!bridge || !preview) {
          fail("Preview worker failed");
          return;
        }
        startTransition(() => {
          setState({ bridge, preview, error: null, loading: false, input: composing });
        });
        gate.complete(composing, bridge);
      });
    }, V2_COMPOSITION_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      cancelRequest?.();
    };
  }, [enabled, gate, input.content, input.images, input.settings, input.title, workerClient]);

  const awaitComposition = useCallback((wanted: V2CompositionInput) => gate.waitFor(wanted), [gate]);
  const supersedePendingCompositions = useCallback((current: V2CompositionInput) => gate.supersede(current), [gate]);

  return enabled
    ? { ...state, awaitComposition, supersedePendingCompositions }
    : { ...DISABLED_STATE, awaitComposition, supersedePendingCompositions };
}
